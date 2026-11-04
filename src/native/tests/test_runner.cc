#include "lynxfita/hermes_runtime_adapter.h"
#include "lynxfita/legacy_bridge_interceptor.h"
#include "lynxfita/wasi_host_module.h"
#include "lynxfita/generated/native_sensor_spec.h"
#include "lynxfita/dma_eib_engine.h"
#include "lynxfita/coroutine_scheduler.h"
#include "lynxfita/protobuf_bridge.h"
#include "lynxfita/hermes_compiler.h"

#include <iostream>
#include <cassert>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <chrono>
#include <set>

using namespace lynxfita;

class MockHardwareSensor : public lynxfita::generated::NativeHardwareSensorSpec {
 public:
  double readTemperature(std::string sensorId) override {
    if (sensorId == "core_temp") return 42.5;
    return 20.0;
  }
  bool calibrate() override {
    return true;
  }
};

// Real C++20 Coroutine generator producing numbers using <coroutine> and co_yield
static CoroutineGenerator<int> FibonacciGenerator(int count) {
  int a = 0, b = 1;
  for (int i = 0; i < count; ++i) {
    co_yield a;
    int next = a + b;
    a = b;
    b = next;
  }
}

void TestHermesRuntimeAdapter() {
  std::cout << "[RUN] TestHermesRuntimeAdapter..." << std::endl;
  HermesRuntimeAdapter adapter;
  assert(adapter.Initialize(false));
  assert(adapter.GetRuntimeType() == RuntimeType::HermesAOT);

  // Register host function
  bool reg_fn = adapter.RegisterHostFunction("computeSha", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
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

void TestCodegenNativeModule() {
  std::cout << "[RUN] TestCodegenNativeModule (generated C++ spec)..." << std::endl;
  HermesRuntimeAdapter adapter;
  assert(adapter.Initialize(false));

  auto sensor = std::make_shared<MockHardwareSensor>();
  assert(sensor->GetName() == "HardwareSensor");
  assert(adapter.RegisterHostObject("HardwareSensor", sensor));

  // 1. Invoke typed readTemperature with string argument -> returns double
  auto temp_res = adapter.CallHostMethod("HardwareSensor", "readTemperature", { std::string("core_temp") });
  assert(temp_res.IsSuccess());
  assert(!temp_res.result_payload.empty());
  assert(temp_res.result_payload.find("42.5") != std::string::npos);

  // 2. Invoke calibrate -> returns bool
  auto cal_res = adapter.CallHostMethod("HardwareSensor", "calibrate", {});
  assert(cal_res.IsSuccess());
  assert(cal_res.result_payload == "true");

  // 3. Invoke readTemperature with invalid/missing arguments -> throws argument error
  auto err_res = adapter.CallHostMethod("HardwareSensor", "readTemperature", {});
  assert(!err_res.IsSuccess());
  assert(err_res.error_message.find("expected string") != std::string::npos);

  adapter.Teardown();
  std::cout << "  [PASS] TestCodegenNativeModule succeeded." << std::endl;
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
  caps.memory_limit_bytes = 1024 * 1024; // 1 MB limit

  auto wasi = std::make_shared<WasiHostModule>("crypto_subsystem", caps);
  assert(wasi->GetName() == "crypto_subsystem");

  // Test WASM binary loading
  const uint8_t valid_wasm[] = {0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00};
  assert(wasi->LoadWasmBinary(valid_wasm, sizeof(valid_wasm)));

  const uint8_t invalid_wasm[] = {0x01, 0x02, 0x03, 0x04};
  assert(!wasi->LoadWasmBinary(invalid_wasm, sizeof(invalid_wasm)));

  // Test linear memory read and write
  const uint8_t test_data[] = {0xAA, 0xBB, 0xCC, 0xDD};
  assert(wasi->WriteMemory(128, test_data, sizeof(test_data)));

  std::vector<uint8_t> read_data;
  assert(wasi->ReadMemory(128, sizeof(test_data), read_data));
  assert(read_data.size() == 4);
  assert(read_data[0] == 0xAA && read_data[3] == 0xDD);

  // Test memory limit boundary enforcement & integer overflow protection
  const uint8_t dummy[10] = {0};
  assert(!wasi->WriteMemory(caps.memory_limit_bytes + 1, dummy, sizeof(dummy)));
  assert(!wasi->WriteMemory(static_cast<size_t>(-5), dummy, sizeof(dummy)));
  std::vector<uint8_t> overflow_read;
  assert(!wasi->ReadMemory(static_cast<size_t>(-5), 10, overflow_read));

  // Register WASI export returning double / string
  wasi->RegisterExport("sign_payload", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return std::string("sig_0xdeadbeef");
  });
  wasi->RegisterExport("get_entropy", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return 0.9998;
  });

  auto exec_res = wasi->Execute("sign_payload", {});
  assert(exec_res.IsSuccess());
  assert(exec_res.result_payload == "sig_0xdeadbeef");

  auto entropy_res = wasi->Execute("get_entropy", {});
  assert(entropy_res.IsSuccess());
  assert(entropy_res.result_payload.find("0.9998") != std::string::npos);

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
  std::cout << "[RUN] TestThreadSafety (concurrent reads, writes, and dispatches)..." << std::endl;
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();

  interceptor->RegisterNativeMethod("concurrent", "ping", [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
    return std::string("pong");
  });

  const int reader_threads = 6;
  const int writer_threads = 2;
  const int calls_per_reader = 2000;
  const int registrations_per_writer = 50;
  std::vector<std::thread> workers;

  // Concurrent readers / dispatches
  for (int t = 0; t < reader_threads; ++t) {
    workers.emplace_back([&interceptor, calls_per_reader]() {
      for (int i = 0; i < calls_per_reader; ++i) {
        interceptor->DispatchDirectJsi("concurrent", "ping", {});
      }
    });
  }

  // Concurrent writers / registrations
  for (int w = 0; w < writer_threads; ++w) {
    workers.emplace_back([&interceptor, w, registrations_per_writer]() {
      for (int i = 0; i < registrations_per_writer; ++i) {
        std::string mod = "dyn_" + std::to_string(w);
        std::string meth = "fn_" + std::to_string(i);
        interceptor->RegisterNativeMethod(mod, meth, [](const std::vector<JsiValueVariant>&) -> JsiValueVariant {
          return true;
        });
      }
    });
  }

  for (auto& worker : workers) {
    worker.join();
  }

  assert(interceptor->GetDirectJsiDispatches() == (reader_threads * calls_per_reader));
  assert(interceptor->HasRegisteredMethod("dyn_0", "fn_0"));
  std::cout << "  [PASS] TestThreadSafety succeeded with " << interceptor->GetDirectJsiDispatches() << " dispatches under concurrent mutation." << std::endl;
}

