/**
 * Standalone Cordis Plugin Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginLedger, StationaryDmaClient } from '@lynxfita/core';
import { weatherSimdPlugin } from '../dist/index.js';

test('WeatherSimdPlugin mounts on Cordis PluginLedger, writes DMA, and unloads in LIFO order', async () => {
  const ledger = new PluginLedger();
  const dma = new StationaryDmaClient(64 * 1024);
  ledger.setCoeffect('hardware.dma', dma);

  ledger.registerPlugin(weatherSimdPlugin);
  const activated = await ledger.activatePlugin('weather-simd');
  assert.equal(activated, true);

  const unpacked = dma.unpackSimd4f(0x2000);
  assert.equal(Math.round(unpacked[0] * 10) / 10, 22.5);
  assert.equal(unpacked[1], 60.0);
  assert.equal(unpacked[2], 1013.25);
  assert.equal(unpacked[3], 14.0);

  // Unload effects (LIFO teardown)
  const deactivated = await ledger.deactivatePlugin('weather-simd');
  assert.equal(deactivated, true);

  const zeroed = dma.unpackSimd4f(0x2000);
  assert.equal(zeroed[0], 0);
  assert.equal(zeroed[1], 0);
});
