#pragma once

#include "lynxfita/jsi_types.h"
#include <functional>
#include <memory>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <atomic>

namespace lynxfita {

enum class CoroutineState {
  Suspended,
  Running,
  Completed,
  Failed
};

struct CoroutineYieldResult {
  CoroutineState state;
  JsiValueVariant value;
  bool is_done;
  std::string error_message;
};

// Represents a non-colored fiber coroutine task executed step-by-step
class FiberCoroutine {
 public:
  using StepFn = std::function<CoroutineYieldResult(size_t step_index)>;

  FiberCoroutine(std::string name, size_t total_steps, StepFn step_fn);
  ~FiberCoroutine() = default;

  const std::string& GetName() const { return name_; }
  CoroutineState GetState() const { return state_; }
  size_t GetCurrentStep() const { return current_step_; }
  size_t GetTotalSteps() const { return total_steps_; }

  // Execute the next step up to the next yield
  CoroutineYieldResult Step();
  void Reset();

 private:
  std::string name_;
  size_t total_steps_;
  StepFn step_fn_;
  size_t current_step_{0};
  CoroutineState state_{CoroutineState::Suspended};
};

// Scheduler managing worker threads for executing coroutines without a Global Interpreter Lock (GIL)
class CoroutineScheduler {
 public:
  explicit CoroutineScheduler(size_t worker_thread_count = 4);
  ~CoroutineScheduler();

  void RegisterCoroutine(std::shared_ptr<FiberCoroutine> coroutine);
  std::shared_ptr<FiberCoroutine> GetCoroutine(const std::string& name);

  // Synchronously step a coroutine
  CoroutineYieldResult StepCoroutine(const std::string& name);

  // Run a coroutine to completion across native worker threads without GIL
  std::vector<CoroutineYieldResult> RunToCompletion(const std::string& name);

  size_t GetActiveWorkerCount() const { return workers_.size(); }

 private:
  std::vector<std::shared_ptr<FiberCoroutine>> coroutines_;
  mutable std::mutex coroutines_mutex_;
  std::vector<std::thread> workers_;
  std::queue<std::function<void()>> task_queue_;
  mutable std::mutex queue_mutex_;
  std::condition_variable cv_;
  std::atomic<bool> stop_flag_{false};

  void WorkerLoop();
};

// JSI HostObject exposing Iterator / yield semantics to JS
class CoroutineHostObject : public HostObject {
 public:
  explicit CoroutineHostObject(std::shared_ptr<CoroutineScheduler> scheduler);
  ~CoroutineHostObject() override = default;

  std::string GetName() const override { return "CoroutineScheduler"; }
  JsiValueVariant GetProperty(const std::string& name) override;
  void SetProperty(const std::string& name, const JsiValueVariant& value) override;
  std::vector<std::string> GetPropertyNames() const override;
  JsiValueVariant InvokeMethod(const std::string& name, const std::vector<JsiValueVariant>& args) override;

 private:
  std::shared_ptr<CoroutineScheduler> scheduler_;
};

} // namespace lynxfita
