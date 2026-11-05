/**
 * WeChat-Style Super-App Explorer Unit & Navigation Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SuperAppExplorer } from '../dist/index.js';

test('SuperAppExplorer navigation and fiber sandboxing lifecycle', async () => {
  const explorer = new SuperAppExplorer();

  // Initial state should be Home
  assert.equal(explorer.navigator.getCurrentRoute()?.url, 'lynxfita://home');
  assert.equal(explorer.navigator.canGoBack(), false);

  // Navigate to Weather Showcase Mini-App
  const route1 = await explorer.navigate('lynxfita://miniapp/weather-showcase', 'Weather');
  assert.equal(route1.host, 'miniapp');
  assert.equal(explorer.navigator.canGoBack(), true);
  assert.equal(explorer.containerManager.getActiveCount(), 1);

  // Navigate to Settings
  const route2 = await explorer.navigate('lynxfita://settings', 'Settings');
  assert.equal(route2.host, 'settings');
  assert.equal(explorer.navigator.canGoBack(), true);

  // Navigate back to Weather
  const back1 = await explorer.back();
  assert.equal(back1?.host, 'miniapp');

  // Navigate back to Home -> Should unload weather mini-app fiber
  const back2 = await explorer.back();
  assert.equal(back2?.host, 'home');
  assert.equal(explorer.containerManager.getActiveCount(), 0);
});

test('SuperAppExplorer theme toggling and settings diagnostics', async () => {
  const explorer = new SuperAppExplorer();

  assert.equal(explorer.themeManager.getMode(), 'dark');
  explorer.themeManager.toggle();
  assert.equal(explorer.themeManager.getMode(), 'light');

  // Settings role and CRL
  assert.equal(explorer.getSettingsState().activeRole, 'viewer');
  explorer.setMtlsRole('top-patron');
  assert.equal(explorer.getSettingsState().activeRole, 'top-patron');

  assert.equal(explorer.getSettingsState().crlRevoked, false);
  explorer.toggleCrlRevocation();
  assert.equal(explorer.getSettingsState().crlRevoked, true);
});

test('SuperAppExplorer full HTML rendering across screens', async () => {
  const explorer = new SuperAppExplorer();

  // Home screen rendering
  const homeHtml = await explorer.renderHtmlPage();
  assert.ok(homeHtml.includes('LynxFita Mini-App Host & Explorer'));
  assert.ok(homeHtml.includes('Weather Showcase'));

  // Weather mini-app screen rendering
  await explorer.navigate('lynxfita://miniapp/weather-showcase', 'Weather');
  const weatherHtml = await explorer.renderHtmlPage();
  assert.ok(weatherHtml.includes('weather-showcase-app'));

  // DMA lab screen rendering
  await explorer.navigate('lynxfita://miniapp/dma-gpu-lab', 'DMA Lab');
  const dmaHtml = await explorer.renderHtmlPage();
  assert.ok(dmaHtml.includes('Stationary DMA Memory Map'));
});
