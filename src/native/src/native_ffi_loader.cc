#include "lynxfita/native_ffi_loader.h"
#include <iostream>
#include <vector>

namespace lynxfita {

NativeFfiLoader::NativeFfiLoader()
    : cordis::NativeService("ffi", {}) {}

NativeFfiLoader::~NativeFfiLoader() {
  UnloadPlugin();
}

bool NativeFfiLoader::LoadPlugin(const std::string& path, std::shared_ptr<cordis::NativeFiber> fiber) {
  if (handle_) {
    UnloadPlugin();
  }

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
  int wide_len = MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, nullptr, 0);
  if (wide_len <= 0) {
    return false;
  }
  std::vector<wchar_t> wide_buf(wide_len);
  MultiByteToWideChar(CP_UTF8, 0, path.c_str(), -1, wide_buf.data(), wide_len);

  handle_ = LoadLibraryExW(wide_buf.data(), nullptr, LOAD_WITH_ALTERED_SEARCH_PATH);
  if (!handle_) {
    // Fallback to standard LoadLibraryW
    handle_ = LoadLibraryW(wide_buf.data());
  }
#else
  handle_ = dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
#endif

  if (!handle_) {
    std::cerr << "[NativeFfiLoader] Failed to load library: " << path << std::endl;
    return false;
  }

  loaded_path_ = path;

  // Resolve typed symbols if this is the weather SIMD plugin
  fn_version_ = reinterpret_cast<WeatherSimdVersionFn>(GetSymbol("weather_simd_version"));
  fn_compute_ = reinterpret_cast<WeatherSimdComputeFn>(GetSymbol("weather_simd_compute"));
  fn_advection_ = reinterpret_cast<WeatherSimdAdvectionFn>(GetSymbol("weather_simd_advection"));

  // Bind unload disposer to Cordis Fiber if provided
  if (fiber) {
    fiber->RegisterEffect([this]() {
      UnloadPlugin();
    });
  }

  return true;
}

bool NativeFfiLoader::UnloadPlugin() {
  if (!handle_) {
    return true;
  }

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
  FreeLibrary(handle_);
#else
  dlclose(handle_);
#endif

  handle_ = nullptr;
  loaded_path_.clear();
  fn_version_ = nullptr;
  fn_compute_ = nullptr;
  fn_advection_ = nullptr;
  return true;
}

void* NativeFfiLoader::GetSymbol(const std::string& symbol_name) const {
  if (!handle_) {
    return nullptr;
  }
#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
  return reinterpret_cast<void*>(GetProcAddress(handle_, symbol_name.c_str()));
#else
  return dlsym(handle_, symbol_name.c_str());
#endif
}

int NativeFfiLoader::GetPluginVersion() const {
  if (fn_version_) {
    return fn_version_();
  }
  return 0;
}

int NativeFfiLoader::ExecuteWeatherSimd(float* dma_buffer, size_t count, float solar_flux) const {
  if (fn_compute_) {
    return fn_compute_(dma_buffer, count, solar_flux);
  }
  return -1;
}

float NativeFfiLoader::ComputeAdvection(float temp, float wind, float pressure) const {
  if (fn_advection_) {
    return fn_advection_(temp, wind, pressure);
  }
  return 0.0f;
}

void NativeFfiLoader::OnDetach(cordis::NativeContext&, cordis::NativeFiber&) {
  UnloadPlugin();
}

} // namespace lynxfita