void TestDmaEibEngine() {
  std::cout << "[RUN] TestDmaEibEngine (Stationary Memory, SIMD Vector Packing, and DMA Lanes)..." << std::endl;
  auto engine = std::make_shared<DmaEibEngine>(1024 * 1024); // 1 MB arena
  assert(engine->GetStationaryBuffer().Capacity() == 1024 * 1024);
  assert(engine->GetStationaryBuffer().IsCacheLineAligned());

  // 1. Pack SIMD 4-float vector into stationary buffer
  assert(engine->GetStationaryBuffer().PackSimdVector4f(0, 1.5f, 2.5f, 3.5f, 4.5f));
  float x = 0, y = 0, z = 0, w = 0;
  assert(engine->GetStationaryBuffer().UnpackSimdVector4f(0, x, y, z, w));
  assert(x == 1.5f && y == 2.5f && z == 3.5f && w == 4.5f);

  // 2. Real SIMD Vector Fused Multiply-Add (FMA) test: dst = a + b * scale
  assert(engine->GetStationaryBuffer().PackSimdVector4f(64, 10.0f, 20.0f, 30.0f, 40.0f));
  assert(engine->GetStationaryBuffer().PackSimdVector4f(128, 2.0f, 3.0f, 4.0f, 5.0f));
  // 64 + 128 * 0.5 = [11.0, 21.5, 32.0, 42.5] stored at offset 192
  assert(engine->GetStationaryBuffer().SimdVectorFmaAdd(64, 128, 192, 4, 0.5f));
  float f0 = 0, f1 = 0, f2 = 0, f3 = 0;
  assert(engine->GetStationaryBuffer().UnpackSimdVector4f(192, f0, f1, f2, f3));
  assert(f0 == 11.0f && f1 == 21.5f && f2 == 32.0f && f3 == 42.5f);

  // 3. Setup bidirectional DMA channel
  assert(engine->CreateChannel(1, DmaLaneDirection::Bidirectional));
  assert(!engine->CreateChannel(1, DmaLaneDirection::Bidirectional)); // Duplicate rejected
  auto ch = engine->GetChannel(1);
  assert(ch != nullptr);
  assert(ch->GetId() == 1);

  // 4. Execute zero-copy DMA transfer across EIB concentric dual-rings
  DmaTransferRequest req;
  req.channel_id = 1;
  req.source_offset = 0;
  req.destination_offset = 256;
  req.byte_count = 16; // 4 floats
  req.is_simd_vector_aligned = true;

  auto res = engine->ExecuteTransfer(req);
  assert(res.success);
  assert(res.bytes_transferred == 16);
  assert(res.ring_hops >= 1);
  assert(engine->GetTotalTransfers() == 1);
  assert(engine->GetTotalBytesTransferred() == 16);
  assert((engine->GetRing0Transfers() + engine->GetRing1Transfers()) == 1);

  // Verify memory arrived at destination offset 256
  float dx = 0, dy = 0, dz = 0, dw = 0;
  assert(engine->GetStationaryBuffer().UnpackSimdVector4f(256, dx, dy, dz, dw));
  assert(dx == 1.5f && dy == 2.5f && dz == 3.5f && dw == 4.5f);

  // 5. Boundary overflow enforcement & integer wrap protection
  DmaTransferRequest overflow_req;
  overflow_req.channel_id = 1;
  overflow_req.source_offset = 0;
  overflow_req.destination_offset = (1024 * 1024) - 8;
  overflow_req.byte_count = 16; // Exceeds capacity
  auto err_res = engine->ExecuteTransfer(overflow_req);
  assert(!err_res.success);
  assert(err_res.error_message.find("overflow") != std::string::npos);

  // Integer overflow attacks on StationaryBuffer
  const uint8_t oflow_data[16] = {0};
  uint8_t oflow_dest[16] = {0};
  assert(!engine->GetStationaryBuffer().Write(static_cast<size_t>(-5), oflow_data, 10));
  assert(!engine->GetStationaryBuffer().Read(static_cast<size_t>(-5), oflow_dest, 10));
  assert(!engine->GetStationaryBuffer().PackSimdVector4f(static_cast<size_t>(-5), 1.0f, 2.0f, 3.0f, 4.0f));
  assert(!engine->GetStationaryBuffer().SimdVectorFmaAdd(0, 0, 0, static_cast<size_t>(-1), 1.0f));

  // 6. Test StationaryDmaHostObject JSI wrapper
  auto host_obj = std::make_shared<StationaryDmaHostObject>(engine);
  assert(std::holds_alternative<int64_t>(host_obj->GetProperty("capacity")));
  assert(std::get<int64_t>(host_obj->GetProperty("capacity")) == 1024 * 1024);
  assert(std::get<bool>(host_obj->GetProperty("isCacheLineAligned")) == true);

  std::vector<JsiValueVariant> jsi_transfer_args = {
    static_cast<int64_t>(1),
    static_cast<int64_t>(256),
    static_cast<int64_t>(512),
    static_cast<int64_t>(16)
  };
  auto jsi_res = host_obj->InvokeMethod("transfer", jsi_transfer_args);
  assert(std::holds_alternative<std::string>(jsi_res));
  assert(std::get<std::string>(jsi_res).find("DMA transfer complete") != std::string::npos);

  // Test JSI invocation with double arguments (standard from JS runtime)
  std::vector<JsiValueVariant> jsi_double_args = {
    1.0,
    256.0,
    512.0,
    16.0
  };
  auto jsi_double_res = host_obj->InvokeMethod("transfer", jsi_double_args);
  assert(std::holds_alternative<std::string>(jsi_double_res));
  assert(std::get<std::string>(jsi_double_res).find("DMA transfer complete") != std::string::npos);

  std::cout << "  [PASS] TestDmaEibEngine succeeded." << std::endl;
}

