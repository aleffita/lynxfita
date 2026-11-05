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

// 8. Interactive HTML / Canvas / DOM Multi-Screen Renderer
export function renderHtmlWeatherApp(state: WeatherState): string {
  const theme = getTheme(state.theme);
  const icon = resolveWeatherIcon(state.current.iconCode);
  const isDark = state.theme === 'dark';
  const cardBg = isDark ? '#222232' : '#ffffff';
  const borderCol = isDark ? '#333344' : '#e0e0e0';
  const textMuted = isDark ? '#a0a0b0' : '#666666';

  const screen = state.activeScreen || 'forecast-home';

  let screenContent = '';

  if (screen === 'location-error-boundary' || state.error.hasError) {
    screenContent = `
      <div class="screen-error" style="padding: 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h3 style="color: #ff6b6b; margin-bottom: 8px;">Erro de Localização</h3>
        <p style="color: ${textMuted}; margin-bottom: 24px;">${state.error.message || 'Por favor, permita o acesso à localização.'}</p>
        <button onclick="dispatchWeatherIntent({ type: 'GRANT_LOCATION_PERMISSION' })"
                style="background: #f9d65d; color: #1a1a24; font-weight: bold; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">
          Conceder Permissão
        </button>
      </div>
    `;
  } else if (screen === 'hourly-detail') {
    screenContent = `
      <div class="screen-hourly" style="padding: 20px;">
        <h3 style="margin-top: 0; color: #f9d65d;">Detalhamento Horário (24h)</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px; text-align: center;">
            <div style="color: ${textMuted}; font-size: 13px;">+3 HORAS</div>
            <div style="font-size: 28px; margin: 8px 0;">${resolveWeatherIcon(state.hourly['3h'].icon).unicodeGlyph}</div>
            <div style="font-size: 22px; font-weight: bold;">${state.hourly['3h'].temp.toFixed(1)}°C</div>
            <div style="font-size: 12px; color: ${textMuted};">${state.hourly['3h'].condition}</div>
          </div>
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px; text-align: center;">
            <div style="color: ${textMuted}; font-size: 13px;">+6 HORAS</div>
            <div style="font-size: 28px; margin: 8px 0;">${resolveWeatherIcon(state.hourly['6h'].icon).unicodeGlyph}</div>
            <div style="font-size: 22px; font-weight: bold;">${state.hourly['6h'].temp.toFixed(1)}°C</div>
            <div style="font-size: 12px; color: ${textMuted};">${state.hourly['6h'].condition}</div>
          </div>
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px; text-align: center;">
            <div style="color: ${textMuted}; font-size: 13px;">+12 HORAS</div>
            <div style="font-size: 28px; margin: 8px 0;">${resolveWeatherIcon(state.hourly['12h'].icon).unicodeGlyph}</div>
            <div style="font-size: 22px; font-weight: bold;">${state.hourly['12h'].temp.toFixed(1)}°C</div>
            <div style="font-size: 12px; color: ${textMuted};">${state.hourly['12h'].condition}</div>
          </div>
        </div>
        <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: ${textMuted};">CURVA DE TEMPERATURA</h4>
          <div style="display: flex; align-items: flex-end; height: 120px; gap: 20px; padding: 0 10px;">
            <div style="flex: 1; text-align: center;">
              <div style="height: ${Math.max(20, state.current.temperature * 3)}px; background: #f9d65d; border-radius: 4px 4px 0 0;"></div>
              <div style="font-size: 11px; margin-top: 6px;">Agora</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="height: ${Math.max(20, state.hourly['3h'].temp * 3)}px; background: #f9d65d; border-radius: 4px 4px 0 0;"></div>
              <div style="font-size: 11px; margin-top: 6px;">+3h</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="height: ${Math.max(20, state.hourly['6h'].temp * 3)}px; background: #f9d65d; border-radius: 4px 4px 0 0;"></div>
              <div style="font-size: 11px; margin-top: 6px;">+6h</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="height: ${Math.max(20, state.hourly['12h'].temp * 3)}px; background: #f9d65d; border-radius: 4px 4px 0 0;"></div>
              <div style="font-size: 11px; margin-top: 6px;">+12h</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (screen === 'city-search') {
    screenContent = `
      <div class="screen-search" style="padding: 20px;">
        <h3 style="margin-top: 0; color: #f9d65d;">Buscar Cidade & Região</h3>
        <div style="margin-bottom: 20px;">
          <input type="text" id="citySearchInput" placeholder="Digite o nome da cidade..."
                 style="width: 100%; box-sizing: border-box; padding: 12px 16px; border-radius: 8px; border: 1px solid ${borderCol}; background: ${cardBg}; color: inherit; font-size: 15px;"
                 onkeydown="if (event.key === 'Enter') selectCity(this.value)" />
        </div>
        <h4 style="margin: 0 0 12px 0; font-size: 13px; color: ${textMuted};">CIDADES SUGERIDAS</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <button onclick="dispatchWeatherIntent({ type: 'SELECT_CITY', payload: { city: 'São Paulo', country: 'BR', lat: -23.5505, lon: -46.6333 } })"
                  style="text-align: left; padding: 14px; background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; color: inherit; cursor: pointer;">
            <div style="font-weight: bold;">São Paulo</div>
            <div style="font-size: 12px; color: ${textMuted};">Brasil (24.5°C)</div>
          </button>
          <button onclick="dispatchWeatherIntent({ type: 'SELECT_CITY', payload: { city: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 } })"
                  style="text-align: left; padding: 14px; background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; color: inherit; cursor: pointer;">
            <div style="font-weight: bold;">Tokyo</div>
            <div style="font-size: 12px; color: ${textMuted};">Japão (18.0°C)</div>
          </button>
          <button onclick="dispatchWeatherIntent({ type: 'SELECT_CITY', payload: { city: 'London', country: 'UK', lat: 51.5074, lon: -0.1278 } })"
                  style="text-align: left; padding: 14px; background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; color: inherit; cursor: pointer;">
            <div style="font-weight: bold;">London</div>
            <div style="font-size: 12px; color: ${textMuted};">Reino Unido (15.2°C)</div>
          </button>
          <button onclick="dispatchWeatherIntent({ type: 'SELECT_CITY', payload: { city: 'New York', country: 'US', lat: 40.7128, lon: -74.0060 } })"
                  style="text-align: left; padding: 14px; background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; color: inherit; cursor: pointer;">
            <div style="font-weight: bold;">New York</div>
            <div style="font-size: 12px; color: ${textMuted};">Estados Unidos (19.8°C)</div>
          </button>
        </div>
      </div>
    `;
  } else if (screen === 'atmosphere-radar') {
    screenContent = `
      <div class="screen-radar" style="padding: 20px;">
        <h3 style="margin-top: 0; color: #f9d65d;">Condições Atmosféricas & Radar</h3>
        <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
          <div style="color: #f9d65d; font-weight: bold; margin-bottom: 8px;">DADOS METEOROLÓGICOS DETALHADOS</div>
          <div style="font-size: 13px; line-height: 1.8;">
            Temperatura Atual: ${state.current.temperature.toFixed(1)} °C<br/>
            Umidade Relativa: ${state.current.humidity.toFixed(0)} %<br/>
            Pressão Atmosférica: ${state.current.pressure.toFixed(0)} hPa<br/>
            Velocidade do Vento: ${state.current.windSpeed.toFixed(1)} km/h<br/>
            Ponto de Orvalho: ${(state.current.temperature - ((100 - state.current.humidity) / 5)).toFixed(1)} °C<br/>
            Sensação Térmica: ${(state.current.temperature + 1.2).toFixed(1)} °C
          </div>
        </div>
        <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #f9d65d;">Simulação de Fluxo de Ar</span>
          </div>
          <canvas id="atmosphereCanvas" width="400" height="100" style="width: 100%; height: 100px; background: #0e0e16; border-radius: 6px; display: block;"></canvas>
        </div>
      </div>
    `;
  } else {
    // forecast-home (Default)
    screenContent = `
      <div class="screen-home" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
          <div>
            <div style="font-size: 26px; font-weight: bold;">${state.location.city}, ${state.location.country}</div>
            <div style="color: ${textMuted}; font-size: 13px;">${new Date(state.lastSyncTimestamp).toLocaleDateString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style="font-size: 44px;">${icon.unicodeGlyph}</div>
        </div>
        <div style="display: flex; align-items: baseline; margin-bottom: 16px;">
          <span style="font-size: 64px; font-weight: bold; color: #f9d65d;">${Math.round(state.current.temperature)}</span>
          <span style="font-size: 32px; color: #f9d65d; margin-right: 16px;">°C</span>
          <span style="font-size: 18px; color: ${textMuted};">${state.current.condition}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: ${textMuted};">UMIDADE</div>
            <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">${state.current.humidity}%</div>
          </div>
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: ${textMuted};">PRESSÃO</div>
            <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">${state.current.pressure} hPa</div>
          </div>
          <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: ${textMuted};">VENTO</div>
            <div style="font-size: 16px; font-weight: bold; margin-top: 4px;">${state.current.windSpeed} km/h</div>
          </div>
        </div>
        <div style="background: ${cardBg}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 16px;">
          <div style="font-size: 13px; font-weight: bold; color: ${textMuted}; margin-bottom: 12px;">PREVISÃO PRÓXIMAS HORAS</div>
          <div style="display: flex; justify-content: space-around;">
            <div style="text-align: center;">
              <div style="font-size: 12px; color: ${textMuted};">+3h</div>
              <div style="font-size: 22px; margin: 4px 0;">${resolveWeatherIcon(state.hourly['3h'].icon).unicodeGlyph}</div>
              <div style="font-weight: bold;">${state.hourly['3h'].temp.toFixed(0)}°C</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 12px; color: ${textMuted};">+6h</div>
              <div style="font-size: 22px; margin: 4px 0;">${resolveWeatherIcon(state.hourly['6h'].icon).unicodeGlyph}</div>
              <div style="font-weight: bold;">${state.hourly['6h'].temp.toFixed(0)}°C</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 12px; color: ${textMuted};">+12h</div>
              <div style="font-size: 22px; margin: 4px 0;">${resolveWeatherIcon(state.hourly['12h'].icon).unicodeGlyph}</div>
              <div style="font-weight: bold;">${state.hourly['12h'].temp.toFixed(0)}°C</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="weather-showcase-app" style="background: ${theme.bgColor}; color: ${theme.textColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 12px; overflow: hidden; border: 1px solid ${borderCol}; max-width: 540px; margin: 0 auto;">
      <!-- Top Navigation Tabs -->
      <div style="display: flex; border-bottom: 1px solid ${borderCol}; background: ${isDark ? '#14141e' : '#f5f5f5'};">
        <button onclick="dispatchWeatherIntent({ type: 'SWITCH_SCREEN', payload: { screen: 'forecast-home' } })"
                style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: ${screen === 'forecast-home' ? 'bold' : 'normal'}; background: none; border: none; border-bottom: 2px solid ${screen === 'forecast-home' ? '#f9d65d' : 'transparent'}; color: inherit; cursor: pointer;">
          Home
        </button>
        <button onclick="dispatchWeatherIntent({ type: 'SWITCH_SCREEN', payload: { screen: 'hourly-detail' } })"
                style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: ${screen === 'hourly-detail' ? 'bold' : 'normal'}; background: none; border: none; border-bottom: 2px solid ${screen === 'hourly-detail' ? '#f9d65d' : 'transparent'}; color: inherit; cursor: pointer;">
          Horas
        </button>
        <button onclick="dispatchWeatherIntent({ type: 'SWITCH_SCREEN', payload: { screen: 'city-search' } })"
                style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: ${screen === 'city-search' ? 'bold' : 'normal'}; background: none; border: none; border-bottom: 2px solid ${screen === 'city-search' ? '#f9d65d' : 'transparent'}; color: inherit; cursor: pointer;">
          Cidades
        </button>
        <button onclick="dispatchWeatherIntent({ type: 'SWITCH_SCREEN', payload: { screen: 'location-error-boundary' } })"
                style="flex: 1; padding: 12px 6px; font-size: 12px; font-weight: ${screen === 'location-error-boundary' ? 'bold' : 'normal'}; background: none; border: none; border-bottom: 2px solid ${screen === 'location-error-boundary' ? '#f9d65d' : 'transparent'}; color: inherit; cursor: pointer;">
          Erro
        </button>
        <button onclick="dispatchWeatherIntent({ type: 'TOGGLE_THEME' })" title="Alternar Tema"
                style="padding: 12px 14px; background: none; border: none; color: inherit; cursor: pointer; font-size: 14px;">
          ${isDark ? '☀️' : '🌙'}
        </button>
      </div>

      <!-- Active Screen Body -->
      ${screenContent}
    </div>
  `;
}

// 9. Rich ANSI Console Renderer
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
| Status: Sincronizado | Modo: ${state.isOfflineFallback ? 'Offline (Previsão Local)' : 'Live OpenWeatherMap API'}
+-------------------------------------------------------------+
| Previsão Horária (Hourly Forecast):                         |
|   +3h:  ${formatTimeAMPM(state.hourly['3h'].dt)} -> ${state.hourly['3h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['3h'].icon).unicodeGlyph} (${state.hourly['3h'].condition})
|   +6h:  ${formatTimeAMPM(state.hourly['6h'].dt)} -> ${state.hourly['6h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['6h'].icon).unicodeGlyph} (${state.hourly['6h'].condition})
|   +12h: ${formatTimeAMPM(state.hourly['12h'].dt)} -> ${state.hourly['12h'].temp.toFixed(0)}°C ${resolveWeatherIcon(state.hourly['12h'].icon).unicodeGlyph} (${state.hourly['12h'].condition})
+-------------------------------------------------------------+
`;
}
