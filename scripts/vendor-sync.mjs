#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const VENDOR_DIR = join(ROOT_DIR, 'vendor');
const PATCHES_DIR = join(ROOT_DIR, 'patches');

const EXPECTED_SUBMODULES = [
  { name: 'lynxtron', path: 'vendor/lynxtron', branch: 'main' },
  { name: 'primjs', path: 'vendor/primjs', branch: 'main' },
  { name: 'sparkling', path: 'vendor/sparkling', branch: 'main' },
  { name: 'lynx-website', path: 'vendor/lynx-website', branch: 'main' },
  { name: 'lynx-stack', path: 'vendor/lynx-stack', branch: 'main' },
  { name: 'hermes', path: 'vendor/hermes', branch: 'static_h' },
  { name: 'lynx', path: 'vendor/lynx', branch: 'main' },
  { name: 'cordis', path: 'vendor/cordis', branch: 'main' },
  { name: 'cordis-paper', path: 'vendor/cordis-paper', branch: 'main' },
  { name: 'kernels', path: 'vendor/kernels', branch: 'main' }
];

function run(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function getSubmoduleStatus() {
  console.log('\n[LynxFita Vendor Submodule Inventory]');
  console.log('='.repeat(75));

  const results = [];
  for (const sub of EXPECTED_SUBMODULES) {
    const subPath = join(ROOT_DIR, sub.path);
    const exists = existsSync(subPath);
    let commit = 'N/A';
    let branch = sub.branch;
    let isClean = false;

    if (exists) {
      commit = run('git rev-parse --short HEAD', subPath) || 'N/A';
      const statusOutput = run('git status --porcelain', subPath);
      isClean = statusOutput === '';
    }

    const patchDir = join(PATCHES_DIR, sub.name);
    const patchCount = existsSync(patchDir)
      ? readdirSync(patchDir).filter(f => f.endsWith('.patch')).length
      : 0;

    results.push({
      submodule: sub.name,
      path: sub.path,
      targetBranch: sub.branch,
      commit,
      clean: isClean,
      patches: patchCount,
      initialized: exists && commit !== 'N/A'
    });

    console.log(`- ${sub.name.padEnd(14)} | Branch: ${sub.branch.padEnd(9)} | Commit: ${commit.padEnd(8)} | Patches: ${patchCount} | Clean: ${isClean}`);
  }

  console.log('='.repeat(75));
  return results;
}

function verifySubmodules() {
  console.log('\n[LynxFita Submodule Verification]');
  const statuses = getSubmoduleStatus();
  const uninitialized = statuses.filter(s => !s.initialized);

  if (uninitialized.length > 0) {
    console.error(`\nERROR: ${uninitialized.length} submodules are not initialized!`);
    uninitialized.forEach(u => console.error(`  - ${u.submodule} at ${u.path}`));
    process.exit(1);
  }

  console.log('\nAll expected vendor submodules are registered and initialized.');
}

function syncSubmodules() {
  console.log('\n[Synchronizing Vendor Submodules]');
  execSync('git submodule update --init --recursive', { stdio: 'inherit', cwd: ROOT_DIR });
  console.log('Vendor submodules successfully synchronized.');
}

const arg = process.argv[2] || '--status';
if (arg === '--verify') {
  verifySubmodules();
} else if (arg === '--sync') {
  syncSubmodules();
} else {
  getSubmoduleStatus();
}
