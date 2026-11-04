/**
 * LynxFita Weather Showcase - MVI Model
 * Immutable state representation of weather telemetry, geo-coordinates,
 * hourly forecasts, visual theme, and error boundary states.
 */

export interface HourlyForecastItem {
  dt: number;
  temp: number;
  icon: string;
  condition: string;
}

export interface WeatherLocation {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  condition: string;
  iconCode: string;
}

export interface LocationErrorState {
  hasError: boolean;
  message?: string;
}

export interface WeatherState {
  readonly location: WeatherLocation;
  readonly current: CurrentWeather;
  readonly hourly: {
    readonly '3h': HourlyForecastItem;
    readonly '6h': HourlyForecastItem;
    readonly '12h': HourlyForecastItem;
  };
  readonly theme: 'dark' | 'light';
  readonly error: LocationErrorState;
  readonly dmaOffset: number;
  readonly lastSyncTimestamp: number;
  readonly isOfflineFallback: boolean;
}

export const INITIAL_WEATHER_STATE: WeatherState = {
  location: {
    city: 'São Paulo',
    country: 'BR',
    latitude: -23.5505,
    longitude: -46.6333
  },
  current: {
    temperature: 24.5,
    feelsLike: 25.0,
    humidity: 65.0,
    pressure: 1013.25,
    windSpeed: 12.0,
    condition: 'Partly Cloudy',
    iconCode: '02d'
  },
  hourly: {
    '3h': {
      dt: Math.floor(Date.now() / 1000) + 3 * 3600,
      temp: 23.8,
      icon: '02d',
      condition: 'Partly Cloudy'
    },
    '6h': {
      dt: Math.floor(Date.now() / 1000) + 6 * 3600,
      temp: 21.4,
      icon: '03',
      condition: 'Cloudy'
    },
    '12h': {
      dt: Math.floor(Date.now() / 1000) + 12 * 3600,
      temp: 19.2,
      icon: '01n',
      condition: 'Clear Sky'
    }
  },
  theme: 'dark',
  error: {
    hasError: false
  },
  dmaOffset: 0x2000,
  lastSyncTimestamp: Date.now(),
  isOfflineFallback: true
};
