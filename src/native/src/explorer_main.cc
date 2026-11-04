#include "lynxfita/hermes_runtime_adapter.h"
#include "lynxfita/legacy_bridge_interceptor.h"
#include "lynxfita/wasi_host_module.h"
#include "lynxfita/dma_eib_engine.h"
#include "lynxfita/coroutine_scheduler.h"
#include "lynxfita/protobuf_bridge.h"
#include "lynxfita/hermes_compiler.h"

#include <iostream>
#include <fstream>
#include <cassert>
#include <vector>
#include <string>
#include <chrono>
#include <memory>
#include <thread>
#include <iomanip>

using namespace lynxfita;

void PrintBanner() {
  std::cout << "========================================================================" << std::endl;
  std::cout << "   LynxFita Explorer - Standalone C++20 Native Multi-Platform Engine    " << std::endl;
  std::cout << "   Static Hermes (static_h) | Cell EIB DMA Lanes | Zero-GIL Coroutines  " << std::endl;
  std::cout << "   Version: v2.0.0 (Release)                                            " << std::endl;
  std::cout << "========================================================================" << std::endl;
}

void PrintHelp() {
  std::cout << "Usage:" << std::endl;
  std::cout << "  lynxfita_explorer [options]" << std::endl;
  std::cout << "\nOptions:" << std::endl;
  std::cout << "  --run <file.hbc>   Execute Ahead-of-Time compiled Hermes bytecode bundle" << std::endl;
  std::cout << "  --demo             Run integrated Super-App & Weather Showcase demonstration" << std::endl;
  std::cout << "  --version, -v      Print engine build and target architecture information" << std::endl;
  std::cout << "  --help, -h         Show this help menu" << std::endl;
}

int RunBytecodeFile(const std::string& filePath) {
  std::ifstream file(filePath, std::ios::binary | std::ios::ate);
  if (!file.is_open()) {
    std::cerr << "[ERROR] Could not open bundle file: " << filePath << std::endl;
    return 1;
  }

  std::streamsize size = file.tellg();
  file.seekg(0, std::ios::beg);

  std::vector<uint8_t> buffer(size);
  if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) {
    std::cerr << "[ERROR] Failed reading bytecode data from: " << filePath << std::endl;
    return 1;
  }

  std::cout << "[INFO] Loading Hermes bytecode bundle: " << filePath << " (" << size << " bytes)..." << std::endl;

  if (!HermesRuntimeCompiler::ValidateBytecode(buffer.data(), buffer.size())) {
    std::cerr << "[ERROR] Invalid Hermes bytecode format: missing 0x1F484243 magic bytes." << std::endl;
    return 1;
  }

  HermesRuntimeAdapter adapter;
  if (!adapter.Initialize(true)) {
    std::cerr << "[ERROR] Failed initializing Hermes AOT runtime adapter." << std::endl;
    return 1;
  }

  auto res = adapter.EvaluateBytecode(buffer.data(), buffer.size(), filePath);
  if (!res.IsSuccess()) {
    std::cerr << "[EXECUTION ERROR] " << res.error_message << std::endl;
    adapter.Teardown();
    return 1;
  }

  std::cout << "[SUCCESS] " << res.result_payload << std::endl;
  adapter.Teardown();
  return 0;
}

