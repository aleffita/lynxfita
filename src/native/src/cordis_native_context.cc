#include "lynxfita/cordis_native_context.h"
#include <iostream>

namespace lynxfita {
namespace cordis {

NativeFiber::NativeFiber(std::string id, std::shared_ptr<NativeContext> ctx)
    : id_(std::move(id)), context_(std::move(ctx)) {}

NativeFiber::~NativeFiber() {
  Unload();
}

void NativeFiber::RegisterEffect(std::function<void()> disposer) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (unloaded_) {
    throw std::runtime_error("Cannot register effect on unloaded NativeFiber: " + id_);
  }
  if (disposer) {
    disposers_.push_back(std::move(disposer));
  }
}

void NativeFiber::Unload() {
  std::vector<std::function<void()>> to_unwind;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (unloaded_) {
      return;
    }
    unloaded_ = true;
    to_unwind.swap(disposers_);
  }

  // Execute disposers in reverse order (LIFO)
  for (auto it = to_unwind.rbegin(); it != to_unwind.rend(); ++it) {
    try {
      if (*it) {
        (*it)();
      }
    } catch (const std::exception& e) {
      std::cerr << "[NativeFiber " << id_ << "] Warning: error during effect disposer unwind: " << e.what() << std::endl;
    } catch (...) {
      std::cerr << "[NativeFiber " << id_ << "] Warning: unknown error during effect disposer unwind" << std::endl;
    }
  }
}

size_t NativeFiber::GetDisposerCount() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return disposers_.size();
}

// ============================================================================
// NativeContext Implementation
// ============================================================================

NativeContext::~NativeContext() {
  Unload();
}

std::shared_ptr<NativeContext> NativeContext::Isolate() {
  return std::make_shared<NativeContext>(shared_from_this());
}

std::shared_ptr<NativeFiber> NativeContext::CreateFiber(const std::string& fiber_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto fiber = std::make_shared<NativeFiber>(fiber_id, shared_from_this());
  fibers_.push_back(fiber);
  return fiber;
}

bool NativeContext::ProvideService(std::shared_ptr<NativeService> service, std::shared_ptr<NativeFiber> fiber) {
  if (!service) {
    return false;
  }

  const std::string& name = service->GetName();

  // Validate coeffects
  for (const auto& req : service->GetInjectCoeffects()) {
    if (!HasService(req)) {
      std::cerr << "[NativeContext] Cannot provide service '" << name << "': missing required coeffect '" << req << "'" << std::endl;
      return false;
    }
  }

  {
    std::lock_guard<std::mutex> lock(mutex_);
    services_[name] = service;
  }

  if (fiber) {
    service->OnAttach(*this, *fiber);
    fiber->RegisterEffect([service, name, this, fiber]() {
      service->OnDetach(*this, *fiber);
      std::lock_guard<std::mutex> lock(mutex_);
      services_.erase(name);
    });
  }

  return true;
}

std::shared_ptr<NativeService> NativeContext::GetService(const std::string& name) const {
  std::lock_guard<std::mutex> lock(mutex_);
  auto it = services_.find(name);
  if (it != services_.end()) {
    return it->second;
  }
  if (parent_) {
    return parent_->GetService(name);
  }
  return nullptr;
}

bool NativeContext::HasService(const std::string& name) const {
  return GetService(name) != nullptr;
}

void NativeContext::Unload() {
  std::vector<std::shared_ptr<NativeFiber>> fibers_to_unload;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    fibers_to_unload.swap(fibers_);
  }

  // Unload all fibers in LIFO order
  for (auto it = fibers_to_unload.rbegin(); it != fibers_to_unload.rend(); ++it) {
    if (*it) {
      (*it)->Unload();
    }
  }

  std::lock_guard<std::mutex> lock(mutex_);
  services_.clear();
}

size_t NativeContext::GetServiceCount() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return services_.size();
}

size_t NativeContext::GetFiberCount() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return fibers_.size();
}

} // namespace cordis
} // namespace lynxfita
