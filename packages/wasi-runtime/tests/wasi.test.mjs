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

test('WasiHostContext writeBytes and readBytes raw binary buffers', () => {
  const ctx = new WasiHostContext();
  const binaryPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x42]);
  const written = ctx.writeBytes(2048, binaryPayload);

  assert.equal(written, 5);
  const readBack = ctx.readBytes(2048, 5);
  assert.deepEqual(readBack, binaryPayload);
});

test('WasiHostContext traps on negative offsets and invalid bounds', () => {
  const ctx = new WasiHostContext();

  assert.throws(() => {
    ctx.writeBytes(-1, new Uint8Array([1, 2, 3]));
  }, /invalid negative offset/);

  assert.throws(() => {
    ctx.readBytes(-5, 2);
  }, /invalid offset/);

  assert.throws(() => {
    ctx.readString(100, 100000);
  }, /WASI memory out-of-bounds/);
});

test('WasiHostContext traps on memory exceeding limits', () => {
  const ctx = new WasiHostContext({ maxMemoryBytes: 128 * 1024 });

  assert.throws(() => {
    ctx.growMemory(256 * 1024);
  }, /WASI memory allocation trap/);
});
