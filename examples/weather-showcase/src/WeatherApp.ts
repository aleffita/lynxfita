/**
 * LynxFita Weather Showcase - Declarative Lynx View Components
 * Adheres to @lynx-js/react and Lynxtron desktop template standards:
 * Produces structured Lynx AST primitives (<view>, <text>, <image>).
 */

import type { WeatherState, HourlyForecastItem } from './model.js';
import { resolveWeatherIcon } from './icons_map.js';
import type { LynxVirtualNode } from './view.js';

export function createLynxElement(
  type: string,
  props: Record<string, any> = {},
  children: (LynxVirtualNode | string)[] = []
): LynxVirtualNode {
  return { type, props, children };
}

export function WeatherTimeAndLocation(state: WeatherState): LynxVirtualNode {
  return createLynxElement('view', { className: 'time-and-location-container' }, [
    createLynxElement('text', { className: 'date-time-title' }, [`${state.location.city}, ${state.location.country}`]),
    createLynxElement('text', { className: 'date-time-coordinates' }, [
      `${state.location.latitude.toFixed(2)}N, ${state.location.longitude.toFixed(2)}W`
    ])
  ]);
}

export function WeatherTemperature(state: WeatherState): LynxVirtualNode {
  const icon = resolveWeatherIcon(state.current.iconCode);
  return createLynxElement('view', { className: 'temperature-container' }, [
    createLynxElement('view', { className: 'temperature-badge' }, [
      createLynxElement('text', { className: 'weather-glyph' }, [icon.unicodeGlyph]),
      createLynxElement('text', { className: 'temperature-text' }, [`${Math.round(state.current.temperature)}°C`])
    ]),
    createLynxElement('text', { className: 'temperature-condition' }, [state.current.condition]),
    createLynxElement('text', { className: 'temperature-feels-like' }, [`Feels like ${Math.round(state.current.feelsLike)}°C`])
  ]);
}

export function WeatherMetricsBar(state: WeatherState): LynxVirtualNode {
  return createLynxElement('view', { className: 'metrics-container' }, [
    createLynxElement('view', { className: 'metric-card' }, [
      createLynxElement('text', { className: 'metric-label' }, ['HUMIDITY']),
      createLynxElement('text', { className: 'metric-value' }, [`${Math.round(state.current.humidity)}%`])
    ]),
    createLynxElement('view', { className: 'metric-card' }, [
      createLynxElement('text', { className: 'metric-label' }, ['PRESSURE']),
      createLynxElement('text', { className: 'metric-value' }, [`${Math.round(state.current.pressure)} hPa`])
    ]),
    createLynxElement('view', { className: 'metric-card' }, [
      createLynxElement('text', { className: 'metric-label' }, ['WIND']),
      createLynxElement('text', { className: 'metric-value' }, [`${Math.round(state.current.windSpeed)} km/h`])
    ])
  ]);
}

export function WeatherHourlyForecast(state: WeatherState): LynxVirtualNode {
  const items: [string, HourlyForecastItem][] = [
    ['+3h', state.hourly['3h']],
    ['+6h', state.hourly['6h']],
    ['+12h', state.hourly['12h']]
  ];

  const columns = items.map(([label, item]) => {
    const icon = resolveWeatherIcon(item.icon);
    return createLynxElement('view', { className: 'forecast-col', interval: label }, [
      createLynxElement('text', { className: 'forecast-time' }, [label]),
      createLynxElement('text', { className: 'forecast-icon' }, [icon.unicodeGlyph]),
      createLynxElement('text', { className: 'forecast-temp' }, [`${Math.round(item.temp)}°C`])
    ]);
  });

  return createLynxElement('view', { className: 'hourly-forecast-container' }, [
    createLynxElement('text', { className: 'forecast-title' }, ['HOURLY FORECAST']),
    createLynxElement('view', { className: 'forecast-row' }, columns)
  ]);
}

export function WeatherApp(state: WeatherState): LynxVirtualNode {
  const isDark = state.theme === 'dark';
  return createLynxElement('view', { className: `weather-app-shell ${isDark ? 'theme-dark' : 'theme-light'}` }, [
    createLynxElement('view', { className: 'weather-header' }, [
      createLynxElement('text', { className: 'brand-title' }, ['LynxFita Weather'])
    ]),
    WeatherTimeAndLocation(state),
    WeatherTemperature(state),
    WeatherMetricsBar(state),
    WeatherHourlyForecast(state)
  ]);
}
