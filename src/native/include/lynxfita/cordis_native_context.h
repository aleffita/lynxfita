#pragma once

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <unordered_map>
#include <mutex>
#include <stdexcept>

namespace lynxfita {
namespace cordis {

class NativeContext;
class NativeFiber;

// Base class for all endogenous C++20 Cordis Services
class NativeService : public std::enable_shared_from_this<NativeService> {
 public:
  explicit NativeService(std::string name, std::vector<std::string> inject_coeffects = {})
      : name_(std::move(name)), inject_coeffects_(std::move(inject_coeffects)) {}
  virtual ~NativeService() = default;

  const std::string& GetName() const { return name_; }
  const std::vector<std::string>& GetInjectCoeffects() const { return inject_coeffects_; }

  virtual void OnAttach(NativeContext& ctx, NativeFiber& fiber) {}
  virtual void OnDetach(NativeContext& ctx, NativeFiber& fiber) {}

 private:
  std::string name_;
  std::vector<std::string> inject_coeffects_;
};

// Fiber representing a bounded lifecycle unit with LIFO effect unwind
class NativeFiber : public std::enable_shared_from_this<NativeFiber> {
 public:
  explicit NativeFiber(std::string id, std::shared_ptr<NativeContext> ctx);
  ~NativeFiber();

  const std::string& GetId() const { return id_; }
  bool IsUnloaded() const { return unloaded_; }

  // Register a revertible effect whose disposer is executed during Fiber _unload()
  void RegisterEffect(std::function<void()> disposer);

  // Unload all registered effects in LIFO order (Temporal Inversion)
  void Unload();

  std::shared_ptr<NativeContext> GetContext() const { return context_.lock(); }
  size_t GetDisposerCount() const;

 private:
  std::string id_;
  std::weak_ptr<NativeContext> context_;
  std::vector<std::function<void()>> disposers_;
  mutable std::mutex mutex_;
  bool unloaded_{false};
};

// Unified native execution context
class NativeContext : public std::enable_shared_from_this<NativeContext> {
 public:
  NativeContext() = default;
  explicit NativeContext(std::shared_ptr<NativeContext> parent) : parent_(std::move(parent)) {}
  ~NativeContext();

  // Create an isolated child context
  std::shared_ptr<NativeContext> Isolate();

  // Create and attach a new Fiber
  std::shared_ptr<NativeFiber> CreateFiber(const std::string& fiber_id);

  // Register and provide a native service
  bool ProvideService(std::shared_ptr<NativeService> service, std::shared_ptr<NativeFiber> fiber = nullptr);

  // Lookup service by name, walking up to parent context if not found locally
  std::shared_ptr<NativeService> GetService(const std::string& name) const;

  template <typename T>
  std::shared_ptr<T> GetServiceAs(const std::string& name) const {
    return std::dynamic_pointer_cast<T>(GetService(name));
  }

  bool HasService(const std::string& name) const;

  // Unload all fibers in this context
  void Unload();

  size_t GetServiceCount() const;
  size_t GetFiberCount() const;

 private:
  std::shared_ptr<NativeContext> parent_{nullptr};
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::shared_ptr<NativeService>> services_;
  std::vector<std::shared_ptr<NativeFiber>> fibers_;
};

} // namespace cordis
} // namespace lynxfita
