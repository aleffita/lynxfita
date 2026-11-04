/**
 * Full Map of the 14 OpenWeatherMap Icons from aleffita/weather-showcase:
 * '01d', '01n', '02d', '02n', '03', '04d', '04n', '09', '10d', '10n', '11', '13d', '13n', '50'
 * Includes visual metadata, vector/ASCII/SVG glyphs, and atmospheric shader parameters.
 */

export interface WeatherIconMetadata {
  code: string;
  name: string;
  label: string;
  asciiGlyph: string;
  unicodeGlyph: string;
  svgIcon: string;
  shaderParams: {
    advectionSpeed: number;
    particleDensity: number;
    buoyancy: number;
    turbulence: number;
    fogOpacity: number;
  };
}

export const WEATHER_ICONS_MAP: Record<string, WeatherIconMetadata> = {
  '01d': {
    code: '01d',
    name: 'Sun',
    label: 'Céu Limpo (Dia)',
    asciiGlyph: '[SUN]',
    unicodeGlyph: '☀️',
    svgIcon: '<circle cx="12" cy="12" r="5" fill="#f9d65d"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#f9d65d" stroke-width="2"/>',
    shaderParams: { advectionSpeed: 0.1, particleDensity: 0.05, buoyancy: 0.8, turbulence: 0.05, fogOpacity: 0.0 }
  },
  '01n': {
    code: '01n',
    name: 'Moon',
    label: 'Céu Limpo (Noite)',
    asciiGlyph: '[MOON]',
    unicodeGlyph: '🌙',
    svgIcon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#f9d65d"/>',
    shaderParams: { advectionSpeed: 0.05, particleDensity: 0.05, buoyancy: 0.2, turbulence: 0.02, fogOpacity: 0.0 }
  },
  '02d': {
    code: '02d',
    name: 'FewCloudsDay',
    label: 'Poucas Nuvens (Dia)',
    asciiGlyph: '[SUN_CLOUD]',
    unicodeGlyph: '🌤️',
    svgIcon: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" fill="#e7e4e4"/><circle cx="8" cy="8" r="3" fill="#f9d65d"/>',
    shaderParams: { advectionSpeed: 0.2, particleDensity: 0.2, buoyancy: 0.5, turbulence: 0.1, fogOpacity: 0.1 }
  },
  '02n': {
    code: '02n',
    name: 'FewCloudsNight',
    label: 'Poucas Nuvens (Noite)',
    asciiGlyph: '[MOON_CLOUD]',
    unicodeGlyph: '☁️🌙',
    svgIcon: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" fill="#71717a"/><path d="M16 6a4 4 0 0 0 4 4 4 4 0 0 1-4-4z" fill="#f9d65d"/>',
    shaderParams: { advectionSpeed: 0.15, particleDensity: 0.2, buoyancy: 0.2, turbulence: 0.1, fogOpacity: 0.1 }
  },
  '03': {
    code: '03',
    name: 'Cloud',
    label: 'Nuvens Dispersas',
    asciiGlyph: '[CLOUD]',
    unicodeGlyph: '☁️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#e7e4e4"/>',
    shaderParams: { advectionSpeed: 0.3, particleDensity: 0.45, buoyancy: 0.3, turbulence: 0.2, fogOpacity: 0.25 }
  },
  '04d': {
    code: '04d',
    name: 'BrokenCloudsDay',
    label: 'Nuvens Quebradas (Dia)',
    asciiGlyph: '[HEAVY_CLOUD_DAY]',
    unicodeGlyph: '🌥️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#a1a1aa"/>',
    shaderParams: { advectionSpeed: 0.35, particleDensity: 0.6, buoyancy: 0.2, turbulence: 0.25, fogOpacity: 0.35 }
  },
  '04n': {
    code: '04n',
    name: 'BrokenCloudsNight',
    label: 'Nuvens Quebradas (Noite)',
    asciiGlyph: '[HEAVY_CLOUD_NIGHT]',
    unicodeGlyph: '☁️☁️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#52525b"/>',
    shaderParams: { advectionSpeed: 0.35, particleDensity: 0.6, buoyancy: 0.1, turbulence: 0.25, fogOpacity: 0.35 }
  },
  '09': {
    code: '09',
    name: 'ShowerRain',
    label: 'Chuva Forte Passageira',
    asciiGlyph: '[SHOWER_RAIN]',
    unicodeGlyph: '🌧️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#64748b"/><path d="M8 21l2 4M12 21l2 4M16 21l2 4" stroke="#38bdf8" stroke-width="2"/>',
    shaderParams: { advectionSpeed: 0.6, particleDensity: 0.8, buoyancy: -0.5, turbulence: 0.6, fogOpacity: 0.5 }
  },
  '10d': {
    code: '10d',
    name: 'RainDay',
    label: 'Chuva Moderada (Dia)',
    asciiGlyph: '[RAIN_DAY]',
    unicodeGlyph: '🌦️',
    svgIcon: '<path d="M17 10h-1.26A8 8 0 1 0 9 20h8a5 5 0 0 0 0-10z" fill="#94a3b8"/><circle cx="6" cy="6" r="2.5" fill="#f9d65d"/><path d="M9 22l1 3M13 22l1 3" stroke="#38bdf8" stroke-width="2"/>',
    shaderParams: { advectionSpeed: 0.5, particleDensity: 0.65, buoyancy: -0.4, turbulence: 0.45, fogOpacity: 0.4 }
  },
  '10n': {
    code: '10n',
    name: 'RainNight',
    label: 'Chuva Moderada (Noite)',
    asciiGlyph: '[RAIN_NIGHT]',
    unicodeGlyph: '🌧️🌙',
    svgIcon: '<path d="M17 10h-1.26A8 8 0 1 0 9 20h8a5 5 0 0 0 0-10z" fill="#475569"/><path d="M9 22l1 3M13 22l1 3" stroke="#38bdf8" stroke-width="2"/>',
    shaderParams: { advectionSpeed: 0.45, particleDensity: 0.65, buoyancy: -0.4, turbulence: 0.45, fogOpacity: 0.4 }
  },
  '11': {
    code: '11',
    name: 'ThunderStorm',
    label: 'Tempestade Elétrica',
    asciiGlyph: '[THUNDERSTORM]',
    unicodeGlyph: '⛈️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#334155"/><path d="M13 20l-3 5h4l-2 5" stroke="#f9d65d" stroke-width="2" fill="none"/>',
    shaderParams: { advectionSpeed: 0.85, particleDensity: 0.95, buoyancy: -0.7, turbulence: 0.9, fogOpacity: 0.7 }
  },
  '13d': {
    code: '13d',
    name: 'SnowDay',
    label: 'Neve (Dia)',
    asciiGlyph: '[SNOW_DAY]',
    unicodeGlyph: '🌨️',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#cbd5e1"/><circle cx="9" cy="22" r="1.5" fill="#f8fafc"/><circle cx="14" cy="23" r="1.5" fill="#f8fafc"/>',
    shaderParams: { advectionSpeed: 0.25, particleDensity: 0.5, buoyancy: -0.15, turbulence: 0.35, fogOpacity: 0.3 }
  },
  '13n': {
    code: '13n',
    name: 'SnowNight',
    label: 'Neve (Noite)',
    asciiGlyph: '[SNOW_NIGHT]',
    unicodeGlyph: '❄️🌙',
    svgIcon: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#475569"/><circle cx="9" cy="22" r="1.5" fill="#f8fafc"/><circle cx="14" cy="23" r="1.5" fill="#f8fafc"/>',
    shaderParams: { advectionSpeed: 0.2, particleDensity: 0.5, buoyancy: -0.15, turbulence: 0.3, fogOpacity: 0.3 }
  },
  '50': {
    code: '50',
    name: 'Mist',
    label: 'Nevoeiro / Névoa',
    asciiGlyph: '[MIST]',
    unicodeGlyph: '🌫️',
    svgIcon: '<path d="M4 14h16M4 18h16M6 10h12M8 6h8" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>',
    shaderParams: { advectionSpeed: 0.08, particleDensity: 0.7, buoyancy: 0.05, turbulence: 0.15, fogOpacity: 0.85 }
  }
};

export function resolveWeatherIcon(iconCode: string): WeatherIconMetadata {
  const normalized = iconCode.replace(/[dn]$/, '');
  return WEATHER_ICONS_MAP[iconCode] ||
         WEATHER_ICONS_MAP[normalized] ||
         WEATHER_ICONS_MAP['01d']!;
}
