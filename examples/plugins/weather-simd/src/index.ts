/**
 * Standalone Cordis Plugin: Weather SIMD Telemetry & Stationary DMA
 * Demonstrates a standalone reusable Cordis plugin consuming ctx.dma with LIFO effects.
 */

import type { PluginDefinition, StationaryDmaClient } from '@lynxfita/core';

export interface WeatherSimdPluginOptions {
  baseOffset?: number | undefined;
}

export const weatherSimdPlugin: PluginDefinition = {
  meta: {
    id: 'weather-simd',
    name: 'Weather SIMD Telemetry Plugin',
    version: '1.0.0',
    dependencies: [],
    requiredCoeffects: ['hardware.dma']
  },
  activate: async (ctx) => {
    console.log('[Cordis] WeatherSimdPlugin: Activating standalone plugin...');
    const dma = ctx.getCoeffect<StationaryDmaClient>('hardware.dma');
    const baseOffset = 0x2000;

    if (dma) {
      // Pack initial 4-float vector: [temperature, humidity, pressure, windSpeed]
      dma.packSimd4f(baseOffset, 22.5, 60.0, 1013.25, 14.0);
    }

    await ctx.registerEffect(
      'weather-simd-telemetry',
      () => {
        console.log(`[Cordis] WeatherSimdPlugin: Mounted SIMD telemetry at DMA offset 0x${baseOffset.toString(16)}`);
      },
      () => {
        console.log(`[Cordis] WeatherSimdPlugin: Teardown LIFO - zeroing DMA offset 0x${baseOffset.toString(16)}`);
        if (dma) {
          dma.packSimd4f(baseOffset, 0, 0, 0, 0);
        }
      }
    );
  }
};

export default weatherSimdPlugin;