void TestCoroutineScheduler() {
  std::cout << "[RUN] TestCoroutineScheduler (Non-Colored Fiber Coroutines without GIL)..." << std::endl;

  // 1. Test real C++20 <coroutine> Generator
  auto gen = FibonacciGenerator(5);
  assert(gen.MoveNext()); assert(gen.GetCurrent() == 0);
  assert(gen.MoveNext()); assert(gen.GetCurrent() == 1);
  assert(gen.MoveNext()); assert(gen.GetCurrent() == 1);
  assert(gen.MoveNext()); assert(gen.GetCurrent() == 2);
  assert(gen.MoveNext()); assert(gen.GetCurrent() == 3);
  assert(!gen.MoveNext());

  // 2. Test FiberCoroutine & Scheduler
  auto scheduler = std::make_shared<CoroutineScheduler>(4);
  assert(scheduler->GetActiveWorkerCount() == 4);

  auto coro = std::make_shared<FiberCoroutine>("tensor_stream", 3, [](size_t step) -> CoroutineYieldResult {
    if (step == 0) return { CoroutineState::Suspended, std::string("chunk_alpha"), false, "" };
    if (step == 1) return { CoroutineState::Suspended, std::string("chunk_beta"), false, "" };
    return { CoroutineState::Completed, std::string("chunk_omega"), true, "" };
  });

  scheduler->RegisterCoroutine(coro);
  assert(scheduler->GetCoroutine("tensor_stream") != nullptr);

  auto s1 = scheduler->StepCoroutine("tensor_stream");
  assert(s1.state == CoroutineState::Suspended);
  assert(std::get<std::string>(s1.value) == "chunk_alpha");
  assert(!s1.is_done);

  auto s2 = scheduler->StepCoroutine("tensor_stream");
  assert(s2.state == CoroutineState::Suspended);
  assert(std::get<std::string>(s2.value) == "chunk_beta");

  auto s3 = scheduler->StepCoroutine("tensor_stream");
  assert(s3.state == CoroutineState::Completed);
  assert(std::get<std::string>(s3.value) == "chunk_omega");
  assert(s3.is_done);

  // 3. Test parallel task execution across worker threads without GIL
  std::vector<std::pair<std::string, std::function<void()>>> parallel_tasks;
  for (int i = 0; i < 4; ++i) {
    parallel_tasks.push_back({"task_" + std::to_string(i), []() {
      std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }});
  }
  auto records = scheduler->DispatchParallelAll(parallel_tasks);
  assert(records.size() == 4);
  std::set<std::thread::id> executed_threads;
  for (const auto& rec : records) {
    assert(rec.success);
    executed_threads.insert(rec.thread_id);
  }
  assert(executed_threads.size() > 1); // Proves real parallel worker execution!

  // Reset and run all to completion
  coro->Reset();
  auto all_steps = scheduler->RunToCompletion("tensor_stream");
  assert(all_steps.size() == 3);

  // JSI HostObject binding test
  auto host_obj = std::make_shared<CoroutineHostObject>(scheduler);
  coro->Reset();
  auto jsi_step = host_obj->InvokeMethod("step", { std::string("tensor_stream") });
  assert(std::holds_alternative<std::string>(jsi_step));
  assert(std::get<std::string>(jsi_step) == "chunk_alpha");

  auto jsi_dispatch = host_obj->InvokeMethod("dispatchParallel", { static_cast<int64_t>(3) });
  assert(std::holds_alternative<int64_t>(jsi_dispatch));
  assert(std::get<int64_t>(jsi_dispatch) == 3);

  // 4. Test zero-worker scheduler fallback (verifies no deadlock occurs)
  CoroutineScheduler zero_scheduler(0);
  assert(zero_scheduler.GetActiveWorkerCount() == 0);
  std::vector<std::pair<std::string, std::function<void()>>> fallback_tasks = {
    {"fallback_0", []() {}}
  };
  auto fallback_records = zero_scheduler.DispatchParallelAll(fallback_tasks);
  assert(fallback_records.size() == 1);
  assert(fallback_records[0].success);

  std::cout << "  [PASS] TestCoroutineScheduler succeeded." << std::endl;
}

