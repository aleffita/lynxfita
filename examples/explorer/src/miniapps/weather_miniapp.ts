/**
 * Weather Showcase Mini-App Host Adapter
 * Integrates the complete MVI Weather Showcase into the Super-App
 * within an isolated child Cordis Fiber.
 */

import type { LynxFitaContext } from '@lynxfita/core';
import type { MiniAppMetadata } from '../lib/miniapp_container.js';
import {
  WeatherStore,
  renderHtmlWeatherApp,
  type WeatherState
} from '@lynxfita/example-weather-showcase';

export const WEATHER_MINIAPP_META: MiniAppMetadata = {
  id: 'weather-showcase',
  name: 'Weather Showcase',
  icon: '🌤️',
  description: 'Multi-screen MVI weather radar with WebGPU WGSL atmospheric shader.',
  version: '2.1.0',
  author: 'Alef Oliveira (Alefita) <me@aleffita.dev>',
  inject: ['dma']
};

export interface WeatherMiniAppSession {
  store: WeatherStore;
  renderHtml: () => string;
  dispatch: (intent: any) => Promise<WeatherState>;
  onShow: () => void;
  onHide: () => void;
}

export async function createWeatherMiniApp(
  context: LynxFitaContext
): Promise<{
  onShow: () => void;
  onHide: () => void;
  renderHtml: () => string;
  dispatch: (intent: any) => Promise<WeatherState>;
}> {
  const store = new WeatherStore(undefined, context.dma);

  // Register Cordis effect disposer
  context.effect(() => {
    return () => {
      // Unwind all subscriptions and memory references
    };
  });

  return {
    onShow: () => {
      // Refresh state or resume polling
    },
    onHide: () => {
      // Pause timers
    },
    renderHtml: () => {
      const state = store.getState();
      return renderHtmlWeatherApp(state);
    },
    dispatch: (intent: any) => store.dispatch(intent)
  };
}
