/**
 * WIT & Native SIMD FFI Studio Mini-App
 * Universal WebAssembly Interface Types (WIT) module inspector,
 * code generator, and C++20 SIMD FFI dynamic execution engine.
 */

import type { LynxFitaContext } from '@lynxfita/core';
import type { MiniAppMetadata } from '../lib/miniapp_container.js';
import { parseWitSpec } from '@lynxfita/codegen';

export const WIT_FFI_STUDIO_META: MiniAppMetadata = {
  id: 'wit-ffi-studio',
  name: 'WIT & Native SIMD Studio',
  icon: '⚡',
  description: 'Universal WIT module compiler and real C++20 dynamic FFI library SIMD vector engine.',
  version: '2.1.0',
  author: 'Alef Oliveira (Alefita) <me@aleffita.dev>',
  inject: ['dma']
};

const SAMPLE_WIT = `
interface weather-sensor {
  record observation {
    station-id: string,
    temperature-c: f32,
    humidity-pct: f32,
    wind-speed-mps: f32,
  }

  compute-advection: func(temps: list<f32>, wind-speed: f32) -> list<f32>;
  pack-telemetry: func(obs: observation) -> list<u8>;
}
`.trim();

export interface WitStudioState {
  witSource: string;
  compiledAstJson: string;
  simdExecuted: boolean;
  simdInput: number[];
  simdOutput: number[];
  simdLatencyUs: number;
}

export async function createWitFfiStudioMiniApp(
  context: LynxFitaContext
): Promise<{
  onShow: () => void;
  onHide: () => void;
  renderHtml: () => string;
}> {
  const dma = context.dma;
  const state: WitStudioState = {
    witSource: SAMPLE_WIT,
    compiledAstJson: JSON.stringify(parseWitSpec(SAMPLE_WIT), null, 2),
    simdExecuted: false,
    simdInput: [18.5, 21.0, 24.5, 22.0, 19.5, 23.0, 26.0, 20.5],
    simdOutput: [],
    simdLatencyUs: 0
  };

  // Register Cordis effect
  context.effect(() => {
    return () => {
      // Clear SIMD DMA buffer area
      if (dma) {
        const slot = dma.getSlot(0x2000, 4096);
        slot.fill(0);
      }
    };
  });

  return {
    onShow: () => {},
    onHide: () => {},
    renderHtml: () => {
      if (dma) {
        const slot = dma.getSlot(0x2000, 32);
        const f32 = new Float32Array(slot.buffer, slot.byteOffset, 8);
        if (f32[0] !== 0) {
          state.simdOutput = Array.from(f32);
          state.simdExecuted = true;
        }
      }
      return `
<div style="padding: 1.5rem; max-width: 1100px; margin: 0 auto; color: #ffffff;">
  <div style="margin-bottom: 1.5rem;">
    <h2 style="font-size: 1.4rem; font-weight: 700; margin: 0 0 0.35rem 0;">
      ⚡ WIT & Native SIMD FFI Studio
    </h2>
    <p style="font-size: 0.85rem; color: #9494a8; margin: 0;">
      Universal WebAssembly Interface Types (WIT) AST parser, typed Cordis Service codegen, and C++20 SIMD FFI execution.
    </p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
    <!-- WIT Source Input -->
    <div style="background: #1c1c28; border: 1px solid #2c2c3e; border-radius: 12px; padding: 1.25rem;">
      <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #f9d65d;">
        WIT Interface Definition
      </h3>
      <textarea id="wit-source-input" style="
        width: 100%;
        height: 220px;
        background: #14141e;
        border: 1px solid #2c2c3e;
        border-radius: 8px;
        color: #e2e4ea;
        font-family: monospace;
        font-size: 0.8rem;
        padding: 0.75rem;
        box-sizing: border-box;
        resize: vertical;
      ">${state.witSource}</textarea>
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        <button onclick="window.lynxfitaCompileWit()" style="
          background: #f9d65d;
          color: #14141e;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        ">
          Compile WIT AST &rarr;
        </button>
      </div>
    </div>

    <!-- Compiled AST View -->
    <div style="background: #1c1c28; border: 1px solid #2c2c3e; border-radius: 12px; padding: 1.25rem;">
      <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #f9d65d;">
        Parsed Universal IR (AST)
      </h3>
      <pre style="
        width: 100%;
        height: 220px;
        background: #14141e;
        border: 1px solid #2c2c3e;
        border-radius: 8px;
        color: #48bb78;
        font-family: monospace;
        font-size: 0.75rem;
        padding: 0.75rem;
        box-sizing: border-box;
        overflow: auto;
        margin: 0;
      ">${state.compiledAstJson}</pre>
    </div>
  </div>

  <!-- Native SIMD FFI Execution Panel -->
  <div style="background: #1c1c28; border: 1px solid #2c2c3e; border-radius: 12px; padding: 1.25rem;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
      <h3 style="font-size: 1rem; font-weight: 700; margin: 0; color: #f9d65d;">
        C++20 Dynamic Shared Library SIMD Plugin (DMA Slot 0x2000)
      </h3>
      <span style="font-size: 0.75rem; color: #9494a8; font-family: monospace;">
        Target: lynxfita_weather_simd_plugin.dll / .so
      </span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
      <div style="background: #14141e; border: 1px solid #2c2c3e; border-radius: 8px; padding: 1rem;">
        <span style="font-size: 0.75rem; color: #9494a8; text-transform: uppercase;">Input Float32 Array (temps)</span>
        <div style="font-family: monospace; font-size: 0.85rem; color: #e2e4ea; margin-top: 0.5rem;">
          [${state.simdInput.join(', ')}]
        </div>
      </div>

      <div style="background: #14141e; border: 1px solid #2c2c3e; border-radius: 8px; padding: 1rem;">
        <span style="font-size: 0.75rem; color: #9494a8; text-transform: uppercase;">SIMD Advection Output (temps + wind)</span>
        <div style="font-family: monospace; font-size: 0.85rem; color: #48bb78; margin-top: 0.5rem;">
          ${state.simdOutput.length > 0 ? `[${state.simdOutput.map(v => v.toFixed(2)).join(', ')}]` : '<em>Click Run SIMD FFI below</em>'}
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 0.75rem; align-items: center;">
      <button onclick="window.lynxfitaRunSimdFfi()" style="
        background: #f9d65d;
        color: #14141e;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
      ">
        Execute SIMD FFI Compute &rarr;
      </button>
      <span style="font-size: 0.8rem; color: #9494a8;">
        Zero-copy vector execution across Stationary DMA segment.
      </span>
    </div>
  </div>
</div>
`;
    }
  };
}
