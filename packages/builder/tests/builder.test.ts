/**
 * LynxFita Builder: Bundle Packager & Federation Manifest Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BundlePackager,
  FederationManifestGenerator
} from '../dist/index.js';

test('BundlePackager produces deterministic HBC bytecode with valid SHA256', () => {
  const source = 'function render() { return 42; }';
  const { bytecode, manifest } = BundlePackager.packageHermesBundle(
    'weather-widget',
    '2.1.0',
    source,
    ['render']
  );

  assert.equal(bytecode[0], 0x1f);
  assert.equal(bytecode[1], 0x48); // 'H'
  assert.equal(bytecode[2], 0x42); // 'B'
  assert.equal(bytecode[3], 0x43); // 'C'

  assert.equal(manifest.bundleName, 'weather-widget');
  assert.equal(manifest.version, '2.1.0');
  assert.equal(manifest.target, 'hermes-static_h');
  assert.equal(manifest.bytecodeSizeBytes, bytecode.length);
  assert.equal(typeof manifest.sha256, 'string');
  assert.equal(manifest.sha256.length, 64);
});

test('FederationManifestGenerator generates valid module federation config', () => {
  const manifest = FederationManifestGenerator.generateFederationConfig(
    'explorer-superapp',
    { 'weather-remote': 'https://remote.lynxfita.org/weather.json' }
  );

  assert.equal(manifest.scope, '@lynxfita/explorer-superapp');
  assert.equal(manifest.name, 'explorer-superapp');
  assert.ok(manifest.shared['@lynxfita/core']?.singleton);
  assert.equal(manifest.remotes['weather-remote'], 'https://remote.lynxfita.org/weather.json');
});
