#pragma once

#include "lynxfita/cordis_native_context.h"
#include <string>
#include <memory>
#include <unordered_map>
#include <functional>

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
using NativeLibHandle = HMODULE;
#else
#include <dlfcn.h>
using NativeLibHandle = void*;
#endif

namespace lynxfita {

using WeatherSimdComputeFn = int (*)(float* dma_buffer, size_t count, float solar_flux);
using WeatherSimdVersionFn = int (*)();
using WeatherSimdAdvectionFn = float (*)(float temp, float wind, float pressure);

class NativeFfiLoader : public cordis::NativeService {
 public:
  NativeFfiLoader();
  ~NativeFfiLoader() override;

  // Load a dynamic library from file path, binding its unload disposer to fiber
  bool LoadPlugin(const std::string& path, std::shared_ptr<cordis::NativeFiber> fiber = nullptr);

  // Unload loaded plugin library
  bool UnloadPlugin();

  bool IsLoaded() const { return handle_ != nullptr; }
  const std::string& GetLoadedPath() const { return loaded_path_; }

  // Generic symbol lookup
  void* GetSymbol(const std::string& symbol_name) const;

  // Typed bindings for lynxfita_weather_simd_plugin
  int GetPluginVersion() const;
  int ExecuteWeatherSimd(float* dma_buffer, size_t count, float solar_flux) const;
  float ComputeAdvection(float temp, float wind, float pressure) const;

  void OnDetach(cordis::NativeContext& ctx, cordis::NativeFiber& fiber) override;

 private:
  NativeLibHandle handle_{nullptr};
  std::string loaded_path_;
  WeatherSimdVersionFn fn_version_{nullptr};
  WeatherSimdComputeFn fn_compute_{nullptr};
  WeatherSimdAdvectionFn fn_advection_{nullptr};
};

} // namespace lynxfita
