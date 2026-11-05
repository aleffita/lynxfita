/**
 * LynxFita Weather Showcase - MVI Store & Stationary DMA Synchronizer
 * Pure unidirectional state management with zero-copy SIMD telemetry
 * stored at offset 0x2000 in the Stationary DMA arena.
 */

import { StationaryDmaClient } from '@lynxfita/core';
import { INITIAL_WEATHER_STATE, type WeatherState } from './model.js';
import type { WeatherIntent } from './intents.js';
import { WeatherApiService } from './weather_service.js';

export type StateListener = (state: WeatherState) => void;

export class WeatherStore {
  private state: WeatherState;
  private dmaClient: StationaryDmaClient;
  private apiService: WeatherApiService;
  private listeners = new Set<StateListener>();

  constructor(
    initialState: WeatherState = INITIAL_WEATHER_STATE,
    dmaClient?: StationaryDmaClient,
    apiService?: WeatherApiService
  ) {
    this.state = initialState;
    this.dmaClient = dmaClient || new StationaryDmaClient(256 * 1024);
    this.apiService = apiService || new WeatherApiService();

    // Synchronize initial state into Stationary DMA lane offset 0x2000
    this.syncToDma(this.state);
  }

  public getState(): WeatherState {
    return this.state;
  }

  public getDmaClient(): StationaryDmaClient {
    return this.dmaClient;
  }

  public getDmaTelemetry(): [number, number, number, number] {
    return this.dmaClient.unpackSimd4f(this.state.dmaOffset);
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async dispatch(intent: WeatherIntent): Promise<WeatherState> {
    switch (intent.type) {
      case 'SWITCH_SCREEN': {
        this.updateState({
          ...this.state,
          activeScreen: intent.payload.screen
        });
        break;
      }

      case 'SELECT_CITY': {
        const { city, country, lat, lon } = intent.payload;
        const fetchResult = await this.apiService.fetchWeather(lat, lon, city, country);
        this.updateState({
          ...this.state,
          activeScreen: 'forecast-home',
          location: fetchResult.location,
          current: fetchResult.current,
          hourly: fetchResult.hourly,
          isOfflineFallback: fetchResult.isOfflineFallback,
          lastSyncTimestamp: Date.now(),
          error: { hasError: false }
        });
        break;
      }

      case 'TOGGLE_THEME': {
        const nextTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.updateState({
          ...this.state,
          theme: nextTheme
        });
        break;
      }

      case 'REFRESH_WEATHER': {
        const lat = intent.payload?.lat ?? this.state.location.latitude;
        const lon = intent.payload?.lon ?? this.state.location.longitude;
        const fetchResult = await this.apiService.fetchWeather(
          lat,
          lon,
          this.state.location.city,
          this.state.location.country
        );

        this.updateState({
          ...this.state,
          location: fetchResult.location,
          current: fetchResult.current,
          hourly: fetchResult.hourly,
          isOfflineFallback: fetchResult.isOfflineFallback,
          lastSyncTimestamp: Date.now(),
          error: { hasError: false }
        });
        break;
      }

      case 'UPDATE_COORDINATES': {
        const { lat, lon, city, country } = intent.payload;
        const fetchResult = await this.apiService.fetchWeather(
          lat,
          lon,
          city || this.state.location.city,
          country || this.state.location.country
        );

        this.updateState({
          ...this.state,
          location: fetchResult.location,
          current: fetchResult.current,
          hourly: fetchResult.hourly,
          isOfflineFallback: fetchResult.isOfflineFallback,
          lastSyncTimestamp: Date.now(),
          error: { hasError: false }
        });
        break;
      }

      case 'GRANT_LOCATION_PERMISSION': {
        // Resolve error boundary and trigger fresh weather sync
        const fetchResult = await this.apiService.fetchWeather(
          this.state.location.latitude,
          this.state.location.longitude,
          this.state.location.city,
          this.state.location.country
        );

        this.updateState({
          ...this.state,
          activeScreen: 'forecast-home',
          error: { hasError: false },
          location: fetchResult.location,
          current: fetchResult.current,
          hourly: fetchResult.hourly,
          lastSyncTimestamp: Date.now()
        });
        break;
      }

      case 'TRIGGER_LOCATION_ERROR': {
        this.updateState({
          ...this.state,
          error: {
            hasError: true,
            message: intent.payload.message
          }
        });
        break;
      }

      case 'SIMULATE_OFFLINE_FALLBACK': {
        const fallback = this.apiService.deterministicOfflineFallback(
          this.state.location.latitude,
          this.state.location.longitude,
          this.state.location.city,
          this.state.location.country
        );

        this.updateState({
          ...this.state,
          location: fallback.location,
          current: fallback.current,
          hourly: fallback.hourly,
          isOfflineFallback: true,
          lastSyncTimestamp: Date.now()
        });
        break;
      }
    }

    return this.state;
  }

  private updateState(nextState: WeatherState): void {
    this.state = nextState;
    this.syncToDma(this.state);
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private syncToDma(state: WeatherState): void {
    // Pack 4-float SIMD vector: [temp, humidity, pressure, windSpeed]
    this.dmaClient.packSimd4f(
      state.dmaOffset,
      state.current.temperature,
      state.current.humidity,
      state.current.pressure,
      state.current.windSpeed
    );
  }
}
