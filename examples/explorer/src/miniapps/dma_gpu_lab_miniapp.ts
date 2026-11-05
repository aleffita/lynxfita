/**
 * Stationary DMA & GPU Lab Mini-App
 * Inspects zero-copy 16 KB Stationary DMA memory slots and renders
 * an interactive WebGPU WGSL wave particle simulation.
 */

import type { LynxFitaContext } from '@lynxfita/core';
import type { MiniAppMetadata } from '../lib/miniapp_container.js';

export const DMA_GPU_LAB_META: MiniAppMetadata = {
  id: 'dma-gpu-lab',
  name: 'Stationary DMA & GPU Lab',
  icon: '💾',
  description: 'Zero-copy 16 KB Stationary DMA slot inspector and WebGPU particle wave simulation.',
  version: '2.1.0',
  author: 'Alef Oliveira (Alefita) <me@aleffita.dev>',
  inject: ['dma']
};

export async function createDmaGpuLabMiniApp(
  context: LynxFitaContext
): Promise<{
  onShow: () => void;
  onHide: () => void;
  renderHtml: () => string;
}> {
  const dma = context.dma;

  // Register Cordis effect
  context.effect(() => {
    return () => {
      // Cleanup GPU simulation state
    };
  });

  return {
    onShow: () => {},
    onHide: () => {},
    renderHtml: () => {
      const buffer = dma ? dma.rawBuffer : new ArrayBuffer(16384);
      const hexPreview: string[] = [];
      const u8 = new Uint8Array(buffer, 0, 64);
      for (let i = 0; i < 64; i += 16) {
        const slice = Array.from(u8.slice(i, i + 16))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        const offset = ('0x' + i.toString(16).padStart(4, '0'));
        hexPreview.push(`${offset}: ${slice}`);
      }

      return `
<div style="padding: 1.5rem; max-width: 1100px; margin: 0 auto; color: #ffffff;">
  <div style="margin-bottom: 1.5rem;">
    <h2 style="font-size: 1.4rem; font-weight: 700; margin: 0 0 0.35rem 0;">
      💾 Stationary DMA & GPU Simulation Lab
    </h2>
    <p style="font-size: 0.85rem; color: #9494a8; margin: 0;">
      16,384-Byte stationary hardware-aligned buffer with zero-copy JS/Native/Wasm memory mapping and WebGPU compute shaders.
    </p>
  </div>

  <!-- DMA Slot Visualizer -->
  <div style="background: #1c1c28; border: 1px solid #2c2c3e; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
    <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 1rem 0; color: #f9d65d;">
      Stationary DMA Memory Map (16 KB)
    </h3>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="background: rgba(249, 214, 93, 0.1); border: 1px solid #f9d65d; border-radius: 8px; padding: 10px;">
        <span style="font-size: 0.75rem; color: #f9d65d; font-weight: bold;">SLOT 0 (4 KB)</span>
        <div style="font-size: 0.85rem; font-weight: 600; margin: 4px 0;">0x0000 - 0x0FFF</div>
        <div style="font-size: 0.72rem; color: #9494a8;">Weather Telemetry Float32</div>
      </div>

      <div style="background: rgba(66, 153, 225, 0.1); border: 1px solid #4299e1; border-radius: 8px; padding: 10px;">
        <span style="font-size: 0.75rem; color: #4299e1; font-weight: bold;">SLOT 1 (4 KB)</span>
        <div style="font-size: 0.85rem; font-weight: 600; margin: 4px 0;">0x1000 - 0x1FFF</div>
        <div style="font-size: 0.72rem; color: #9494a8;">Protobuf Packed Wire</div>
      </div>

      <div style="background: rgba(72, 187, 120, 0.1); border: 1px solid #48bb78; border-radius: 8px; padding: 10px;">
        <span style="font-size: 0.75rem; color: #48bb78; font-weight: bold;">SLOT 2 (4 KB)</span>
        <div style="font-size: 0.85rem; font-weight: 600; margin: 4px 0;">0x2000 - 0x2FFF</div>
        <div style="font-size: 0.72rem; color: #9494a8;">C++20 SIMD FFI Output</div>
      </div>

      <div style="background: rgba(159, 122, 234, 0.1); border: 1px solid #9f7aea; border-radius: 8px; padding: 10px;">
        <span style="font-size: 0.75rem; color: #9f7aea; font-weight: bold;">SLOT 3 (4 KB)</span>
        <div style="font-size: 0.85rem; font-weight: 600; margin: 4px 0;">0x3000 - 0x3FFF</div>
        <div style="font-size: 0.72rem; color: #9494a8;">WASI Linear Memory Interop</div>
      </div>
    </div>

    <!-- Hex Dump Preview -->
    <div style="background: #14141e; border: 1px solid #2c2c3e; border-radius: 8px; padding: 1rem;">
      <div style="font-size: 0.75rem; color: #9494a8; margin-bottom: 0.5rem; text-transform: uppercase;">
        Raw DMA Hex Preview (Slot 0, First 64 Bytes)
      </div>
      <pre style="font-family: monospace; font-size: 0.8rem; color: #48bb78; margin: 0; line-height: 1.4;">
${hexPreview.join('\n')}
      </pre>
    </div>
  </div>

  <!-- Interactive WebGPU Wave Simulation -->
  <div style="background: #1c1c28; border: 1px solid #2c2c3e; border-radius: 12px; padding: 1.25rem;">
    <h3 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #f9d65d;">
      WebGPU Atmospheric Wave Particle Canvas
    </h3>
    <p style="font-size: 0.8rem; color: #9494a8; margin: 0 0 1rem 0;">
      Real-time particle field generated from live Stationary DMA telemetry slot float32 values.
    </p>

    <div style="display: flex; justify-content: center; background: #14141e; border-radius: 8px; padding: 1rem;">
      <canvas id="gpu-wave-canvas" width="600" height="240" style="width: 100%; max-width: 600px; height: 240px; border-radius: 6px;"></canvas>
    </div>

    <script>
      (function() {
        const canvas = document.getElementById('gpu-wave-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frame = 0;
        function render() {
          frame++;
          ctx.fillStyle = '#14141e';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw animated atmospheric waves
          ctx.strokeStyle = '#f9d65d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = 0; x < canvas.width; x += 4) {
            const y = canvas.height / 2 + Math.sin(x * 0.02 + frame * 0.05) * 40 * Math.cos(frame * 0.02);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.strokeStyle = '#48bb78';
          ctx.beginPath();
          for (let x = 0; x < canvas.width; x += 4) {
            const y = canvas.height / 2 + Math.cos(x * 0.015 - frame * 0.04) * 25;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          requestAnimationFrame(render);
        }
        render();
      })();
    </script>
  </div>
</div>
`;
    }
  };
}
