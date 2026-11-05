/**
 * Atomic zero-fork patch manager for vendor submodules in pure TypeScript.
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const patchesDir = resolve(rootDir, 'patches');

function listPatches(): readonly string[] {
  if (!existsSync(patchesDir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(patchesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subDir = resolve(patchesDir, entry.name);
      for (const file of readdirSync(subDir)) {
        if (file.endsWith('.patch')) {
          results.push(`${entry.name}/${file}`);
        }
      }
    }
  }
  return results;
}

const mode = process.argv[2] ?? '--list';
const patches = listPatches();
console.log(`[vendor:patch] Mode=${mode} | Registered patches (${patches.length}): ${patches.join(', ')}`);
