#include "lynxfita/coroutine_scheduler.h"
#include <iostream>
#include <chrono>

namespace lynxfita {

// ============================================================================
// FiberCoroutine Implementation
// ============================================================================

FiberCoroutine::FiberCoroutine(std::string name, size_t total_steps, StepFn step_fn)
    : name_(std::move(name)), total_steps_(total_steps), step_fn_(std::move(step_fn)) {}

CoroutineYieldResult FiberCoroutine::Step() {
  if (state_ == CoroutineState::Completed) {
    return { CoroutineState::Completed, false, true, "Coroutine already completed" };
  }

  state_ = CoroutineState::Running;
  try {
    auto res = step_fn_(current_step_);
    current_step_++;
    if (current_step_ >= total_steps_ || res.is_done) {
      state_ = CoroutineState::Completed;
      res.is_done = true;
    } else {
      state_ = CoroutineState::Suspended;
    }
    return res;
  } catch (const std::exception& ex) {
    state_ = CoroutineState::Failed;
    return { CoroutineState::Failed, false, true, ex.what() };
  } catch (...) {
    state_ = CoroutineState::Failed;
    return { CoroutineState::Failed, false, true, "Unknown exception in coroutine step" };
  }
}

void FiberCoroutine::Reset() {
  current_step_ = 0;
  state_ = CoroutineState::Suspended;
}

// ============================================================================
// CoroutineScheduler Implementation
// ============================================================================

CoroutineScheduler::CoroutineScheduler(size_t worker_thread_count) {
  for (size_t i = 0; i < worker_thread_count; ++i) {
    workers_.emplace_back(&CoroutineScheduler::WorkerLoop, this);
  }
}

CoroutineScheduler::~CoroutineScheduler() {
  stop_flag_.store(true);
  cv_.notify_all();
  for (auto& worker : workers_) {
    if (worker.joinable()) {
      worker.join();
    }
  }
}

void CoroutineScheduler::WorkerLoop() {
  while (!stop_flag_.load()) {
    std::function<void()> task;
    {
      std::unique_lock<std::mutex> lock(queue_mutex_);
      cv_.wait(lock, [this]() {
        return stop_flag_.load() || !task_queue_.empty();
      });
      if (stop_flag_.load() && task_queue_.empty()) {
        return;
      }
      task = std::move(task_queue_.front());
      task_queue_.pop();
    }
    if (task) {
      task();
    }
  }
}

void CoroutineScheduler::RegisterCoroutine(std::shared_ptr<FiberCoroutine> coroutine) {
  std::lock_guard<std::mutex> lock(coroutines_mutex_);
  coroutines_.push_back(std::move(coroutine));
}

std::shared_ptr<FiberCoroutine> CoroutineScheduler::GetCoroutine(const std::string& name) {
  std::lock_guard<std::mutex> lock(coroutines_mutex_);
  for (const auto& c : coroutines_) {
    if (c->GetName() == name) {
      return c;
    }
  }
  return nullptr;
}

CoroutineYieldResult CoroutineScheduler::StepCoroutine(const std::string& name) {
  auto coro = GetCoroutine(name);
  if (!coro) {
    return { CoroutineState::Failed, false, true, "Coroutine not found: " + name };
  }
  return coro->Step();
}

std::vector<CoroutineYieldResult> CoroutineScheduler::RunToCompletion(const std::string& name) {
  std::vector<CoroutineYieldResult> history;
  auto coro = GetCoroutine(name);
  if (!coro) {
    return history;
  }

  while (coro->GetState() != CoroutineState::Completed && coro->GetState() != CoroutineState::Failed) {
    auto res = coro->Step();
    history.push_back(res);
    if (res.is_done) {
      break;
    }
  }
  return history;
}

std::vector<WorkerExecutionRecord> CoroutineScheduler::DispatchParallelAll(
    const std::vector<std::pair<std::string, std::function<void()>>>& tasks) {
  if (tasks.empty()) {
    return {};
  }

  struct SyncBatch {
    std::mutex mtx;
    std::condition_variable cv;
    size_t remaining{0};
    std::vector<WorkerExecutionRecord> records;
  };

  auto sync = std::make_shared<SyncBatch>();
  sync->remaining = tasks.size();

  {
    std::lock_guard<std::mutex> lock(queue_mutex_);
    for (const auto& [name, fn] : tasks) {
      task_queue_.push([sync, name, fn]() {
        auto start = std::chrono::steady_clock::now();
        WorkerExecutionRecord rec;
        rec.task_name = name;
        rec.thread_id = std::this_thread::get_id();
        try {
          fn();
          rec.success = true;
        } catch (const std::exception& e) {
          rec.success = false;
          rec.error_message = e.what();
        } catch (...) {
          rec.success = false;
          rec.error_message = "Unknown exception in parallel task execution";
        }
        auto finish = std::chrono::steady_clock::now();
        rec.duration_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(finish - start).count();

        {
          std::lock_guard<std::mutex> sync_lock(sync->mtx);
          sync->records.push_back(rec);
          sync->remaining--;
          if (sync->remaining == 0) {
            sync->cv.notify_one();
          }
        }
      });
    }
  }

  // Wake up worker threads
  cv_.notify_all();

  // Wait for all parallel tasks to finish
  {
    std::unique_lock<std::mutex> sync_lock(sync->mtx);
    sync->cv.wait(sync_lock, [&sync]() {
      return sync->remaining == 0;
    });
  }

  {
    std::lock_guard<std::mutex> rec_lock(records_mutex_);
    last_records_ = sync->records;
  }

  return sync->records;
}

std::vector<WorkerExecutionRecord> CoroutineScheduler::GetLastExecutionRecords() const {
  std::lock_guard<std::mutex> rec_lock(records_mutex_);
  return last_records_;
}

// ============================================================================
// CoroutineHostObject Implementation
// ============================================================================

CoroutineHostObject::CoroutineHostObject(std::shared_ptr<CoroutineScheduler> scheduler)
    : scheduler_(std::move(scheduler)) {}

JsiValueVariant CoroutineHostObject::GetProperty(const std::string& name) {
  if (name == "workerCount") {
    return static_cast<int64_t>(scheduler_ ? scheduler_->GetActiveWorkerCount() : 0);
  }
  return false;
}

void CoroutineHostObject::SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) {
  // Read-only Coroutine HostObject interface
}

std::vector<std::string> CoroutineHostObject::GetPropertyNames() const {
  return {"workerCount", "step", "runAll", "dispatchParallel"};
}

JsiValueVariant CoroutineHostObject::InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) {
  if (name == "step" && !args.empty() && std::holds_alternative<std::string>(args[0])) {
    std::string coro_name = std::get<std::string>(args[0]);
    auto res = scheduler_->StepCoroutine(coro_name);
    if (res.state == CoroutineState::Completed) {
      return std::string("DONE");
    }
    if (std::holds_alternative<std::string>(res.value)) {
      return std::get<std::string>(res.value);
    }
    if (std::holds_alternative<int64_t>(res.value)) {
      return std::get<int64_t>(res.value);
    }
    return true;
  }

  if (name == "runAll" && !args.empty() && std::holds_alternative<std::string>(args[0])) {
    std::string coro_name = std::get<std::string>(args[0]);
    auto steps = scheduler_->RunToCompletion(coro_name);
    return static_cast<int64_t>(steps.size());
  }

  return false;
}

} // namespace lynxfita
