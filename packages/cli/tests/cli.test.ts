/**
 * LynxFita CLI: Tooling, Doctor & Scaffolding Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  runDoctor,
  initProject,
  buildProject,
  packProject,
  runDev,
  runCli,
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

test('initProject scaffolds standalone desktop project files', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-proj-${Date.now()}`);
  const result = initProject(tempDir, { type: 'project' });

  assert.equal(result.success, true);
  assert.equal(result.template, 'project');
  assert.ok(existsSync(join(tempDir, 'package.json')));
  assert.ok(existsSync(join(tempDir, 'lynxfita.config.json')));
  assert.ok(existsSync(join(tempDir, 'src', 'main.ts')));
  assert.ok(existsSync(join(tempDir, 'src', 'app', 'index.ts')));

  const cfg = JSON.parse(readFileSync(join(tempDir, 'lynxfita.config.json'), 'utf8'));
  assert.equal(cfg.entry, 'src/main.ts');
});

test('initProject scaffolds standalone reusable Cordis plugin files', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-plugin-${Date.now()}`);
  const result = initProject(tempDir, { type: 'plugin' });

  assert.equal(result.success, true);
  assert.equal(result.template, 'plugin');
  assert.ok(existsSync(join(tempDir, 'package.json')));
  assert.ok(existsSync(join(tempDir, 'src', 'index.ts')));
  assert.ok(existsSync(join(tempDir, 'tests', 'plugin.test.ts')));

  const src = readFileSync(join(tempDir, 'src', 'index.ts'), 'utf8');
  assert.ok(src.includes('PluginDefinition'));
  assert.ok(src.includes('hardware.dma'));
});

test('buildProject compiles source code into Hermes AOT bytecode and manifest', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-build-${Date.now()}`);
  const result = buildProject(tempDir);

  assert.equal(result.success, true);
  assert.equal(result.bundleCount, 1);
  assert.ok(result.manifestFile);
  assert.ok(result.hbcFile);
});

test('packProject packages self-contained desktop target with Ed25519 signature', () => {
  const tempDir = join(tmpdir(), `lynxfita-test-pack-${Date.now()}`);
  const result = packProject(tempDir);

  assert.equal(result.success, true);
  assert.ok(existsSync(result.packageDir));
  assert.ok(existsSync(result.bundleFile));
  assert.ok(existsSync(result.manifestFile));
  assert.ok(existsSync(result.releaseManifestFile));
  assert.ok(existsSync(result.signatureFile));
  assert.ok(result.output.includes('Packaged self-contained desktop target'));
});

test('runCli dispatches init project, init plugin, pack, and dev commands', async () => {
  const tempProj = join(tmpdir(), `lynxfita-cli-p-${Date.now()}`);
  const codeProj = await runCli(['node', 'lynxfita', 'init', 'project', tempProj]);
  assert.equal(codeProj, 0);
  assert.ok(existsSync(join(tempProj, 'lynxfita.config.json')));

  const tempPlug = join(tmpdir(), `lynxfita-cli-pl-${Date.now()}`);
  const codePlug = await runCli(['node', 'lynxfita', 'init', 'plugin', tempPlug]);
  assert.equal(codePlug, 0);
  assert.ok(existsSync(join(tempPlug, 'tests', 'plugin.test.ts')));

  const codePack = await runCli(['node', 'lynxfita', 'pack', tempProj]);
  assert.equal(codePack, 0);

  const codeDev = await runCli(['node', 'lynxfita', 'dev', tempProj]);
  assert.equal(codeDev, 0);
});
