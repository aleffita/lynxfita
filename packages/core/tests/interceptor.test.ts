/**
 * Bridge Interceptor Direct JSI Dispatcher Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BridgeInterceptor } from '../dist/index.js';

test('BridgeInterceptor direct JSI handler dispatch and stats', () => {
  const interceptor = new BridgeInterceptor();

  interceptor.register('Weather', 'getTemp', (params: any) => {
    return { temp: 22.5, city: params?.city || 'Unknown' };
  });

  assert.equal(interceptor.has('Weather', 'getTemp'), true);
  assert.equal(interceptor.has('Weather', 'getUnknown'), false);

  const res = interceptor.dispatch('Weather', 'getTemp', { city: 'Lisbon' });
  assert.equal(res.code, 0);
  assert.deepEqual(res.data, { temp: 22.5, city: 'Lisbon' });

  const stats = interceptor.getStats();
  assert.equal(stats.directCount, 1);
  assert.equal(stats.legacyCount, 0);
  assert.equal(stats.bypassRatio, 1.0);
});

test('BridgeInterceptor 404 for unhandled methods', () => {
  const interceptor = new BridgeInterceptor();
  const res = interceptor.dispatch('NonExistent', 'noop', {});
  assert.equal(res.code, -404);
});
