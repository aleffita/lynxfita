import test from 'node:test';
import assert from 'node:assert/strict';
import { BundlePackager, FederationManifestGenerator } from '../dist/index.js';

test('BundlePackager - compiles Hermes AOT bytecode and generates manifest', () => {
  const code = 'export const greeting = "hello from lynxfita";';
  const { bytecode, manifest } = BundlePackager.packageHermesBundle('greeting-module', '1.0.0', code, ['greeting']);

  assert.equal(bytecode[0], 0x1f);
  assert.equal(bytecode[1], 0x48); // 'H'
  assert.equal(bytecode[2], 0x42); // 'B'
  assert.equal(bytecode[3], 0x43); // 'C'
  assert.equal(manifest.bundleName, 'greeting-module');
  assert.equal(manifest.version, '1.0.0');
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.deterministicSignature, /^SIG_DETERMINISTIC_/);
});

test('FederationManifestGenerator - synthesizes REPACK module federation config', () => {
  const { manifest } = BundlePackager.packageHermesBundle('mini-app', '1.0.0', 'export default 1;');
  const fed = FederationManifestGenerator.generateFederationConfig(
    'super-app',
    { 'sensor-app': 'https://releases.lynxfita.dev/sensor-app/manifest.json' },
    [manifest]
  );

  assert.equal(fed.name, 'super-app');
  assert.equal(fed.bundles.length, 1);
  assert.equal(fed.shared['@lynxfita/core'].singleton, true);
});
