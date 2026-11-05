import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  BaseTheme,
  DarkTheme,
  LightTheme,
  getTheme,
  resolveWeatherIcon,
  WEATHER_ICONS_MAP,
  WeatherStore,
  Intents,
  WeatherApiService,
  renderWeatherAppView,
  renderHourlyForecast,
  renderLocationErrorBoundary,
  renderAnsiWeatherView,
  createWeatherShowcasePlugin
} from '../dist/index.js';
import { PluginLedger, PluginState } from '@lynxfita/core';

test('Themes - Design Parity with aleffita/weather-showcase', () => {
  // BaseTheme invariants
  assert.equal(BaseTheme.accentColor, '#f9d65d');
  assert.equal(BaseTheme.neutralColor, '#e7e4e4');
  assert.equal(BaseTheme.worldMapColor, '#29292a');

  // DarkTheme invariants
  assert.equal(DarkTheme.bgColor, '#000000');
  assert.equal(DarkTheme.textColor, '#ffffff');
  assert.equal(DarkTheme.worldMapColor, '#29292a');
  assert.equal(DarkTheme.accentColor, '#f9d65d');

  // LightTheme invariants
  assert.equal(LightTheme.bgColor, '#ffffff');
  assert.equal(LightTheme.textColor, '#383838');
  assert.equal(LightTheme.worldMapColor, '#f4f4f4');
  assert.equal(LightTheme.accentColor, '#f9d65d');

  assert.deepEqual(getTheme('dark'), DarkTheme);
  assert.deepEqual(getTheme('light'), LightTheme);
});

test('Icons Map - All 14 OpenWeatherMap Icons from original repo', () => {
  const expectedCodes = [
    '01d', '01n', '02d', '02n', '03', '04d', '04n',
    '09', '10d', '10n', '11', '13d', '13n', '50'
  ];

  for (const code of expectedCodes) {
    const meta = WEATHER_ICONS_MAP[code];
    assert.ok(meta, `Icon code '${code}' must exist in WEATHER_ICONS_MAP`);
    assert.ok(meta.name.length > 0);
    assert.ok(meta.label.length > 0);
    assert.ok(meta.asciiGlyph.length > 0);
    assert.ok(meta.unicodeGlyph.length > 0);
    assert.ok(meta.svgIcon.length > 0);
    assert.ok(typeof meta.shaderParams.advectionSpeed === 'number');
    assert.ok(typeof meta.shaderParams.particleDensity === 'number');
    assert.ok(typeof meta.shaderParams.buoyancy === 'number');
    assert.ok(typeof meta.shaderParams.turbulence === 'number');
  }

  // Fallback resolution
  assert.equal(resolveWeatherIcon('01d').name, 'Sun');
  assert.equal(resolveWeatherIcon('01n').name, 'Moon');
  assert.equal(resolveWeatherIcon('nonexistent').code, '01d');
});

test('MVI Store & Stationary DMA Telemetry Synchronization', async () => {
  const store = new WeatherStore();

  // Initial state inspection
  const init = store.getState();
  assert.equal(init.location.city, 'São Paulo');
  assert.equal(init.location.country, 'BR');
  assert.equal(init.theme, 'dark');
  assert.equal(init.dmaOffset, 0x2000);

  // DMA verify initial write
  const dma0 = store.getDmaTelemetry();
  assert.equal(dma0[0], init.current.temperature);
  assert.equal(dma0[1], init.current.humidity);
  assert.equal(dma0[2], init.current.pressure);
  assert.equal(dma0[3], init.current.windSpeed);

  // 1. Dispatch TOGGLE_THEME
  await store.dispatch(Intents.toggleTheme());
  assert.equal(store.getState().theme, 'light');
  await store.dispatch(Intents.toggleTheme());
  assert.equal(store.getState().theme, 'dark');

  // 2. Dispatch UPDATE_COORDINATES
  await store.dispatch(Intents.updateCoordinates(-22.9068, -43.1729, 'Rio de Janeiro', 'BR'));
  const rioState = store.getState();
  assert.equal(rioState.location.city, 'Rio de Janeiro');
  assert.equal(rioState.location.country, 'BR');
  assert.equal(rioState.location.latitude, -22.9068);
  assert.equal(rioState.location.longitude, -43.1729);

  // Verify DMA lane was refreshed with Rio telemetry
  const dmaRio = store.getDmaTelemetry();
  assert.ok(Math.abs(dmaRio[0] - rioState.current.temperature) < 0.01);
  assert.ok(Math.abs(dmaRio[1] - rioState.current.humidity) < 0.01);
  assert.ok(Math.abs(dmaRio[2] - rioState.current.pressure) < 0.01);
  assert.ok(Math.abs(dmaRio[3] - rioState.current.windSpeed) < 0.01);

  // 3. Hourly Forecast intervals (3h, 6h, 12h)
  assert.ok(rioState.hourly['3h']);
  assert.ok(rioState.hourly['6h']);
  assert.ok(rioState.hourly['12h']);
  assert.ok(typeof rioState.hourly['3h'].temp === 'number');
  assert.ok(typeof rioState.hourly['6h'].temp === 'number');
  assert.ok(typeof rioState.hourly['12h'].temp === 'number');
});

