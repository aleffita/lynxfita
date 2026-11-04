/**
 * LynxFita Weather Showcase - Weather API Service
 * Fetches data from OpenWeatherMap endpoints with 1000ms AbortController timeout,
 * and provides automatic deterministic WASI/DMA fallback.
 */

import type { WeatherLocation, CurrentWeather, HourlyForecastItem } from './model.js';

export interface WeatherFetchResult {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: {
    '3h': HourlyForecastItem;
    '6h': HourlyForecastItem;
    '12h': HourlyForecastItem;
  };
  isOfflineFallback: boolean;
}

export class WeatherApiService {
  private apiKey: string | null;
  private timeoutMs: number;
  private baseUrl: string;

  constructor(apiKey?: string, timeoutMs = 1000, baseUrl = 'https://api.openweathermap.org') {
    this.apiKey = apiKey || (typeof process !== 'undefined' ? process.env?.OPENWEATHER_API_KEY || null : null);
    this.timeoutMs = timeoutMs;
    this.baseUrl = baseUrl;
  }

  public async fetchWeather(lat: number, lon: number, cityName = 'São Paulo', countryCode = 'BR'): Promise<WeatherFetchResult> {
    if (!this.apiKey) {
      return this.deterministicOfflineFallback(lat, lon, cityName, countryCode);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const weatherUrl = `${this.baseUrl}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`;
      const onecallUrl = `${this.baseUrl}/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=daily,minutely,current,alerts&units=metric&appid=${this.apiKey}`;

      const [weatherResp, onecallResp] = await Promise.all([
        fetch(weatherUrl, { signal: controller.signal }),
        fetch(onecallUrl, { signal: controller.signal })
      ]);

      clearTimeout(timer);

      if (!weatherResp.ok) {
        return this.deterministicOfflineFallback(lat, lon, cityName, countryCode);
      }

      const weatherData = await weatherResp.json();
      let hourlyData: any = null;
      if (onecallResp.ok) {
        hourlyData = await onecallResp.json();
      }

      const nowSec = Math.floor(Date.now() / 1000);
      return {
        location: {
          city: weatherData.name || cityName,
          country: weatherData.sys?.country || countryCode,
          latitude: lat,
          longitude: lon
        },
        current: {
          temperature: weatherData.main?.temp ?? 22.0,
          feelsLike: weatherData.main?.feels_like ?? 22.0,
          humidity: weatherData.main?.humidity ?? 50.0,
          pressure: weatherData.main?.pressure ?? 1013.25,
          windSpeed: weatherData.wind?.speed ?? 5.0,
          condition: weatherData.weather?.[0]?.description ?? 'Clear',
          iconCode: weatherData.weather?.[0]?.icon ?? '01d'
        },
        hourly: {
          '3h': {
            dt: hourlyData?.hourly?.[3]?.dt ?? (nowSec + 3 * 3600),
            temp: hourlyData?.hourly?.[3]?.temp ?? (weatherData.main?.temp ?? 22.0),
            icon: hourlyData?.hourly?.[3]?.weather?.[0]?.icon ?? '02d',
            condition: hourlyData?.hourly?.[3]?.weather?.[0]?.description ?? 'Partly Cloudy'
          },
          '6h': {
            dt: hourlyData?.hourly?.[6]?.dt ?? (nowSec + 6 * 3600),
            temp: hourlyData?.hourly?.[6]?.temp ?? (weatherData.main?.temp ?? 21.0),
            icon: hourlyData?.hourly?.[6]?.weather?.[0]?.icon ?? '03',
            condition: hourlyData?.hourly?.[6]?.weather?.[0]?.description ?? 'Cloudy'
          },
          '12h': {
            dt: hourlyData?.hourly?.[12]?.dt ?? (nowSec + 12 * 3600),
            temp: hourlyData?.hourly?.[12]?.temp ?? (weatherData.main?.temp ?? 19.0),
            icon: hourlyData?.hourly?.[12]?.weather?.[0]?.icon ?? '01n',
            condition: hourlyData?.hourly?.[12]?.weather?.[0]?.description ?? 'Clear Sky'
          }
        },
        isOfflineFallback: false
      };
    } catch {
      clearTimeout(timer);
      return this.deterministicOfflineFallback(lat, lon, cityName, countryCode);
    }
  }

  public deterministicOfflineFallback(
    lat: number,
    lon: number,
    cityName = 'São Paulo',
    countryCode = 'BR'
  ): WeatherFetchResult {
    // Deterministic simulation based on coordinate hashes
    const hash = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233)) * 43758.5453;
    const baseTemp = 18.0 + (hash % 14.0); // 18 - 32 °C
    const humidity = 40.0 + (hash % 50.0); // 40 - 90 %
    const pressure = 1008.0 + (hash % 15.0); // 1008 - 1023 hPa
    const windSpeed = 3.0 + (hash % 18.0); // 3 - 21 km/h

    const nowSec = Math.floor(Date.now() / 1000);

    return {
      location: {
        city: cityName,
        country: countryCode,
        latitude: lat,
        longitude: lon
      },
      current: {
        temperature: Math.round(baseTemp * 10) / 10,
        feelsLike: Math.round((baseTemp + 1.2) * 10) / 10,
        humidity: Math.round(humidity * 10) / 10,
        pressure: Math.round(pressure * 10) / 10,
        windSpeed: Math.round(windSpeed * 10) / 10,
        condition: 'Clear Sky (DMA Telemetry)',
        iconCode: '01d'
      },
      hourly: {
        '3h': {
          dt: nowSec + 3 * 3600,
          temp: Math.round((baseTemp - 0.8) * 10) / 10,
          icon: '02d',
          condition: 'Few Clouds'
        },
        '6h': {
          dt: nowSec + 6 * 3600,
          temp: Math.round((baseTemp - 2.5) * 10) / 10,
          icon: '03',
          condition: 'Scattered Clouds'
        },
        '12h': {
          dt: nowSec + 12 * 3600,
          temp: Math.round((baseTemp - 4.5) * 10) / 10,
          icon: '01n',
          condition: 'Clear Night'
        }
      },
      isOfflineFallback: true
    };
  }
}
