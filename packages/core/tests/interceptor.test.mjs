import test from 'node:test';
import assert from 'node:assert/strict';
import { BridgeInterceptor } from '../dist/interceptor.js';
import { HermesRuntimeSession } from '../dist/hermes.js';

test('BridgeInterceptor direct JSI execution', () => {
  const interceptor = new BridgeInterceptor();

  interceptor.register('kv', 'get', (params) => {
    return `kv_val_${params?.key}`;
  });

  assert.equal(interceptor.has('kv', 'get'), true);
  assert.equal(interceptor.has('kv', 'missing'), false);

  const res = interceptor.dispatch('kv', 'get', { key: 'auth_token' });
  assert.equal(res.code, 0);
  assert.equal(res.data, 'kv_val_auth_token');
  assert.ok(res.msg.includes('zero-copy'));

  const stats = interceptor.getStats();
  assert.equal(stats.directCount, 1);
  assert.equal(stats.legacyCount, 0);
  assert.equal(stats.bypassRatio, 1);
});

test('BridgeInterceptor global dispatcher hook', () => {
  const interceptor = new BridgeInterceptor();
  interceptor.register('calc', 'add', (params) => {
    return params.a + params.b;
  });

  assert.ok(globalThis.__lynxfita_jsi_dispatcher);
  const out = globalThis.__lynxfita_jsi_dispatcher('calc', 'add', { a: 10, b: 32 });
  assert.equal(out, 42);
});

test('HermesRuntimeSession AOT bundle verification', () => {
  const session = new HermesRuntimeSession();

  const validBundle = {
    magic: 0x1f484243,
    version: 96,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sourceUrl: 'bundle://index.hbc',
    entrypoint: 'main'
  };

  assert.equal(session.registerBundle(validBundle), true);
  assert.equal(session.getBundle('bundle://index.hbc')?.entrypoint, 'main');

  assert.throws(() => {
    session.registerBundle({ ...validBundle, magic: 0x12345678 });
  }, /Invalid Hermes AOT bundle signature/);
});
