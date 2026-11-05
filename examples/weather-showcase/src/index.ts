/**
 * LynxFita Weather Showcase - MVI Entry Point
 * Exports all modules and provides standalone demonstration.
 */

export * from './theme.js';
export * from './icons_map.js';
export * from './model.js';
export * from './intents.js';
export * from './weather_service.js';
export * from './store.js';
export * from './view.js';
export * from './plugin.js';

import { pathToFileURL } from 'node:url';
import { WeatherStore } from './store.js';
import { Intents } from './intents.js';
import { renderAnsiWeatherView } from './view.js';

// Interactive/Demo execution if executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('===============================================================');
  console.log('   LynxFita Weather Showcase - MVI Architecture & DMA Lane     ');
  console.log('===============================================================');

  const store = new WeatherStore();

  console.log('[Initial State]');
  console.log(renderAnsiWeatherView(store.getState()));

  console.log('\n[Dispatching Intent: TOGGLE_THEME]');
  await store.dispatch(Intents.toggleTheme());
  console.log(renderAnsiWeatherView(store.getState()));

  console.log('\n[Dispatching Intent: UPDATE_COORDINATES -> Rio de Janeiro, BR]');
  await store.dispatch(Intents.updateCoordinates(-22.9068, -43.1729, 'Rio de Janeiro', 'BR'));
  console.log(renderAnsiWeatherView(store.getState()));

  console.log('\n[Verifying Stationary DMA Lane Telemetry at 0x2000]');
  const [temp, humidity, pressure, windSpeed] = store.getDmaTelemetry();
  console.log(`DMA Memory 0x2000: Temp=${temp}°C, Humidity=${humidity}%, Pressure=${pressure}hPa, Wind=${windSpeed}km/h`);

  console.log('\nWeather Showcase demonstration completed successfully.');
}
