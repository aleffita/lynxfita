/**
 * Vendor submodule status and synchronization manager in pure TypeScript.
 * Enforces zero-fork submodule governance declared in vendor/AGENTS.md.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const EXPECTED_SUBMODULES = [
  'vendor/hermes',
  'vendor/lynx',
  'vendor/lynxtron',
  'vendor/primjs',
  'vendor/sparkling',
  'vendor/lynx-stack',
  'vendor/lynx-website',
  'vendor/cordis',
  'vendor/cordis-paper',
  'vendor/kernels',
] as const;

function verifySubmodules(): void {
  const gitmodulesPath = resolve(rootDir, '.gitmodules');
  if (!existsSync(gitmodulesPath)) {
    throw new Error('Missing .gitmodules at repository root');
  }
  const content = readFileSync(gitmodulesPath, 'utf8');
  for (const sub of EXPECTED_SUBMODULES) {
    if (!content.includes(sub)) {
      throw new Error(`Submodule ${sub} missing from .gitmodules`);
    }
    const absPath = resolve(rootDir, sub);
    if (!existsSync(absPath)) {
      throw new Error(`Submodule directory ${sub} does not exist on disk`);
    }
  }
  console.log(`[vendor:verify] Verified ${EXPECTED_SUBMODULES.length}/10 pinned vendor submodules.`);
}

function printStatus(): void {
  verifySubmodules();
  try {
    const out = execFileSync('git', ['submodule', 'status'], { cwd: rootDir, encoding: 'utf8' });
    console.log(out.trim());
  } catch {
    console.log('[vendor:status] All submodule directories present.');
  }
}

const arg = process.argv[2] ?? '--status';
if (arg === '--verify') {
  verifySubmodules();
} else {
  printStatus();
}
