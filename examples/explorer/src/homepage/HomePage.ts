/**
 * Super-App Home Page Component
 * Grid launcher for WeChat-style Mini-Apps, DMA telemetry and system vitals.
 */

import type { ThemeManager } from '../lib/theme_context.js';
import type { SessionHistoryManager } from '../lib/session_history.js';
import type { LynxFitaContext } from '@lynxfita/core';

export interface MiniAppGridCard {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  route: string;
  tag: string;
}

export const REGISTERED_MINIAPPS: readonly MiniAppGridCard[] = [
  {
    id: 'developer-cockpit',
    name: 'Developer & Agent Cockpit',
    category: 'Multi-Repo / GenUI',
    icon: '🛠️',
    description: 'Multi-repo orchestrator, remote OTA federation reconciler, GenUI A2UI canvas & Hermes compiler studio.',
    route: 'lynxfita://miniapp/developer-cockpit',
    tag: 'DX Spine'
  },
  {
    id: 'weather-showcase',
    name: 'Weather Showcase',
    category: 'MVI Reactive UI',
    icon: '🌤️',
    description: 'Multi-screen MVI weather radar with WebGPU WGSL atmospheric shader and hourly forecast.',
    route: 'lynxfita://miniapp/weather-showcase',
    tag: 'Production'
  },
  {
    id: 'wit-ffi-studio',
    name: 'WIT & Native SIMD Studio',
    category: 'Wasm / SIMD FFI',
    icon: '⚡',
    description: 'Universal WIT module compiler and real C++20 dynamic FFI library SIMD vector engine.',
    route: 'lynxfita://miniapp/wit-ffi-studio',
    tag: 'C++20 SIMD'
  },
  {
    id: 'dma-gpu-lab',
    name: 'Stationary DMA & GPU Lab',
    category: 'Hardware DMA',
    icon: '💾',
    description: 'Zero-copy 16 KB Stationary DMA slot inspector and WebGPU particle wave simulation.',
    route: 'lynxfita://miniapp/dma-gpu-lab',
    tag: 'Zero-Copy'
  }
];

export function renderHomePage(
  _context: LynxFitaContext,
  themeManager: ThemeManager,
  historyManager: SessionHistoryManager
): string {
  const theme = themeManager.getColors();
  const recentEvents = historyManager.getEvents().slice(-5).reverse();

  return `
<main style="padding: 1.5rem; max-width: 1200px; margin: 0 auto; color: ${theme.text};">
  <!-- System Status Banner -->
  <section style="
    background: ${theme.surface};
    border: 1px solid ${theme.border};
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  ">
    <div>
      <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 0.35rem 0; color: ${theme.text};">
        LynxFita Mini-App Host & Explorer
      </h2>
      <p style="font-size: 0.85rem; color: ${theme.textMuted}; margin: 0;">
        Endogenous Cordis Plugin Spine &bull; Stationary DMA &bull; C++20 SIMD FFI &bull; Ed25519 OTA Federation
      </p>
    </div>
    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
      <span style="
        background: rgba(249, 214, 93, 0.15);
        color: ${theme.accent};
        border: 1px solid ${theme.accent};
        border-radius: 9999px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
      ">Runtime: Static Hermes C++20</span>
      <span style="
        background: rgba(72, 187, 120, 0.15);
        color: #48bb78;
        border: 1px solid #48bb78;
        border-radius: 9999px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
      ">Desktop Shell: Ready</span>
      <span style="
        background: rgba(66, 153, 225, 0.15);
        color: #4299e1;
        border: 1px solid #4299e1;
        border-radius: 9999px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 600;
      ">Release: Ed25519 Verified</span>
    </div>
  </section>

  <!-- Mini-Apps Grid -->
  <section style="margin-bottom: 2.5rem;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Installed Mini-Apps</h3>
      <span style="font-size: 0.8rem; color: ${theme.textMuted};">${REGISTERED_MINIAPPS.length} Available</span>
    </div>

    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    ">
      ${REGISTERED_MINIAPPS.map(app => `
        <article style="
          background: ${theme.surface};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.15s ease, border-color 0.15s ease;
        ">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <span style="font-size: 2rem;">${app.icon}</span>
              <span style="
                background: ${theme.border};
                color: ${theme.accent};
                font-size: 0.7rem;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 6px;
                text-transform: uppercase;
              ">${app.tag}</span>
            </div>
            <h4 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0;">${app.name}</h4>
            <span style="font-size: 0.75rem; color: ${theme.accent}; font-weight: 600; display: block; margin-bottom: 0.5rem;">
              ${app.category}
            </span>
            <p style="font-size: 0.85rem; color: ${theme.textMuted}; line-height: 1.4; margin: 0 0 1rem 0;">
              ${app.description}
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button
              id="open-${app.id}"
              style="
                flex: 1;
                background: ${theme.accent};
                color: #14141e;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-weight: 700;
                font-size: 0.85rem;
                cursor: pointer;
              "
              onclick="window.lynxfitaNavigate('${app.route}', '${app.name}')"
            >
              Launch Mini-App &rarr;
            </button>
          </div>
        </article>
      `).join('')}
    </div>
  </section>

  <!-- Live DMA & System Telemetry -->
  <section style="
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 1.5rem;
  ">
    <!-- DMA Memory Slot Summary -->
    <div style="
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 1.25rem;
    ">
      <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem 0; color: ${theme.accent};">
        Stationary DMA Segments (16 KB)
      </h4>
      <div style="font-family: monospace; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.4rem;">
        <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          <span>0x0000 - 0x0FFF</span>
          <span style="color: ${theme.textMuted};">Weather Telemetry Float32 Slot</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          <span>0x1000 - 0x1FFF</span>
          <span style="color: ${theme.textMuted};">Protobuf Packed Serialization Slot</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          <span>0x2000 - 0x2FFF</span>
          <span style="color: ${theme.textMuted};">C++20 SIMD FFI Compute Output Slot</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
          <span>0x3000 - 0x3FFF</span>
          <span style="color: ${theme.textMuted};">WASI Linear Memory Host Interop Slot</span>
        </div>
      </div>
    </div>

    <!-- Telemetry Log -->
    <div style="
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 1.25rem;
    ">
      <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem 0; color: ${theme.accent};">
        Session Telemetry Logs
      </h4>
      <div style="font-family: monospace; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; max-height: 120px; overflow-y: auto;">
        ${recentEvents.length > 0 ? recentEvents.map(e => `
          <div style="display: flex; gap: 0.5rem; color: ${theme.textMuted};">
            <span style="color: ${theme.accent};">[${new Date(e.timestamp).toISOString().substring(11, 19)}]</span>
            <span style="text-transform: uppercase; font-weight: bold;">${e.category}:</span>
            <span style="color: ${theme.text};">${e.message}</span>
          </div>
        `).join('') : `
          <span style="color: ${theme.textMuted}; font-style: italic;">No session events recorded yet.</span>
        `}
      </div>
    </div>
  </section>
</main>
`;
}
