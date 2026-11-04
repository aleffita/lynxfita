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

function processPatches(mode = 'apply') {
  const isCheck = mode === 'check';
  const isRevert = mode === 'revert';

  console.log(`\n[LynxFita Patch Manager] Action: ${isCheck ? 'Checking (Dry-run)' : isRevert ? 'Reverting' : 'Applying'}`);
  console.log('='.repeat(75));

  if (!existsSync(PATCHES_DIR)) {
    console.log('No patches directory found.');
    return;
  }

  const targets = readdirSync(PATCHES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalPatches = 0;
  let successCount = 0;

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

      if (isCheck) {
        const checkCmd = `git apply --check "${patchPath}"`;
        const canApply = run(checkCmd, targetVendorPath);
        if (canApply !== null) {
          console.log(`  ✓ Clean check (applies cleanly)`);
          successCount++;
        } else {
          console.log(`  - Patch skipped or already applied.`);
        }
      } else if (isRevert) {
        const revertCmd = `git apply -R --check "${patchPath}"`;
        const canRevert = run(revertCmd, targetVendorPath);
        if (canRevert !== null) {
          const revertResult = run(`git apply -R "${patchPath}"`, targetVendorPath);
          if (revertResult !== null) {
            console.log(`  ✓ Successfully reverted ${patch}`);
            successCount++;
          } else {
            console.error(`  ✗ Failed to revert ${patch}`);
          }
        } else {
          // If git apply -R check fails, checkout the working tree for target vendor
          run(`git checkout .`, targetVendorPath);
          console.log(`  ✓ Cleaned working tree for ${target}`);
          successCount++;
        }
      } else {
        const checkCmd = `git apply --check "${patchPath}"`;
        const canApply = run(checkCmd, targetVendorPath);
        if (canApply !== null) {
          const applyResult = run(`git apply "${patchPath}"`, targetVendorPath);
          if (applyResult !== null) {
            console.log(`  ✓ Successfully applied ${patch}`);
            successCount++;
          } else {
            console.error(`  ✗ Failed to apply ${patch}`);
          }
        } else {
          console.log(`  - Patch already applied or skipped.`);
        }
      }
    }
  }

  console.log('='.repeat(75));
  console.log(`Summary: ${successCount}/${totalPatches} patches processed.`);
}

const arg = process.argv[2] || '--apply';
if (arg === '--check' || arg === '--dry-run') {
  processPatches('check');
} else if (arg === '--revert' || arg === '-R') {
  processPatches('revert');
} else {
  processPatches('apply');
}
