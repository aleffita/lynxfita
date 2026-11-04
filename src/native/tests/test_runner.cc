#include "lynxfita/hermes_runtime_adapter.h"
#include "lynxfita/legacy_bridge_interceptor.h"
#include "lynxfita/wasi_host_module.h"

#include <iostream>
#include <cassert>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>

using namespace lynxfita;

void TestHermesRuntimeAdapter() {
  std::cout << "[RUN] TestHermesRuntimeAdapter..." << std::endl;
  HermesRuntimeAdapter adapter;
  assert(adapter.Initialize(false));
  assert(adapter.GetRuntimeType() == RuntimeType::HermesAOT);

  // Register host function
  bool reg_fn = adapter.RegisterHostFunction("computeSha", [](const std::vector<JsiValueVariant>& args) -> JsiValueVariant {
    return std::string("hash_computed");
  });
  assert(reg_fn);

  // Evaluate Bytecode with magic bytes \x1fHBC
  const uint8_t valid_hbc[] = {0x1F, 'H', 'B', 'C', 0x01, 0x02, 0x03, 0x04};
  auto eval_res = adapter.EvaluateBytecode(valid_hbc, sizeof(valid_hbc), "app.hbc");
  assert(eval_res.IsSuccess());
  assert(eval_res.result_payload.find("Hermes Bytecode Loaded") != std::string::npos);

  // Bytecode empty test
  auto empty_res = adapter.EvaluateBytecode(nullptr, 0, "empty.hbc");
  assert(!empty_res.IsSuccess());
  assert(empty_res.status == StatusCode::InvalidArgument);

  adapter.Teardown();
  std::cout << "  [PASS] TestHermesRuntimeAdapter succeeded." << std::endl;
}

void TestLegacyBridgeInterceptor() {
  std::cout << "[RUN] TestLegacyBridgeInterceptor..." << std::endl;
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();

  assert(interceptor->GetName() == "spkPipe");

  // Register native method in interceptor
  interceptor->RegisterNativeMethod("storage", "getItem", [](const std::vector<JsiValueVariant>& params) -> JsiValueVariant {
    if (params.empty() || !std::holds_alternative<std::string>(params[0])) {
      return std::string("");
    }
    std::string key = std::get<std::string>(params[0]);
    return "val_for_" + key;
  });

  assert(interceptor->HasRegisteredMethod("storage", "getItem"));
  assert(!interceptor->HasRegisteredMethod("storage", "nonExistent"));

  // Direct JSI invocation via InvokeMethod
  std::vector<JsiValueVariant> call_args = {
    std::string("storage"),
    std::string("getItem"),
    std::string("session_token")
  };
  auto result_val = interceptor->InvokeMethod("call", call_args);
  assert(std::holds_alternative<std::string>(result_val));
  assert(std::get<std::string>(result_val) == "val_for_session_token");

  // Verify direct dispatch counter incremented
  assert(interceptor->GetDirectJsiDispatches() == 1);
  assert(interceptor->GetLegacyJsonDispatches() == 0);
  assert(interceptor->GetBypassRatio() == 1.0);

  // Test legacy JSON bridge fallback
  auto json_res = interceptor->DispatchLegacyJson("storage", "getItem", "{\"key\":\"session_token\"}");
  assert(json_res.IsSuccess());
  assert(interceptor->GetLegacyJsonDispatches() == 1);
  assert(interceptor->GetBypassRatio() == 0.5);

  std::cout << "  [PASS] TestLegacyBridgeInterceptor succeeded." << std::endl;
}

void TestWasiHostModule() {
  std::cout << "[RUN] TestWasiHostModule..." << std::endl;
  WasiCapabilities caps;
  caps.allow_filesystem = false;
  caps.memory_limit_bytes = 16 * 1024 * 1024;

  auto wasi = std::make_shared<WasiHostModule>("crypto_subsystem", caps);
  assert(wasi->GetName() == "crypto_subsystem");

  // Test WASM binary loading
  const uint8_t valid_wasm[] = {0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00};
  assert(wasi->LoadWasmBinary(valid_wasm, sizeof(valid_wasm)));

  const uint8_t invalid_wasm[] = {0x01, 0x02, 0x03, 0x04};
  assert(!wasi->LoadWasmBinary(invalid_wasm, sizeof(invalid_wasm)));

  // Register WASI export
  wasi->RegisterExport("sign_payload", [](const std::vector<JsiValueVariant>& args) -> JsiValueVariant {
    return std::string("sig_0xdeadbeef");
  });

  auto exec_res = wasi->Execute("sign_payload", {});
  assert(exec_res.IsSuccess());
  assert(exec_res.result_payload == "sig_0xdeadbeef");

  // Test missing export
  auto missing_res = wasi->Execute("unknown_fn", {});
  assert(!missing_res.IsSuccess());
  assert(missing_res.status == StatusCode::MethodNotFound);

  std::cout << "  [PASS] TestWasiHostModule succeeded." << std::endl;
}