test('LocationErrorBoundary - Error Trigger and Resolution via Permission Grant', async () => {
  const store = new WeatherStore();

  // Trigger error
  await store.dispatch(Intents.triggerLocationError('Location permission denied by user'));
  assert.equal(store.getState().error.hasError, true);
  assert.equal(store.getState().error.message, 'Location permission denied by user');

  // Verify view renders error boundary
  const errorNode = renderLocationErrorBoundary(store.getState());
  assert.ok(errorNode);
  assert.equal(errorNode.type, 'view');
  assert.equal(errorNode.props.className, 'location-error-boundary');

  const rootNode = renderWeatherAppView(store.getState());
  assert.equal(rootNode.children.length, 1); // Only error boundary rendered

  const ansiOutput = renderAnsiWeatherView(store.getState());
  assert.match(ansiOutput, /Por favor, permita o acesso à localização/);
  assert.match(ansiOutput, /Conceder Permissão/);

  // Dispatch GRANT_LOCATION_PERMISSION to resolve error
  await store.dispatch(Intents.grantLocationPermission());
  assert.equal(store.getState().error.hasError, false);
  assert.equal(renderLocationErrorBoundary(store.getState()), null);

  const restoredRoot = renderWeatherAppView(store.getState());
  assert.equal(restoredRoot.children.length, 4); // Full layout restored
});

test('CORDIS WeatherShowcasePlugin - Coeffects & Reversible Effects Rollback', async () => {
  const ledger = new PluginLedger();
  const store = new WeatherStore();
  const plugin = createWeatherShowcasePlugin(store);

  ledger.registerPlugin(plugin);

  // Fails activation without coeffects
  assert.equal(await ledger.activatePlugin('weather-showcase-mvi'), false);
  assert.equal(ledger.getLedgerStatus()[0].state, PluginState.Suspended);

  // Satisfy coeffects: hardware.dma and ui.shader.wgsl
  ledger.setCoeffect('hardware.dma', true);
  ledger.setCoeffect('ui.shader.wgsl', true);

  // Activation now succeeds
  assert.equal(await ledger.activatePlugin('weather-showcase-mvi'), true);
  const activeStatus = ledger.getLedgerStatus();
  assert.equal(activeStatus[0].state, PluginState.Active);
  assert.equal(activeStatus[0].activeEffectsCount, 2);

  // Check DMA has active values
  const dmaActive = store.getDmaTelemetry();
  assert.ok(dmaActive[0] > 0);

  // Deactivate and verify LIFO rollback
  assert.equal(await ledger.deactivatePlugin('weather-showcase-mvi'), true);
  const inactiveStatus = ledger.getLedgerStatus();
  assert.equal(inactiveStatus[0].state, PluginState.Registered);
  assert.equal(inactiveStatus[0].activeEffectsCount, 0);

  // Verify DMA memory was zeroed by the rollback handler
  const dmaRolledBack = store.getDmaTelemetry();
  assert.deepEqual(dmaRolledBack, [0, 0, 0, 0]);
});

test('View Layer - Component Tree and ANSI formatting', () => {
  const store = new WeatherStore();
  const state = store.getState();

  const root = renderWeatherAppView(state);
  assert.equal(root.type, 'root-view');
  assert.equal(root.props.theme, 'dark');
  assert.equal(root.children.length, 4);

  const hourly = renderHourlyForecast(state);
  assert.equal(hourly.type, 'view');
  assert.equal(hourly.children.length, 3); // 3h, 6h, 12h

  const ansi = renderAnsiWeatherView(state);
  assert.match(ansi, /LynxFita Weather Showcase/);
  assert.match(ansi, /São Paulo, BR/);
  assert.match(ansi, /Telemetria DMA \[0x2000\]/);
  assert.match(ansi, /Previsão Horária/);
});

test('WeatherApiService - Live and deterministic offline fallback execution', async () => {
  const service = new WeatherApiService();
  const fallback = await service.fetchWeather(-23.5505, -46.6333, 'São Paulo', 'BR');

  assert.equal(fallback.isOfflineFallback, true);
  assert.equal(fallback.location.city, 'São Paulo');
  assert.equal(fallback.location.country, 'BR');
  assert.ok(fallback.current.temperature >= 15 && fallback.current.temperature <= 35);
  assert.ok(fallback.current.humidity >= 30 && fallback.current.humidity <= 95);
  assert.ok(fallback.hourly['3h']);
  assert.ok(fallback.hourly['6h']);
  assert.ok(fallback.hourly['12h']);

  // Direct deterministic offline calculation check
  const direct = service.deterministicOfflineFallback(-22.9068, -43.1729, 'Rio de Janeiro', 'BR');
  assert.equal(direct.location.city, 'Rio de Janeiro');
  assert.equal(direct.isOfflineFallback, true);

  // Repeatability check (deterministic)
  const direct2 = service.deterministicOfflineFallback(-22.9068, -43.1729, 'Rio de Janeiro', 'BR');
  assert.equal(direct.current.temperature, direct2.current.temperature);
  assert.equal(direct.current.humidity, direct2.current.humidity);
});

test('Standalone CLI entrypoint - Executes correctly via Node CLI', () => {
  const indexPath = path.resolve(fileURLToPath(import.meta.url), '../../dist/index.js');
  const stdout = execFileSync(process.execPath, [indexPath], { encoding: 'utf-8' });
  assert.match(stdout, /LynxFita Weather Showcase - MVI Architecture & DMA Lane/);
  assert.match(stdout, /Verifying Stationary DMA Lane Telemetry at 0x2000/);
  assert.match(stdout, /Weather Showcase demonstration completed successfully\./);
});

