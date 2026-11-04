import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReleasesUpdater, MtlsRbacLedger } from '../dist/index.js';

test('GitHubReleasesUpdater - checks for updates and verifies release info', () => {
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '0.1.0');
  const res = updater.checkForUpdates();

  assert.equal(res.hasUpdate, true);
  assert.equal(res.release?.version, '1.0.0');
  assert.equal(res.release?.tagName, 'v1.0.0');
  assert.ok(res.release?.assets.length > 0);
  assert.equal(res.release?.assets[0].name, 'lynxfita-windows-x64-v1.0.0.zip');
});

test('MtlsRbacLedger - issues certificates and authenticates RBAC roles', () => {
  const ledger = new MtlsRbacLedger();

  // 1. Issue certificate with privileged bundle download role
  const cert = ledger.issueCertificate('workstation-alpha', 'hw-seed-9876', ['bundle:download', 'bundle:execute']);
  assert.match(cert.publicKeyFingerprint, /^FP_WORKSTATION-ALPHA_/);
  assert.equal(cert.roles.includes('bundle:download'), true);

  // 2. Authenticate device for bundle:download role
  const token = ledger.authenticateDevice('workstation-alpha', 'bundle:download');
  assert.match(token.token, /^MTLS_AUTH_TOKEN_/);
  assert.equal(token.deviceId, 'workstation-alpha');

  // 3. Deny unauthorized role
  assert.throws(() => {
    ledger.authenticateDevice('workstation-alpha', 'bundle:publish');
  }, /RBAC Authorization failed/);

  // 4. Revocation check
  ledger.revokeDevice('workstation-alpha');
  assert.equal(ledger.isRevoked('workstation-alpha'), true);
  assert.throws(() => {
    ledger.authenticateDevice('workstation-alpha', 'bundle:download');
  }, /revoked/);
});
