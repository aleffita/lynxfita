/**
 * LynxFita Core: Endogenous Cordis, Stationary DMA, and Protobuf Wire Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LynxFitaContext,
  Fiber,
  Service,
  DmaService,
  ProtobufService,
  StationaryDmaClient,
  ProtobufWire
} from '../dist/index.js';

test('Cordis Context, Fiber, and LIFO effect disposer lifecycle', async () => {
  const rootCtx = new LynxFitaContext();
  const unwindOrder: number[] = [];

  // Register multiple effects on child fiber
  const childCtx = rootCtx.isolate('test-fiber');
  childCtx.effect(() => {
    unwindOrder.push(1);
    return () => {
      unwindOrder.push(10);
    };
  });

  childCtx.effect(() => {
    unwindOrder.push(2);
    return () => {
      unwindOrder.push(20);
    };
  });

  // Verify initial forward execution
  assert.deepEqual(unwindOrder, [1, 2]);

  // Unload fiber -> verify LIFO unwind (20 before 10)
  await childCtx.fiber._unload();
  assert.deepEqual(unwindOrder, [1, 2, 20, 10]);
  assert.equal(childCtx.fiber.state, 'unloaded');
});

test('Stationary DMA SIMD 4-float pack and unpack', () => {
  const dma = new StationaryDmaClient(16384);
  const offset = 0x1000;

  const ok = dma.packSimd4f(offset, 1.25, 2.5, 3.75, 5.0);
  assert.equal(ok, true);

  const [x, y, z, w] = dma.unpackSimd4f(offset);
  assert.equal(Math.abs(x - 1.25) < 1e-5, true);
  assert.equal(Math.abs(y - 2.5) < 1e-5, true);
  assert.equal(Math.abs(z - 3.75) < 1e-5, true);
  assert.equal(Math.abs(w - 5.0) < 1e-5, true);
});

test('Protobuf varint and method call encoding/decoding', () => {
  const encoded = ProtobufWire.encodeMethodCall('WeatherModule', 'getForecast', '{"city":"Berlin"}');
  assert.ok(encoded.length > 0);

  const decoded = ProtobufWire.decodeMethodCall(encoded);
  assert.equal(decoded.moduleName, 'WeatherModule');
  assert.equal(decoded.methodName, 'getForecast');
  assert.equal(decoded.payload, '{"city":"Berlin"}');
});

test('Cordis Service coeffect mounting on LynxFitaContext', () => {
  const ctx = new LynxFitaContext();
  const dmaSvc = new DmaService(ctx);
  const protoSvc = new ProtobufService(ctx);

  assert.ok(ctx.hasService('dma'));
  assert.ok(ctx.hasService('protobuf'));
  assert.equal(ctx.dma, dmaSvc);
  assert.equal(ctx.protobuf, protoSvc);
});
