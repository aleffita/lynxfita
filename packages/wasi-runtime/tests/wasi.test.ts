/**
 * LynxFita WASI Runtime: Linear Memory & Cordis Service Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LynxFitaContext, DmaService } from '@lynxfita/core';
import {
  WasiHostContext,
  WasiComponentService
} from '../dist/index.js';

test('WasiHostContext memory write and read with string encoding', () => {
  const host = new WasiHostContext();
  const testStr = 'Hello WASI Component World';

  const bytesWritten = host.writeString(0x100, testStr);
  assert.equal(bytesWritten, testStr.length);

  const readBack = host.readString(0x100, bytesWritten);
  assert.equal(readBack, testStr);
});

test('WasiHostContext bounds check throws on negative or overflow offsets', () => {
  const host = new WasiHostContext({ maxMemoryBytes: 65536 });

  assert.throws(() => {
    host.readBytes(-1, 10);
  }, /WASI memory out-of-bounds/);

  assert.throws(() => {
    host.readBytes(70000, 10);
  }, /WASI memory out-of-bounds/);
});

test('WasiComponentService mounts on Cordis Context and binds to Stationary DMA', () => {
  const ctx = new LynxFitaContext();
  new DmaService(ctx);
  const wasiSvc = new WasiComponentService(ctx);

  assert.ok(ctx.hasService('wasi'));
  assert.equal(ctx.wasi, wasiSvc);

  wasiSvc.registerExport('calculatePressure', (alt: number) => {
    return 1013.25 * Math.exp(-alt / 8400.0);
  });

  const p0 = wasiSvc.execute('calculatePressure', 0);
  assert.equal(Math.round(p0), 1013);

  const p1000 = wasiSvc.execute('calculatePressure', 1000);
  assert.ok(p1000 < 1013);
});
