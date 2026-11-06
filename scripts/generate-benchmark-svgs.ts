/**
 * Generates high-fidelity, standalone, dark-themed SVG benchmark charts
 * for LynxFita README and documentation.
 *
 * Produces:
 *  - docs/assets/benchmark-throughput.svg
 *  - docs/assets/benchmark-latency.svg
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../docs/assets');
mkdirSync(assetsDir, { recursive: true });

// Palette: Catppuccin Mocha inspired for high legibility on GitHub dark & light themes
const C = {
  bg: '#181825',
  cardBg: '#1e1e2e',
  border: '#313244',
  text: '#cdd6f4',
  textSub: '#a6adc8',
  textDim: '#6c7086',
  grid: '#313244',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  green: '#a6e3a1',
  peach: '#fab387',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  lavender: '#b4befe',
  flamingo: '#f2cdcd',
  maroon: '#eba0ac',
};

// 1. Throughput Scaling SVG
function generateThroughputSvg(): string {
  const data = [
    { label: '64 B', value: 88.46, display: '88.5 MB/s', note: 'Base lane', color1: '#89dceb', color2: '#74c7ec', speedup: '1×' },
    { label: '4 KB', value: 6135.47, display: '6,135 MB/s', note: 'Page size', color1: '#a6e3a1', color2: '#94e2d5', speedup: '69×' },
    { label: '64 KB', value: 38981.29, display: '38,981 MB/s', note: 'L1/L2 cache', color1: '#fab387', color2: '#f9e2af', speedup: '441×' },
    { label: '1 MB', value: 42498.94, display: '42,499 MB/s', note: 'Max throughput', color1: '#cba6f7', color2: '#b4befe', speedup: '480×' },
  ];

  const maxVal = 45000;
  const barStartX = 85;
  const maxBarWidth = 280;
  const startY = 85;
  const rowHeight = 52;

  let barsSvg = '';
  data.forEach((d, i) => {
    const y = startY + i * rowHeight;
    const barWidth = Math.max(12, Math.round((d.value / maxVal) * maxBarWidth));

    barsSvg += `
      <!-- Row ${i + 1}: ${d.label} -->
      <text x="${barStartX - 10}" y="${y + 22}" fill="${C.text}" font-size="12" font-weight="600" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${d.label}</text>
      <rect x="${barStartX}" y="${y}" width="${maxBarWidth}" height="32" rx="6" fill="#11111b" />
      <rect x="${barStartX}" y="${y}" width="${barWidth}" height="32" rx="6" fill="url(#grad-tp-${i})" />
      <text x="${barStartX + barWidth + 10}" y="${y + 21}" fill="${C.text}" font-size="12" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${d.display}</text>
      <text x="475" y="${y + 21}" fill="${C.textDim}" font-size="11" font-weight="500" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${d.speedup}</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 310" width="100%" height="100%">
  <defs>
    <linearGradient id="grad-tp-0" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#89dceb" />
      <stop offset="100%" stop-color="#74c7ec" />
    </linearGradient>
    <linearGradient id="grad-tp-1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a6e3a1" />
      <stop offset="100%" stop-color="#94e2d5" />
    </linearGradient>
    <linearGradient id="grad-tp-2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fab387" />
      <stop offset="100%" stop-color="#f9e2af" />
    </linearGradient>
    <linearGradient id="grad-tp-3" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#cba6f7" />
      <stop offset="100%" stop-color="#b4befe" />
    </linearGradient>
  </defs>

  <!-- Container Box -->
  <rect width="500" height="310" rx="10" fill="${C.bg}" stroke="${C.border}" stroke-width="1" />

  <!-- Header -->
  <text x="24" y="34" fill="${C.text}" font-size="15" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Memory Transfer Throughput Scaling</text>
  <text x="24" y="52" fill="${C.textSub}" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Bandwidth scaling across payload sizes (MB/s &bull; Higher is better)</text>
  
  <!-- Pill badge -->
  <rect x="382" y="20" width="94" height="20" rx="10" fill="#313244" />
  <text x="429" y="34" fill="${C.sky}" font-size="10" font-weight="600" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">N = 30 Samples</text>

  <!-- Grid line -->
  <line x1="24" y1="68" x2="476" y2="68" stroke="${C.border}" stroke-width="1" />

  ${barsSvg}

  <!-- Footer Info -->
  <line x1="24" y1="284" x2="476" y2="284" stroke="${C.border}" stroke-width="1" />
  <text x="24" y="299" fill="${C.textDim}" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">In-memory stationary buffer transfer (Node.js v26 / AMD Ryzen 5 4500)</text>
  <text x="476" y="299" fill="${C.textDim}" font-size="10" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Speedup vs 64B</text>
</svg>`;
}

// 2. Subsystem Latency SVG (p50)
function generateLatencySvg(): string {
  const items = [
    { name: 'SIMD Float32 (16B)', p50: 0.36, display: '0.36 μs', family: 'SIMD', color: '#a6e3a1' },
    { name: 'WASI Bounds (64B)', p50: 0.50, display: '0.50 μs', family: 'WASI', color: '#89dceb' },
    { name: 'Memory Buf (64B)', p50: 0.60, display: '0.60 μs', family: 'Memory', color: '#74c7ec' },
    { name: 'Memory Buf (64KB)', p50: 1.60, display: '1.60 μs', family: 'Memory', color: '#b4befe' },
    { name: 'Protobuf Wire (64B)', p50: 7.70, display: '7.70 μs', family: 'Proto', color: '#fab387' },
    { name: 'Protobuf Wire (4KB)', p50: 9.60, display: '9.60 μs', family: 'Proto', color: '#f9e2af' },
    { name: 'WASI Interop (64KB)', p50: 21.40, display: '21.40 μs', family: 'WASI', color: '#eba0ac' },
    { name: 'Memory Buf (1MB)', p50: 23.10, display: '23.10 μs', family: 'Memory', color: '#cba6f7' },
  ];

  // For visual balance with values ranging 0.36 to 23.10 us, use a piecewise/square-root scale
  // so microsecond operations remain distinctly visible and distinguishable
  const barStartX = 155;
  const maxBarWidth = 220;
  const startY = 82;
  const rowHeight = 24;

  let rowsSvg = '';
  items.forEach((item, i) => {
    const y = startY + i * rowHeight;
    // sqrt scaling: sqrt(0.36) = 0.6; sqrt(23.1) = 4.8; barWidth = (sqrt(p50)/sqrt(25)) * maxBarWidth
    const scale = Math.sqrt(item.p50) / Math.sqrt(25.0);
    const barWidth = Math.max(14, Math.round(scale * maxBarWidth));

    rowsSvg += `
      <!-- Row ${i + 1}: ${item.name} -->
      <text x="${barStartX - 8}" y="${y + 14}" fill="${C.text}" font-size="11" font-weight="500" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${item.name}</text>
      <rect x="${barStartX}" y="${y + 2}" width="${maxBarWidth}" height="16" rx="4" fill="#11111b" />
      <rect x="${barStartX}" y="${y + 2}" width="${barWidth}" height="16" rx="4" fill="${item.color}" />
      <text x="${barStartX + barWidth + 8}" y="${y + 14}" fill="${C.text}" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${item.display}</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 310" width="100%" height="100%">
  <!-- Container Box -->
  <rect width="500" height="310" rx="10" fill="${C.bg}" stroke="${C.border}" stroke-width="1" />

  <!-- Header -->
  <text x="24" y="34" fill="${C.text}" font-size="15" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Subsystem Execution Latency (p50)</text>
  <text x="24" y="52" fill="${C.textSub}" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Median execution time (microseconds &bull; Lower is faster)</text>

  <!-- Legend Tags -->
  <g transform="translate(295, 20)">
    <circle cx="8" cy="10" r="4" fill="#a6e3a1" />
    <text x="16" y="14" fill="${C.textSub}" font-size="9" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">SIMD</text>
    <circle cx="50" cy="10" r="4" fill="#74c7ec" />
    <text x="58" y="14" fill="${C.textSub}" font-size="9" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Mem</text>
    <circle cx="88" cy="10" r="4" fill="#89dceb" />
    <text x="96" y="14" fill="${C.textSub}" font-size="9" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">WASI</text>
    <circle cx="132" cy="10" r="4" fill="#fab387" />
    <text x="140" y="14" fill="${C.textSub}" font-size="9" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Proto</text>
  </g>

  <!-- Grid line -->
  <line x1="24" y1="68" x2="476" y2="68" stroke="${C.border}" stroke-width="1" />

  ${rowsSvg}

  <!-- Footer Info -->
  <line x1="24" y1="284" x2="476" y2="284" stroke="${C.border}" stroke-width="1" />
  <text x="24" y="299" fill="${C.textDim}" font-size="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">Kalibera &amp; Jones standard (N=30, sqrt-scaled display)</text>
  <text x="476" y="299" fill="${C.textDim}" font-size="10" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">p50 Latency (μs)</text>
</svg>`;
}

const tpSvg = generateThroughputSvg();
const latSvg = generateLatencySvg();

writeFileSync(resolve(assetsDir, 'benchmark-throughput.svg'), tpSvg, 'utf8');
writeFileSync(resolve(assetsDir, 'benchmark-latency.svg'), latSvg, 'utf8');

console.log('Successfully generated docs/assets/benchmark-throughput.svg');
console.log('Successfully generated docs/assets/benchmark-latency.svg');
