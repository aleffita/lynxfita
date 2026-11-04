import test from 'node:test';
import assert from 'node:assert/strict';
import { WasiHostContext } from '../dist/index.js';

test('WasiHostContext write and read memory within bounds', () => {
  const ctx = new WasiHostContext();
  const testStr = 'Hello LynxFita Static Hermes!';
  const bytesWritten = ctx.writeString(1024, testStr);

  assert.equal(bytesWritten, Buffer.byteLength(testStr));
  const readBack = ctx.readString(1024, bytesWritten);
  assert.equal(readBack, testStr);
});

test('WasiHostContext traps on memory exceeding limits', () => {
  const ctx = new WasiHostContext({ maxMemoryBytes: 128 * 1024 });

  assert.throws(() => {
    ctx.growMemory(256 * 1024);
  }, /WASI memory allocation trap/);
});
