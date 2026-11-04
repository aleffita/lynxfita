/**
 * LynxFita Weather Showcase - CORDIS Spatiotemporal Plugin
 * Integrates Weather Showcase MVI into CORDIS PluginLedger.
 * Requires coeffects ('hardware.dma', 'ui.shader.wgsl') and registers
 * reversible effects with full LIFO rollback on deactivation.
 */

import type { PluginDefinition, PluginContext } from '@lynxfita/core';
import { WeatherStore } from './store.js';
import { Intents } from './intents.js';

export function createWeatherShowcasePlugin(customStore?: WeatherStore): PluginDefinition {
  return {
    meta: {
      id: 'weather-showcase-mvi',
      name: 'Weather Showcase MVI',
      version: '2.0.0',
      dependencies: [],
      requiredCoeffects: ['hardware.dma', 'ui.shader.wgsl']
    },
    activate: async (ctx: PluginContext) => {
      console.log('[CORDIS] Activating weather-showcase-mvi plugin...');

      const store = customStore || new WeatherStore();

      // 1. Reversible Effect: Stationary DMA Telemetry Slot Allocation
      await ctx.registerEffect(
        'dma-stationary-telemetry-slot',
        () => {
          console.log('  -> [Effect] Bound DMA slot 0x2000 for SIMD weather telemetry');
          const dma = store.getDmaClient();
          dma.packSimd4f(0x2000, 24.5, 65.0, 1013.25, 12.0);
        },
        () => {
          console.log('  -> [Rollback] Released DMA slot 0x2000');
          const dma = store.getDmaClient();
          dma.packSimd4f(0x2000, 0, 0, 0, 0); // zero out memory on deactivation
        }
      );

      // 2. Reversible Effect: MVI Store Subscription
      let unsub: (() => void) | null = null;
      await ctx.registerEffect(
        'mvi-store-subscription',
        () => {
          console.log('  -> [Effect] Mounted MVI state change subscriber');
          unsub = store.subscribe((_state) => {
            // State telemetry propagated
          });
        },
        () => {
          console.log('  -> [Rollback] Unsubscribed MVI listener');
          if (unsub) {
            unsub();
            unsub = null;
          }
        }
      );

      // Trigger initial state sync
      await store.dispatch(Intents.refreshWeather());
    }
  };
}

export const WeatherShowcasePlugin = createWeatherShowcasePlugin();
