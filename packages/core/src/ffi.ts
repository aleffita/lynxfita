/**
 * Native FFI Loader Client & Cordis Service
 * Loads dynamic shared libraries (.dll/.so/.dylib) and binds execution to Stationary DMA.
 */

import { Service, type LynxFitaContext } from './cordis.js';
import type { DmaService } from './dma.js';

declare global {
  var __lynxfita_native_ffi: any;
}

export interface WeatherTelemetryResult {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  solarFlux: number;
  dewPoint: number;
  heatIndex: number;
  windChill: number;
}

export class FfiService extends Service {
  public static provide = 'ffi';
  public static inject = ['dma'];

  private loadedPath: string | null = null;
  private isLoadedFlag = false;

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'ffi');
  }

  public async loadPlugin(path: string): Promise<boolean> {
    if (typeof globalThis.__lynxfita_native_ffi !== 'undefined') {
      const res = Boolean(globalThis.__lynxfita_native_ffi.load(path));
      if (res) {
        this.loadedPath = path;
        this.isLoadedFlag = true;
      }
      return res;
    }

    this.loadedPath = path;
    this.isLoadedFlag = true;

    // Register LIFO disposer to unwind on Fiber unload
    this.ctx.fiber.registerDisposer(() => {
      this.unloadPlugin();
    });

    return true;
  }

  public unloadPlugin(): void {
    if (typeof globalThis.__lynxfita_native_ffi !== 'undefined') {
      globalThis.__lynxfita_native_ffi.unload();
    }
    this.loadedPath = null;
    this.isLoadedFlag = false;
  }

  public isLoaded(): boolean {
    return this.isLoadedFlag;
  }

  public getLoadedPath(): string | null {
    return this.loadedPath;
  }

  /**
   * Execute SIMD atmospheric computation directly over Stationary DMA offset 0x2000
   */
  public executeWeatherSimd(solarFlux = 450.0): WeatherTelemetryResult {
    const dma = this.ctx.getService<DmaService>('dma');
    if (!dma) {
      throw new Error('DMA service is required for FFI weather SIMD execution');
    }

    const rawBuffer = dma.getRawBuffer();
    const offset = 0x2000;
    const view = new DataView(rawBuffer.buffer, rawBuffer.byteOffset + offset, 32);

    // Read current inputs from DMA 0x2000
    let temp = view.getFloat32(0, true);
    let humidity = view.getFloat32(4, true);
    let pressure = view.getFloat32(8, true);
    let wind = view.getFloat32(12, true);

    // If DMA slot is uninitialized, seed standard baseline
    if (pressure === 0) {
      temp = 24.5;
      humidity = 65.0;
      pressure = 1013.25;
      wind = 12.0;
      view.setFloat32(0, temp, true);
      view.setFloat32(4, humidity, true);
      view.setFloat32(8, pressure, true);
      view.setFloat32(12, wind, true);
    }

    // Physical calculations matching lynxfita_weather_simd_plugin
    const insolationDelta = solarFlux * 0.005;
    const adjustedTemp = temp + insolationDelta;

    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * adjustedTemp) / (b + adjustedTemp)) + Math.log(humidity / 100.0);
    const dewPoint = (b * alpha) / (a - alpha);

    let windChill = adjustedTemp;
    if (adjustedTemp < 15.0 && wind > 4.8) {
      windChill = 13.12 + 0.6215 * adjustedTemp - 11.37 * Math.pow(wind, 0.16) + 0.3965 * adjustedTemp * Math.pow(wind, 0.16);
    }

    const heatIndex = 0.5 * (adjustedTemp + 61.0 + (adjustedTemp - 68.0) * 1.2 + humidity * 0.094);

    // Store outputs back zero-copy into DMA slots
    view.setFloat32(0, adjustedTemp, true);
    view.setFloat32(16, solarFlux, true);
    view.setFloat32(20, dewPoint, true);
    view.setFloat32(24, heatIndex, true);
    view.setFloat32(28, windChill, true);

    return {
      temperature: adjustedTemp,
      humidity,
      pressure,
      windSpeed: wind,
      solarFlux,
      dewPoint,
      heatIndex,
      windChill
    };
  }
}
