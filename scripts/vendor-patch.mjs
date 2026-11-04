#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const PATCHES_DIR = join(ROOT_DIR, 'patches');

function run(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function processPatches(dryRun = false) {
  console.log(`\n[LynxFita Patch Manager] Action: ${dryRun ? 'Checking (Dry-run)' : 'Applying'}`);
  console.log('='.repeat(75));

  if (!existsSync(PATCHES_DIR)) {
    console.log('No patches directory found.');
    return;
  }

  const targets = readdirSync(PATCHES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalPatches = 0;
  let appliedCount = 0;

  for (const target of targets) {
    const targetVendorPath = join(ROOT_DIR, 'vendor', target);
    if (!existsSync(targetVendorPath)) {
      console.warn(`Vendor directory not found for target: vendor/${target}`);
      continue;
    }

    const patchFiles = readdirSync(join(PATCHES_DIR, target))
      .filter(f => f.endsWith('.patch'))
      .sort();

    for (const patch of patchFiles) {
      totalPatches++;
      const patchPath = join(PATCHES_DIR, target, patch);
      console.log(`Processing [${target}]: ${patch}`);

      const checkCmd = `git apply --check "${patchPath}"`;
      const canApply = run(checkCmd, targetVendorPath);

      if (canApply !== null) {
        if (!dryRun) {
          const applyResult = run(`git apply "${patchPath}"`, targetVendorPath);
          if (applyResult !== null) {
            console.log(`  ✓ Successfully applied ${patch}`);
            appliedCount++;
          } else {
            console.error(`  ✗ Failed to apply ${patch}`);
          }
        } else {
          console.log(`  ✓ Clean check (applies cleanly)`);
          appliedCount++;
        }
      } else {
        console.log(`  - Patch skipped or already applied.`);
      }
    }
  }

  console.log('='.repeat(75));
  console.log(`Summary: ${appliedCount}/${totalPatches} patches validated/applied.`);
}

const arg = process.argv[2] || '--apply';
if (arg === '--check' || arg === '--dry-run') {
  processPatches(true);
} else {
  processPatches(false);
}