void TestProtobufBridge() {
  std::cout << "[RUN] TestProtobufBridge (Binary Wire Encoding & Legacy Interception)..." << std::endl;

  // 1. Varint roundtrip
  std::vector<uint8_t> varint_buf;
  ProtobufBridge::EncodeVarint(300, varint_buf);
  assert(varint_buf.size() == 2);
  const uint8_t* ptr = varint_buf.data();
  uint64_t decoded_val = 0;
  assert(ProtobufBridge::DecodeVarint(ptr, varint_buf.data() + varint_buf.size(), decoded_val));
  assert(decoded_val == 300);

  // 2. Method call serialization roundtrip
  auto encoded = ProtobufBridge::EncodeMethodCall("crypto", "signHash", "hash_payload_0x1234");
  assert(!encoded.empty());

  std::string mod, meth, payload;
  assert(ProtobufBridge::DecodeMethodCall(encoded.data(), encoded.size(), mod, meth, payload));
  assert(mod == "crypto");
  assert(meth == "signHash");
  assert(payload == "hash_payload_0x1234");

  // 3. Dispatch through LegacyBridgeInterceptor using binary Protobuf
  auto interceptor = std::make_shared<LegacyBridgeInterceptor>();
  interceptor->RegisterNativeMethod("crypto", "signHash", [](const std::vector<JsiValueVariant>& params) -> JsiValueVariant {
    if (!params.empty() && std::holds_alternative<std::string>(params[0])) {
      return "signed_" + std::get<std::string>(params[0]);
    }
    return std::string("signed_empty");
  });

  auto proto_res = interceptor->DispatchProtobuf(encoded.data(), encoded.size());
  assert(proto_res.IsSuccess());
  assert(proto_res.result_payload == "signed_hash_payload_0x1234");
  assert(interceptor->GetProtobufDispatches() == 1);
  assert(interceptor->GetBypassRatio() == 1.0);

  std::cout << "  [PASS] TestProtobufBridge succeeded." << std::endl;
}

