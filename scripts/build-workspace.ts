/**
 * Topological Monorepo Builder for LynxFita
 * Builds all workspace packages in strict dependency order, avoiding parallel race conditions
 * on fresh checkouts across Windows, Linux, and macOS.
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupWorkspaceProxies } from './setup-workspace.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 1. Materialize workspace proxies
setupWorkspaceProxies();

// 2. Define topological build waves
const WAVES: readonly (readonly string[])[] = [
  // Wave 1: Independent foundation packages
  ['packages/core', 'packages/codegen'],
  // Wave 2: Downstream runtime and showcase packages
  ['packages/wasi-runtime', 'packages/builder', 'packages/updater', 'examples/weather-showcase'],
  // Wave 3: Top-level consumers and CLI
  ['packages/cli', 'examples/explorer'],
];

console.log('[build-workspace] Starting topological build across workspace packages...');

for (let waveIndex = 0; waveIndex < WAVES.length; waveIndex++) {
  const wave = WAVES[waveIndex];
  for (const relPath of wave) {
    const pkgDir = resolve(rootDir, relPath);
    console.log(`[build-workspace] [Wave ${waveIndex + 1}/${WAVES.length}] Building ${relPath}...`);
    execSync('pnpm run build', {
      cwd: pkgDir,
      stdio: 'inherit',
    });
  }
}

console.log('[build-workspace] All workspace packages built successfully in topological order.');
