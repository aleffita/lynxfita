import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PluginLedger,
  PluginState,
  StationaryDmaClient,
  CoroutineRunner,
  ProtobufWire,
  KernelWorkletDispatcher,
  HermesCompilerClient,
  WebGpuComputePipeline,
  validateWgslShader,
  TENSOR_FMA_WGSL_SHADER,
  WEATHER_PARTICLES_WGSL_SHADER
} from '../dist/index.js';

test('CORDIS PluginLedger - Revertible Effects & Rollback', async () => {
  const ledger = new PluginLedger();
  let sideEffectCleaned = false;

  const plugin = {
    meta: {
      id: 'sensor-plugin',
      name: 'Sensor Plugin',
      version: '1.0.0',
      dependencies: [],
      requiredCoeffects: []
    },
    activate: async (ctx) => {
      await ctx.registerEffect(
        'hardware-listener',
        () => { /* applied side effect */ },
        () => { sideEffectCleaned = true; }
      );
    }
  };

  ledger.registerPlugin(plugin);
  assert.equal(await ledger.activatePlugin('sensor-plugin'), true);

  const statusBefore = ledger.getLedgerStatus();
  assert.equal(statusBefore[0].state, PluginState.Active);
  assert.equal(statusBefore[0].activeEffectsCount, 1);

  // Deactivate and verify temporal rollback
  assert.equal(await ledger.deactivatePlugin('sensor-plugin'), true);
  assert.equal(sideEffectCleaned, true);

  const statusAfter = ledger.getLedgerStatus();
  assert.equal(statusAfter[0].state, PluginState.Registered);
  assert.equal(statusAfter[0].activeEffectsCount, 0);
});

test('CORDIS PluginLedger - Reactive Coeffects Activation', async () => {
  const ledger = new PluginLedger();

  const gpuPlugin = {
    meta: {
      id: 'gpu-accelerator',
      name: 'GPU Accelerator',
      version: '1.0.0',
      dependencies: [],
      requiredCoeffects: ['gpu.device', 'hardware.dma']
    },
    activate: () => {}
  };

  ledger.registerPlugin(gpuPlugin);

  // Activation fails / suspends because coeffects are missing
  const activated = await ledger.activatePlugin('gpu-accelerator');
  assert.equal(activated, false);

  const statusSuspended = ledger.getLedgerStatus();
  assert.equal(statusSuspended[0].state, PluginState.Suspended);

  // Satisfy coeffects
  ledger.setCoeffect('gpu.device', 'DirectX-12');
  ledger.setCoeffect('hardware.dma', true);

  // Now activation succeeds
  assert.equal(await ledger.activatePlugin('gpu-accelerator'), true);
  assert.equal(ledger.getCoeffect('gpu.device'), 'DirectX-12');
});

test('StationaryDmaClient - SIMD Packing and Transfer', () => {
  const dma = new StationaryDmaClient(64 * 1024);

  // 1. Pack SIMD 4-float vector
  assert.equal(dma.packSimd4f(0, 10.5, 20.5, 30.5, 40.5), true);
  const unpacked = dma.unpackSimd4f(0);
  assert.deepEqual(unpacked, [10.5, 20.5, 30.5, 40.5]);

  // 2. Transfer via DMA lane
  const res = dma.transfer(1, 0, 128, 16);
  assert.match(res, /DMA transfer complete/);

  // Verify unpacked data at destination offset
  const destUnpacked = dma.unpackSimd4f(128);
  assert.deepEqual(destUnpacked, [10.5, 20.5, 30.5, 40.5]);

  // 3. Bounds overflow check
  assert.throws(() => {
    dma.transfer(1, 0, (64 * 1024) - 4, 16);
  }, /overflow/);

  // Negative offset checks
  assert.throws(() => {
    dma.transfer(1, -10, 0, 16);
  }, /overflow/);
  assert.equal(dma.packSimd4f(-1, 1, 2, 3, 4), false);
  assert.throws(() => {
    dma.unpackSimd4f(-1);
  }, /overflow/);
});

test('CoroutineRunner - Non-Colored Generator Steps', () => {
  function* countYields() {
    yield 'step-1';
    yield 'step-2';
    return 'done';
  }

  const gen = countYields();
  const s1 = CoroutineRunner.step(gen);
  assert.equal(s1.value, 'step-1');
  assert.equal(s1.done, false);

  const s2 = CoroutineRunner.step(gen);
  assert.equal(s2.value, 'step-2');
  assert.equal(s2.done, false);

  const s3 = CoroutineRunner.step(gen);
  assert.equal(s3.value, 'done');
  assert.equal(s3.done, true);
});

test('ProtobufWire - Varint and Method Call Serialization', () => {
  // Varint test
  const varint = ProtobufWire.encodeVarint(150);
  const decoded = ProtobufWire.decodeVarint(varint);
  assert.equal(decoded.value, 150);

  // Method call roundtrip
  const encoded = ProtobufWire.encodeMethodCall('telemetry', 'record', '{"cpu":0.85}');
  const decodedCall = ProtobufWire.decodeMethodCall(encoded);
  assert.equal(decodedCall.moduleName, 'telemetry');
  assert.equal(decodedCall.methodName, 'record');
  assert.equal(decodedCall.payload, '{"cpu":0.85}');
});