void TestHermesCompiler() {
  std::cout << "[RUN] TestHermesCompiler (Runtime AOT Bytecode Compilation & Hot Reload)..." << std::endl;
  auto compiler = std::make_shared<HermesRuntimeCompiler>();
  auto adapter = std::make_shared<HermesRuntimeAdapter>();
  assert(adapter->Initialize(false));
  compiler->AttachRuntimeAdapter(adapter);

  // 1. Compile JavaScript source to Hermes Bytecode (.hbc)
  CompilationOptions opts;
  opts.optimize_aot = true;
  opts.static_h_mode = true;
  opts.bytecode_version = 96;

  auto res = compiler->CompileSource("export const answer = 42; export default answer;", "bundle://app.js", opts);
  assert(res.success);
  assert(!res.bytecode.empty());
  assert(res.bytecode.size() >= 16);
  assert(res.source_fnv_hash != 0);
  assert(!res.symbols_table.empty());

  // 2. Validate magic bytes: 0x1F, 'H', 'B', 'C'
  assert(HermesRuntimeCompiler::ValidateBytecode(res.bytecode.data(), res.bytecode.size()));
  assert(HermesRuntimeCompiler::ExtractSourceHash(res.bytecode.data(), res.bytecode.size()) == res.source_fnv_hash);
  assert(!HermesRuntimeCompiler::ValidateBytecode(nullptr, 0));
  assert(HermesRuntimeCompiler::ExtractSourceHash(nullptr, 0) == 0);

  // 3. Hot reload bundle connected to runtime adapter
  assert(compiler->HotReloadBundle("main_bundle", res.bytecode.data(), res.bytecode.size()));
  assert(compiler->GetLoadedBundleCount() == 1);

  // Corrupt bytecode must fail hot reload
  const uint8_t corrupt_bytes[] = {0x00, 0x01, 0x02, 0x03};
  assert(!compiler->HotReloadBundle("corrupt_bundle", corrupt_bytes, sizeof(corrupt_bytes)));
  assert(compiler->GetLoadedBundleCount() == 1);

  // 4. JSI HostObject wrapper test
  auto host_obj = std::make_shared<HermesCompilerHostObject>(compiler);
  assert(std::holds_alternative<int64_t>(host_obj->GetProperty("loadedBundleCount")));
  assert(std::get<int64_t>(host_obj->GetProperty("loadedBundleCount")) == 1);

  auto compile_res = host_obj->InvokeMethod("compile", { std::string("export const x = 1;") });
  assert(std::holds_alternative<std::string>(compile_res));
  assert(std::get<std::string>(compile_res).find("Compiled HBC") != std::string::npos);

  std::cout << "  [PASS] TestHermesCompiler succeeded." << std::endl;
}

int main() {
  std::cout << "=========================================================" << std::endl;
  std::cout << "   LynxFita Native C++ JSI & Architecture Test Suite     " << std::endl;
  std::cout << "=========================================================" << std::endl;

  TestHermesRuntimeAdapter();
  TestCodegenNativeModule();
  TestLegacyBridgeInterceptor();
  TestWasiHostModule();
  TestBridgePerformanceBenchmark();
  TestThreadSafety();
  TestDmaEibEngine();
  TestCoroutineScheduler();
  TestProtobufBridge();
  TestHermesCompiler();

  std::cout << "=========================================================" << std::endl;
  std::cout << "   ALL NATIVE TESTS PASSED SUCCESSFULLY!                 " << std::endl;
  std::cout << "=========================================================" << std::endl;
  return 0;
}
