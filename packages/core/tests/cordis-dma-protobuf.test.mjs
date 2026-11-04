import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PluginLedger,
  PluginState,
  StationaryDmaClient,
  CoroutineRunner,
  ProtobufWire,
  KernelWorkletDispatcher,
  HermesCompilerClient
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
