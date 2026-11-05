/**
 * LynxFita CLI: Tooling, Doctor & Scaffolding Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runDoctor,
  initProject,
  buildProject,
  printHelp
} from '../dist/index.js';

test('runDoctor inspects platform, stationary DMA, and WASI sandbox', () => {
  const doc = runDoctor();
  assert.equal(typeof doc.ok, 'boolean');
  assert.equal(doc.checks.nodeVersionGte20, true);
  assert.equal(doc.checks.stationaryDmaIntegrity, true);
  assert.equal(doc.checks.wasiSandboxIntegrity, true);
  assert.equal(typeof doc.details.dmaArena, 'string');
});

test('initProject scaffolds mini-app template files', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-cli-${Date.now()}`);
  const result = initProject(tempDir, { template: 'mini-app' });

  assert.equal(result.success, true);
  assert.equal(result.template, 'mini-app');
  assert.equal(result.files.length, 2);
});

test('buildProject compiles source code into Hermes AOT bytecode and manifest', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-build-${Date.now()}`);
  const result = buildProject(tempDir);

  assert.equal(result.success, true);
  assert.equal(result.bundleCount, 1);
  assert.ok(result.manifestFile);
  assert.ok(result.hbcFile);
});
