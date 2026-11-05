/**
 * LynxFita Weather Showcase: MVI Unidirectional Architecture & DMA Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WeatherStore,
  Intents,
  renderHtmlWeatherApp,
  renderAnsiWeatherView,
  getTheme,
  resolveWeatherIcon
} from '../dist/index.js';

test('WeatherStore initializes state and synchronizes Stationary DMA offset 0x2000', () => {
  const store = new WeatherStore();
  const state = store.getState();

  assert.equal(state.location.city, 'São Paulo');
  assert.equal(state.location.country, 'BR');
  assert.equal(state.activeScreen, 'forecast-home');

  // Verify DMA telemetry vector at 0x2000
  const [temp, humidity, pressure, windSpeed] = store.getDmaTelemetry();
  assert.equal(Math.round(temp), Math.round(state.current.temperature));
  assert.equal(Math.round(humidity), Math.round(state.current.humidity));
  assert.equal(Math.round(pressure), Math.round(state.current.pressure));
  assert.equal(Math.round(windSpeed), Math.round(state.current.windSpeed));
});

test('WeatherStore processes MVI Intents', async () => {
  const store = new WeatherStore();

  // Toggle theme
  assert.equal(store.getState().theme, 'dark');
  await store.dispatch(Intents.toggleTheme());
  assert.equal(store.getState().theme, 'light');

  // Switch screen
  await store.dispatch(Intents.switchScreen('hourly-detail'));
  assert.equal(store.getState().activeScreen, 'hourly-detail');

  // Update coordinates
  await store.dispatch(Intents.updateCoordinates(52.52, 13.405, 'Berlin', 'DE'));
  assert.equal(store.getState().location.city, 'Berlin');
  assert.equal(store.getState().location.country, 'DE');
  assert.equal(store.getState().location.latitude, 52.52);
  assert.equal(store.getState().location.longitude, 13.405);
});

test('renderHtmlWeatherApp produces complete reactive DOM structure', () => {
  const store = new WeatherStore();
  const html = renderHtmlWeatherApp(store.getState());

  assert.ok(html.includes('weather-showcase-app'));
  assert.ok(html.includes('São Paulo'));
  assert.ok(html.includes('Home'));
  assert.ok(html.includes('Horas'));
  assert.ok(html.includes('Cidades'));
  assert.ok(html.includes('DMA / GPU'));
});

test('renderAnsiWeatherView renders rich console output', () => {
  const store = new WeatherStore();
  const ansi = renderAnsiWeatherView(store.getState());

  assert.ok(ansi.includes('LynxFita Weather Showcase'));
  assert.ok(ansi.includes('São Paulo'));
  assert.ok(ansi.includes('°C'));
});