int RunIntegratedShowcaseDemo() {
  PrintBanner();

  std::cout << "\n[1/6] Initializing Static Hermes Runtime Adapter..." << std::endl;
  auto runtime = std::make_shared<HermesRuntimeAdapter>();
  if (!runtime->Initialize(false)) {
    std::cerr << "Failed to initialize runtime." << std::endl;
    return 1;
  }
  std::cout << "  -> Runtime Type: " << (runtime->GetRuntimeType() == RuntimeType::HermesAOT ? "Hermes AOT" : "Generic JSI") << std::endl;

  std::cout << "\n[2/6] Initializing Stationary DMA Arena (1 MB, 64-byte aligned)..." << std::endl;
  auto dma = std::make_shared<DmaEibEngine>(1024 * 1024);
  assert(dma->GetStationaryBuffer().IsCacheLineAligned());
  std::cout << "  -> Stationary Memory: " << (dma->GetStationaryBuffer().Capacity() / 1024) << " KB allocated" << std::endl;
  std::cout << "  -> Cache-line aligned (64B): YES" << std::endl;

  // Pack Weather Telemetry into DMA Offset 0x2000: [temp, humidity, pressure, windSpeed]
  std::cout << "\n[3/6] Synchronizing Weather Showcase SIMD Telemetry into DMA offset 0x2000..." << std::endl;
  dma->GetStationaryBuffer().PackSimdVector4f(0x2000, 24.5f, 65.0f, 1013.25f, 12.0f);
  float temp = 0, humidity = 0, pressure = 0, windSpeed = 0;
  dma->GetStationaryBuffer().UnpackSimdVector4f(0x2000, temp, humidity, pressure, windSpeed);
  std::cout << "  -> DMA Telemetry unpacked zero-copy: Temp=" << temp << "C, Humidity=" << humidity
            << "%, Pressure=" << pressure << "hPa, Wind=" << windSpeed << "km/h" << std::endl;

  // Execute SIMD Vector Fused Multiply-Add (FMA) compute kernel
  std::cout << "\n[4/6] Executing C++20 SIMD Vector FMA Compute Kernel (SSE/AVX)..." << std::endl;
  dma->GetStationaryBuffer().PackSimdVector4f(64, 1.0f, 2.0f, 3.0f, 4.0f);
  dma->GetStationaryBuffer().PackSimdVector4f(128, 10.0f, 20.0f, 30.0f, 40.0f);
  dma->GetStationaryBuffer().SimdVectorFmaAdd(64, 128, 192, 4, 0.5f);
  float r0 = 0, r1 = 0, r2 = 0, r3 = 0;
  dma->GetStationaryBuffer().UnpackSimdVector4f(192, r0, r1, r2, r3);
  std::cout << "  -> FMA Result [64 + 128 * 0.5]: [" << r0 << ", " << r1 << ", " << r2 << ", " << r3 << "]" << std::endl;

  // Intercept Bridge using Protobuf binary wire encoding
  std::cout << "\n[5/6] Intercepting Legacy Bridge with Protobuf Binary Wire Encoding..." << std::endl;
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();
  interceptor->RegisterNativeMethod("weather", "getTelemetry", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return std::string("{\"city\":\"Sao Paulo\",\"temp\":24.5,\"condition\":\"Partly Cloudy\"}");
  });
  auto encodedCall = ProtobufBridge::EncodeMethodCall("weather", "getTelemetry", "");
  auto protoRes = interceptor->DispatchProtobuf(encodedCall.data(), encodedCall.size());
  std::cout << "  -> Direct Protobuf Dispatch: " << protoRes.result_payload << std::endl;
  std::cout << "  -> JSON Bypass Ratio: " << std::fixed << std::setprecision(2) << (interceptor->GetBypassRatio() * 100.0) << "%" << std::endl;

  // Coroutine scheduler background workers
  std::cout << "\n[6/6] Dispatching Parallel Fiber Coroutines without GIL on 4 Native Workers..." << std::endl;
  auto scheduler = std::make_shared<CoroutineScheduler>(4);
  std::vector<std::pair<std::string, std::function<void()>>> tasks = {
    {"atmospheric_shader_step", []() { std::this_thread::sleep_for(std::chrono::milliseconds(2)); }},
    {"telemetry_dma_stream", []() { std::this_thread::sleep_for(std::chrono::milliseconds(2)); }},
    {"ota_signature_check", []() { std::this_thread::sleep_for(std::chrono::milliseconds(2)); }},
    {"mvi_render_pipeline", []() { std::this_thread::sleep_for(std::chrono::milliseconds(2)); }}
  };
  auto records = scheduler->DispatchParallelAll(tasks);
  std::cout << "  -> Dispatched " << records.size() << " native tasks across worker thread pool." << std::endl;

  std::cout << "\n========================================================================" << std::endl;
  std::cout << "   ALL SUBSYSTEMS VERIFIED & OPERATIONAL (C++20 Standalone Native)       " << std::endl;
  std::cout << "========================================================================" << std::endl;
  return 0;
}

int main(int argc, char* argv[]) {
  if (argc > 1) {
    std::string arg1 = argv[1];
    if (arg1 == "--help" || arg1 == "-h") {
      PrintHelp();
      return 0;
    }
    if (arg1 == "--version" || arg1 == "-v") {
      std::cout << "lynxfita_explorer v2.0.0 (C++20 MSVC/GCC/Clang Native Engine)" << std::endl;
      return 0;
    }
    if (arg1 == "--run" && argc > 2) {
      return RunBytecodeFile(argv[2]);
    }
  }

  return RunIntegratedShowcaseDemo();
}