test('KernelWorkletDispatcher - Element-wise Add & Dot Product', async () => {
  const dispatcher = new KernelWorkletDispatcher();

  const resAdd = await dispatcher.executeKernel('ai.onnx.Add', {
    a: { data: new Float32Array([1, 2, 3]), shape: [3] },
    b: { data: new Float32Array([10, 20, 30]), shape: [3] }
  });
  assert.deepEqual(Array.from(resAdd.c.data), [11, 22, 33]);

  const resDot = await dispatcher.executeKernel('ai.onnx.DotProduct', {
    a: { data: new Float32Array([2, 3]), shape: [2] },
    b: { data: new Float32Array([4, 5]), shape: [2] }
  });
  assert.equal(resDot.output.data[0], 23); // 2*4 + 3*5 = 8 + 15 = 23
});

test('HermesCompilerClient - AOT Bytecode Compilation', () => {
  const res = HermesCompilerClient.compileToBytecode('const x = 42;');
  assert.equal(res.success, true);
  assert.equal(res.magic, '0x1F484243');
  assert.ok(res.bytecodeSize >= 8);
});

test('WebGPU WGSL Shaders - Syntactic & Structural Validation', () => {
  const fmaValidation = validateWgslShader(TENSOR_FMA_WGSL_SHADER);
  assert.equal(fmaValidation.valid, true);
  assert.equal(fmaValidation.errors.length, 0);

  const weatherValidation = validateWgslShader(WEATHER_PARTICLES_WGSL_SHADER);
  assert.equal(weatherValidation.valid, true);
  assert.equal(weatherValidation.errors.length, 0);

  // Invalid shaders
  const emptyValidation = validateWgslShader('');
  assert.equal(emptyValidation.valid, false);

  const brokenBrace = validateWgslShader('@compute @workgroup_size(64) fn main() { let x = 1;');
  assert.equal(brokenBrace.valid, false);
});

test('WebGpuComputePipeline - FMA & Weather Particles with SIMD/DMA Fallback', async () => {
  const pipeline = new WebGpuComputePipeline();

  // 1. FMA: dst = a + b * scale
  const a = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]);
  const b = new Float32Array([10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0]);
  const resFma = await pipeline.executeFma(a, b, 0.5);

  assert.equal(resFma.elementsProcessed, 8);
  assert.ok(resFma.durationUs >= 0);
  assert.ok(resFma.throughputGflops >= 0);
  assert.ok(['webgpu-hardware', 'dma-simd-native'].includes(resFma.backend));

  // 1.0 + 10.0*0.5 = 6.0, 2.0 + 20.0*0.5 = 12.0, etc.
  assert.equal(resFma.data[0], 6.0);
  assert.equal(resFma.data[1], 12.0);
  assert.equal(resFma.data[2], 18.0);
  assert.equal(resFma.data[3], 24.0);
  assert.equal(resFma.data[4], 30.0);
  assert.equal(resFma.data[5], 36.0);
  assert.equal(resFma.data[6], 42.0);
  assert.equal(resFma.data[7], 48.0);

  // 2. Weather Particles Advection: 8 floats per particle (pos: vec4, vel: vec4)
  const particles = new Float32Array(16); // 2 particles
  particles[0] = 10.0; particles[1] = 20.0; // pos.x, pos.y
  particles[4] = 1.0;  particles[5] = 2.0;  // vel.x, vel.y

  particles[8] = 30.0; particles[9] = 40.0;
  particles[12] = 0.5; particles[13] = 1.5;

  const telemetry = [28.5, 75.0, 1012.0, 15.0]; // [temp, humidity, pressure, windSpeed]
  const resParticles = await pipeline.executeWeatherParticles(particles, telemetry, 0.1);

  assert.equal(resParticles.elementsProcessed, 2);
  assert.ok(resParticles.durationUs >= 0);
  assert.equal(resParticles.data[2], 75.0); // humidity stored in pos.z
  assert.equal(resParticles.data[3], 28.5); // temp stored in pos.w
});

test('KernelWorkletDispatcher - FMA & Weather Particles Worklet Integration', async () => {
  const dispatcher = new KernelWorkletDispatcher();

  const resFma = await dispatcher.executeKernel('ai.lynxfita.FMA', {
    a: { data: new Float32Array([2, 4, 6, 8]), shape: [4] },
    b: { data: new Float32Array([1, 2, 3, 4]), shape: [4] },
    scale: { data: new Float32Array([3]), shape: [1] }
  });
  // 2 + 1*3 = 5, 4 + 2*3 = 10, 6 + 3*3 = 15, 8 + 4*3 = 20
  assert.deepEqual(Array.from(resFma.dst.data), [5, 10, 15, 20]);
});

