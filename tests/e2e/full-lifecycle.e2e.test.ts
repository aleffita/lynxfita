/**
 * LynxFita Super-App Full Lifecycle End-to-End (E2E) Test
 * Tests Super-App Explorer navigation, Mini-App child Fiber sandboxing,
 * LIFO effect disposers on close/back, and mTLS Federation controls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SuperAppExplorer } from '@lynxfita/explorer';

test('Full Super-App Explorer Navigation, Sandboxing & Teardown Lifecycle', async () => {
  const explorer = new SuperAppExplorer();

  // 1. Initial State: Home screen
  const initialRoute = explorer.navigator.getCurrentRoute();
  assert.equal(initialRoute?.url, 'lynxfita://home');
  assert.equal(explorer.navigator.canGoBack(), false);

  const homeHtml = await explorer.renderHtmlPage();
  assert.ok(homeHtml.includes('LynxFita Mini-App Host & Explorer'));
  assert.ok(homeHtml.includes('Weather Showcase'));
  assert.ok(homeHtml.includes('WIT & Native SIMD Studio'));
  assert.ok(homeHtml.includes('Stationary DMA & GPU Lab'));

  // 2. Launch Weather Showcase Mini-App in child Fiber
  await explorer.navigate('lynxfita://miniapp/weather-showcase', 'Weather Showcase');
  assert.equal(explorer.navigator.canGoBack(), true);
  assert.equal(explorer.containerManager.getActiveCount(), 1);

  const weatherHtml = await explorer.renderHtmlPage();
  assert.ok(weatherHtml.includes('weather-showcase-app'));

  // 3. Launch WIT / SIMD Studio Mini-App
  await explorer.navigate('lynxfita://miniapp/wit-ffi-studio', 'WIT Studio');
  assert.equal(explorer.containerManager.getActiveCount(), 2);
  const witHtml = await explorer.renderHtmlPage();
  assert.ok(witHtml.includes('WIT & Native SIMD FFI Studio'));

  // 4. Launch DMA / GPU Lab Mini-App
  await explorer.navigate('lynxfita://miniapp/dma-gpu-lab', 'DMA Lab');
  assert.equal(explorer.containerManager.getActiveCount(), 3);
  const dmaHtml = await explorer.renderHtmlPage();
  assert.ok(dmaHtml.includes('Stationary DMA Memory Map'));

  // 5. Navigate backwards and verify LIFO Fiber teardown
  const back1 = await explorer.back();
  assert.equal(back1?.title, 'WIT Studio');
  assert.equal(explorer.containerManager.getActiveCount(), 2);

  const back2 = await explorer.back();
  assert.equal(back2?.title, 'Weather Showcase');
  assert.equal(explorer.containerManager.getActiveCount(), 1);

  const back3 = await explorer.back();
  assert.equal(back3?.url, 'lynxfita://home');
  assert.equal(explorer.containerManager.getActiveCount(), 0);

  // 6. Navigate to Settings and toggle theme & CRL revocation
  await explorer.navigate('lynxfita://settings', 'Settings');
  assert.equal(explorer.themeManager.getMode(), 'dark');
  explorer.themeManager.toggle();
  assert.equal(explorer.themeManager.getMode(), 'light');

  assert.equal(explorer.getSettingsState().crlRevoked, false);
  explorer.toggleCrlRevocation();
  assert.equal(explorer.getSettingsState().crlRevoked, true);

  const settingsHtml = await explorer.renderHtmlPage();
  assert.ok(settingsHtml.includes('CERTIFICATE REVOKED'));
});