void TestBridgePerformanceBenchmark() {
  std::cout << "[RUN] TestBridgePerformanceBenchmark (JSI direct vs JSON bridge)..." << std::endl;
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();

  interceptor->RegisterNativeMethod("telemetry", "recordMetric", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return std::string("recorded");
  });

  const int iterations = 10000;

  // Measure Direct JSI
  auto t0 = std::chrono::steady_clock::now();
  for (int i = 0; i < iterations; ++i) {
    interceptor->DispatchDirectJsi("telemetry", "recordMetric", { static_cast<int64_t>(i) });
  }
  auto t1 = std::chrono::steady_clock::now();
  auto jsi_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();

  // Measure Legacy JSON bridge
  std::string simulated_json = "{\"timestamp\":1730000000,\"metric\":\"cpu_load\",\"value\":42.5,\"tags\":[\"lynx\",\"desktop\"]}";
  auto t2 = std::chrono::steady_clock::now();
  for (int i = 0; i < iterations; ++i) {
    interceptor->DispatchLegacyJson("telemetry", "recordMetric", simulated_json);
  }
  auto t3 = std::chrono::steady_clock::now();
  auto json_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(t3 - t2).count();

  double jsi_per_call = static_cast<double>(jsi_time_ns) / iterations;
  double json_per_call = static_cast<double>(json_time_ns) / iterations;

  std::cout << "  Direct JSI: " << jsi_per_call << " ns/op (" << (1e9 / jsi_per_call) << " ops/sec)" << std::endl;
  std::cout << "  JSON Bridge: " << json_per_call << " ns/op (" << (1e9 / json_per_call) << " ops/sec)" << std::endl;
  std::cout << "  Speedup: " << (json_per_call / jsi_per_call) << "x" << std::endl;

  assert(interceptor->GetDirectJsiDispatches() == iterations);
  assert(interceptor->GetLegacyJsonDispatches() == iterations);
  std::cout << "  [PASS] TestBridgePerformanceBenchmark succeeded." << std::endl;
}

void TestThreadSafety() {
  std::cout << "[RUN] TestThreadSafety (concurrency dispatch)..." << std::endl;
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();

  interceptor->RegisterNativeMethod("concurrent", "ping", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return std::string("pong");
  });

  const int threads_count = 8;
  const int calls_per_thread = 2000;
  std::vector<std::thread> workers;

  for (int t = 0; t < threads_count; ++t) {
    workers.emplace_back([&interceptor, calls_per_thread]() {
      for (int i = 0; i < calls_per_thread; ++i) {
        interceptor->DispatchDirectJsi("concurrent", "ping", {});
      }
    });
  }

  for (auto& w : workers) {
    w.join();
  }

  assert(interceptor->GetDirectJsiDispatches() == (threads_count * calls_per_thread));
  std::cout << "  [PASS] TestThreadSafety succeeded with " << interceptor->GetDirectJsiDispatches() << " dispatches." << std::endl;
}

int main() {
  std::cout << "=========================================================" << std::endl;
  std::cout << "   LynxFita Native C++ JSI & Architecture Test Suite     " << std::endl;
  std::cout << "=========================================================" << std::endl;

  TestHermesRuntimeAdapter();
  TestLegacyBridgeInterceptor();
  TestWasiHostModule();
  TestBridgePerformanceBenchmark();
  TestThreadSafety();

  std::cout << "=========================================================" << std::endl;
  std::cout << "   ALL NATIVE TESTS PASSED SUCCESSFULLY!                 " << std::endl;
  std::cout << "=========================================================" << std::endl;
  return 0;
}
