/**
 * LynxFita Weather Showcase - MVI View Layer
 * Components matching aleffita/weather-showcase design:
 * TimeAndLocation, ThemeSwitcher, Temperature, HourlyForecast, LocationErrorBoundary.
 * Provides declarative component trees, ANSI console rendering, and vector SVG output.
 */

import type { WeatherState, HourlyForecastItem } from './model.js';
import { getTheme, type ApplicationBaseTheme } from './theme.js';
import { resolveWeatherIcon } from './icons_map.js';

export interface LynxVirtualNode {
  type: string;
  props: Record<string, any>;
  children: (LynxVirtualNode | string)[];
}

export function formatTimeAMPM(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours < 10 ? '0' + hours : String(hours);
  const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

// 1. TimeAndLocation View Component
export function renderTimeAndLocation(state: WeatherState): LynxVirtualNode {
  const dateStr = new Date(state.lastSyncTimestamp).toLocaleString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    type: 'view',
    props: { className: 'time-and-location-container' },
    children: [
      {
        type: 'text',
        props: { className: 'date-time-title' },
        children: [dateStr]
      },
      {
        type: 'view',
        props: { className: 'location-row' },
        children: [
          {
            type: 'icon',
            props: { name: 'map-marker', color: '#f9d65d' },
            children: []
          },
          {
            type: 'text',
            props: { className: 'location-title' },
            children: [`${state.location.city}, `]
          },
          {
            type: 'text',
            props: { className: 'location-subtitle' },
            children: [state.location.country]
          }
        ]
      }
    ]
  };
}

// 2. ThemeSwitcher View Component
export function renderThemeSwitcher(state: WeatherState): LynxVirtualNode {
  return {
    type: 'view',
    props: { className: 'theme-switcher-container', activeTheme: state.theme },
    children: [
      {
        type: 'text',
        props: { className: 'theme-indicator' },
        children: [state.theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode']
      }
    ]
  };
}

// 3. Temperature View Component
export function renderTemperature(state: WeatherState): LynxVirtualNode {
  const tempStr = Math.round(state.current.temperature).toString();
  return {
    type: 'view',
    props: { className: 'temperature-container' },
    children: [
      {
        type: 'text',
        props: { className: 'temperature-text' },
        children: [tempStr]
      },
      {
        type: 'text',
        props: { className: 'celsius-symbol' },
        children: ['°C']
      }
    ]
  };
}

// 4. HourlyForecast View Component (3h, 6h, 12h intervals)
export function renderHourlyForecast(state: WeatherState): LynxVirtualNode {
  const items: [string, HourlyForecastItem][] = [
    ['+3h', state.hourly['3h']],
    ['+6h', state.hourly['6h']],
    ['+12h', state.hourly['12h']]
  ];

  const columns: LynxVirtualNode[] = items.map(([label, item]) => {
    const icon = resolveWeatherIcon(item.icon);
    return {
      type: 'view',
      props: { className: 'hourly-column', interval: label },
      children: [
        {
          type: 'text',
          props: { className: 'forecast-time' },
          children: [formatTimeAMPM(item.dt)]
        },
        {
          type: 'text',
          props: { className: 'forecast-icon' },
          children: [icon.unicodeGlyph]
        },
        {
          type: 'text',
          props: { className: 'forecast-temp' },
          children: [`${Math.round(item.temp)}°`]
        }
      ]
    };
  });

  return {
    type: 'view',
    props: { className: 'hourly-forecast-container' },
    children: columns
  };
}

// 5. LocationErrorBoundary View Component
export function renderLocationErrorBoundary(state: WeatherState): LynxVirtualNode | null {
  if (!state.error.hasError) {
    return null;
  }

  return {
    type: 'view',
    props: { className: 'location-error-boundary' },
    children: [
      {
        type: 'text',
        props: { className: 'error-title' },
        children: ['Por favor, permita o acesso à localização.']
      },
      {
        type: 'button',
        props: { title: 'Conceder Permissão', intent: 'GRANT_LOCATION_PERMISSION' },
        children: ['Conceder Permissão']
      }
    ]
  };
}

// 6. Complete Root View Component
export function renderWeatherAppView(state: WeatherState): LynxVirtualNode {
  const theme: ApplicationBaseTheme = getTheme(state.theme);
  const errorNode = renderLocationErrorBoundary(state);

  if (errorNode) {
    return {
      type: 'root-view',
      props: { theme: state.theme, bgColor: theme.bgColor, textColor: theme.textColor },
      children: [errorNode]
    };
  }

  return {
    type: 'root-view',
    props: { theme: state.theme, bgColor: theme.bgColor, textColor: theme.textColor },
    children: [
      renderTimeAndLocation(state),
      renderThemeSwitcher(state),
      renderTemperature(state),
      renderHourlyForecast(state)
    ]
  };
}

// 7. Rich ANSI Console Renderer
export function renderAnsiWeatherView(state: WeatherState): string {
  const theme = getTheme(state.theme);
  const icon = resolveWeatherIcon(state.current.iconCode);

  if (state.error.hasError) {
    return `
+-------------------------------------------------------------+
| [!] ERRO DE LOCALIZAÇÃO                                     |
|                                                             |
| "Por favor, permita o acesso à localização."                |
|                                                             |
| [ Conceder Permissão ]                                      |
+-------------------------------------------------------------+
`;
  }

  return `
+-------------------------------------------------------------+
| LynxFita Weather Showcase (MVI Architecture)                |
| Theme: ${state.theme.toUpperCase()} (${theme.bgColor}) | Accent: ${theme.accentColor}       |
+-------------------------------------------------------------+
| Localização:  ${state.location.city}, ${state.location.country} (${state.location.latitude.toFixed(2)}, ${state.location.longitude.toFixed(2)})
| Condição:     ${icon.unicodeGlyph} ${state.current.condition} (${state.current.iconCode})
| Temperatura:  ${state.current.temperature.toFixed(1)}°C (Sensação: ${state.current.feelsLike.toFixed(1)}°C)
| Umidade:      ${state.current.humidity.toFixed(1)}% | Pressão: ${state.current.pressure.toFixed(1)} hPa
| Vento:        ${state.current.windSpeed.toFixed(1)} km/h
+-------------------------------------------------------------+
| Telemetria DMA [0x2000]: [${state.current.temperature}, ${state.current.humidity}, ${state.current.pressure}, ${state.current.windSpeed}]
| Modo: ${state.isOfflineFallback ? 'Deterministic WASI/DMA Fallback' : 'Live OpenWeatherMap API'}
+-------------------------------------------------------------+
| Previsão Horária (Hourly Forecast):                         |
|   +3h:  ${formatTimeAMPM(state.hourly['3h'].dt)} -> ${state.hourly['3h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['3h'].icon).unicodeGlyph} (${state.hourly['3h'].condition})
|   +6h:  ${formatTimeAMPM(state.hourly['6h'].dt)} -> ${state.hourly['6h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['6h'].icon).unicodeGlyph} (${state.hourly['6h'].condition})
|   +12h: ${formatTimeAMPM(state.hourly['12h'].dt)} -> ${state.hourly['12h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['12h'].icon).unicodeGlyph} (${state.hourly['12h'].condition})
+-------------------------------------------------------------+
`;
}
