import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WeatherStore,
  WeatherApp,
  WeatherTimeAndLocation,
  WeatherTemperature,
  WeatherMetricsBar,
  WeatherHourlyForecast
} from '../dist/index.js';

test('WeatherApp renders authentic Lynx declarative components (<view>, <text>)', () => {
  const store = new WeatherStore();
  const state = store.getState();

  const appElement = WeatherApp(state);
  assert.equal(appElement.type, 'view');
  assert.ok(appElement.props.className.includes('weather-app-shell'));

  const timeLocation = WeatherTimeAndLocation(state);
  assert.equal(timeLocation.type, 'view');
  assert.equal(timeLocation.props.className, 'time-and-location-container');

  const tempElement = WeatherTemperature(state);
  assert.equal(tempElement.type, 'view');
  assert.equal(tempElement.props.className, 'temperature-container');

  const metricsElement = WeatherMetricsBar(state);
  assert.equal(metricsElement.type, 'view');
  assert.equal(metricsElement.props.className, 'metrics-container');

  const hourlyElement = WeatherHourlyForecast(state);
  assert.equal(hourlyElement.type, 'view');
  assert.equal(hourlyElement.props.className, 'hourly-forecast-container');
});
