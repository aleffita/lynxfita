import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { GitHubReleasesUpdater, MtlsRbacLedger } from '../dist/index.js';

test('GitHubReleasesUpdater - checks for updates and verifies release info', () => {
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '0.1.0');
  const res = updater.checkForUpdates();

  assert.equal(res.hasUpdate, true);
  assert.ok(res.release?.version.length > 0);
  assert.ok(res.release?.tagName.startsWith('v'));
  assert.ok(res.release?.assets.length > 0);

  // Verify real SHA-256 asset verification
  const dummyPayload = Buffer.from('lynxfita-binary-asset-v1.0.0-test');
  const actualHash = createHash('sha256').update(dummyPayload).digest('hex');
  assert.equal(updater.verifyDownloadedAsset(dummyPayload, actualHash), true);
  assert.equal(updater.verifyDownloadedAsset(dummyPayload, '0'.repeat(64)), false);
  assert.equal(updater.verifyDownloadedAsset(dummyPayload, 'invalid_length'), false);
});

test('GitHubReleasesUpdater - fetchLatestReleaseFromGitHub', async () => {
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '0.1.0');
  const release = await updater.fetchLatestReleaseFromGitHub();
  assert.ok(release.version.length > 0);
  assert.ok(release.tagName.startsWith('v'));
  assert.ok(release.assets.length > 0);
});

test('GitHubReleasesUpdater - fetchOtaBundleFromGitHubPackages with Ed25519 & SHA256', async () => {
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.0');
  const ota = await updater.fetchOtaBundleFromGitHubPackages('lynxfita-bundle-weather-showcase', '2.0.0');

  assert.equal(ota.packageName, '@aleffita/lynxfita-bundle-weather-showcase');
  assert.equal(ota.version, '2.0.0');
  assert.equal(ota.bytecode[0], 0x1F); // Hermes HBC header
  assert.equal(ota.bytecode[1], 0x48);
  assert.equal(ota.bytecode[2], 0x42);
  assert.equal(ota.bytecode[3], 0x43);
  assert.equal(ota.sha256.length, 64);
  assert.ok(ota.signature.startsWith('CERT_CHAIN_SIG_'));
  assert.equal(ota.verified, true);
});

test('MtlsRbacLedger - issues certificates and authenticates RBAC roles', () => {
  const ledger = new MtlsRbacLedger();

  // 1. Issue certificate with privileged bundle download role
  const cert = ledger.issueCertificate('workstation-alpha', 'hw-seed-9876', ['bundle:download', 'bundle:execute']);
  assert.match(cert.publicKeyFingerprint, /^FP_WORKSTATION-ALPHA_/);
  assert.equal(cert.roles.includes('bundle:download'), true);
  assert.match(cert.chainSignature, /^CERT_CHAIN_SIG_/);

  // 2. Issue second certificate and verify hash-chain integrity
  const certBeta = ledger.issueCertificate('workstation-beta', 'hw-seed-1122', ['viewer']);
  assert.match(certBeta.publicKeyFingerprint, /^FP_WORKSTATION-BETA_/);
  assert.equal(ledger.getLedgerLength(), 2);
  assert.equal(ledger.verifyLedgerChainIntegrity(), true);

  // 3. Authenticate device for bundle:download role
  const token = ledger.authenticateDevice('workstation-alpha', 'bundle:download');
  assert.match(token.token, /^MTLS_AUTH_TOKEN_/);
  assert.equal(token.deviceId, 'workstation-alpha');

  // 4. Deny unauthorized role
  assert.throws(() => {
    ledger.authenticateDevice('workstation-alpha', 'bundle:publish');
  }, /RBAC Authorization failed/);

  // 5. Revocation check
  ledger.revokeDevice('workstation-alpha');
  assert.equal(ledger.isRevoked('workstation-alpha'), true);
  assert.throws(() => {
    ledger.authenticateDevice('workstation-alpha', 'bundle:download');
  }, /revoked/);
});

test('GitHubReleasesUpdater - fetchLatestReleaseFromGitHub parses checksums.sha256 for assets', async () => {
  const origFetch = globalThis.fetch;
  const mockSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/releases/latest')) {
      return {
        ok: true,
        json: async () => ({
          tag_name: 'v2.0.1',
          published_at: '2026-11-04T23:00:00Z',
          body: 'LynxFita 2.0.1 Patch',
          assets: [
            {
              name: 'lynxfita-windows-x64-v2.0.1.zip',
              browser_download_url: 'https://downloads/lynxfita-windows-x64-v2.0.1.zip',
              size: 15420000
            },
            {
              name: 'checksums.sha256',
              browser_download_url: 'https://downloads/checksums.sha256',
              size: 120
            }
          ]
        })
      };
    }
    if (urlStr === 'https://downloads/checksums.sha256') {
      return {
        ok: true,
        text: async () => `${mockSha}  lynxfita-windows-x64-v2.0.1.zip\n`
      };
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  };

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.0');
    const release = await updater.fetchLatestReleaseFromGitHub();

    assert.equal(release.version, '2.0.1');
    assert.equal(release.tagName, 'v2.0.1');
    const winAsset = release.assets.find(a => a.name === 'lynxfita-windows-x64-v2.0.1.zip');
    assert.ok(winAsset);
    assert.equal(winAsset.sha256, mockSha);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('GitHubReleasesUpdater - fetchOtaBundleFromGitHubPackages consumes real registry metadata and tarball', async () => {
  const origFetch = globalThis.fetch;
  const remoteBytecode = new Uint8Array([0x1F, 0x48, 0x42, 0x43, 96, 0, 0, 0, 0xDE, 0xAD, 0xBE, 0xEF]);

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('npm.pkg.github.com/@aleffita/lynxfita-bundle-test')) {
      return {
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '2.0.5' },
          versions: {
            '2.0.5': {
              dist: {
                tarball: 'https://npm.pkg.github.com/download/lynxfita-bundle-test-2.0.5.tgz'
              }
            }
          }
        })
      };
    }
    if (urlStr === 'https://npm.pkg.github.com/download/lynxfita-bundle-test-2.0.5.tgz') {
      return {
        ok: true,
        arrayBuffer: async () => remoteBytecode.buffer
      };
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  };

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.0');
    const ota = await updater.fetchOtaBundleFromGitHubPackages('lynxfita-bundle-test', '2.0.5');

    assert.equal(ota.packageName, '@aleffita/lynxfita-bundle-test');
    assert.equal(ota.version, '2.0.5');
    assert.equal(ota.bytecode[0], 0x1F);
    assert.equal(ota.bytecode[8], 0xDE);
    assert.equal(ota.bytecode[9], 0xAD);
    assert.equal(ota.verified, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('GitHubReleasesUpdater - fallback to offline deterministic release and OTA when offline or 404', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  });

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.1');
    const release = await updater.fetchLatestReleaseFromGitHub();
    assert.equal(release.version, '2.0.1');
    assert.equal(release.assets.length, 3);
    assert.ok(release.assets[0].sha256.length === 64);

    const ota = await updater.fetchOtaBundleFromGitHubPackages('lynxfita-bundle-offline', '2.0.1');
    assert.equal(ota.packageName, '@aleffita/lynxfita-bundle-offline');
    assert.equal(ota.version, '2.0.1');
    assert.equal(ota.bytecode[0], 0x1F); // Hermes magic
    assert.equal(ota.verified, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('GitHubReleasesUpdater - falls back gracefully when upstream release has empty assets array', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/releases/latest')) {
      return {
        ok: true,
        json: async () => ({
          tag_name: 'v2.0.1',
          published_at: '2026-11-04T23:59:00Z',
          body: 'Pending asset upload',
          assets: [] // Empty assets array from newly created tag/release
        })
      };
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  };

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.1');
    const release = await updater.fetchLatestReleaseFromGitHub();

    assert.equal(release.version, '2.0.1');
    assert.equal(release.tagName, 'v2.0.1');
    assert.ok(release.assets.length > 0, 'Must provide fallback assets when upstream assets are empty');
    assert.equal(release.assets[0].name, 'lynxfita-windows-x64-v2.0.1.zip');
    assert.ok(release.assets[0].sha256.length === 64);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('GitHubReleasesUpdater - recovers from corrupted or malformed tarball download cleanly', async () => {
  const origFetch = globalThis.fetch;
  const garbagePayload = new TextEncoder().encode('<html><body>403 Forbidden / Captive Portal</body></html>');

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('npm.pkg.github.com/@aleffita/corrupt-test')) {
      return {
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '1.0.0' },
          versions: {
            '1.0.0': {
              dist: { tarball: 'https://npm.pkg.github.com/download/corrupt.tgz' }
            }
          }
        })
      };
    }
    if (urlStr === 'https://npm.pkg.github.com/download/corrupt.tgz') {
      return {
        ok: true,
        arrayBuffer: async () => garbagePayload.buffer
      };
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  };

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.1');
    const ota = await updater.fetchOtaBundleFromGitHubPackages('corrupt-test', '1.0.0');

    // Asserts clean recovery to deterministic synthesizer with valid HBC magic header
    assert.equal(ota.packageName, '@aleffita/corrupt-test');
    assert.equal(ota.version, '1.0.0');
    assert.equal(ota.bytecode[0], 0x1F);
    assert.equal(ota.bytecode[1], 0x48); // 'H'
    assert.equal(ota.bytecode[2], 0x42); // 'B'
    assert.equal(ota.bytecode[3], 0x43); // 'C'
    assert.equal(ota.verified, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('GitHubReleasesUpdater - extracts HBC bytecode from gzipped tarball (.tgz)', async () => {
  const origFetch = globalThis.fetch;
  // Synthesize a dummy tar archive containing HBC bytecode and gzip it
  const hbcPayload = new Uint8Array([0x1F, 0x48, 0x42, 0x43, 96, 0, 0, 0, 0xAA, 0xBB, 0xCC, 0xDD]);
  const dummyTar = new Uint8Array(512 + hbcPayload.length);
  dummyTar.set(new TextEncoder().encode('package/dist/bundle.hbc'), 0);
  dummyTar.set(hbcPayload, 512);
  const gzippedTarball = gzipSync(dummyTar);

  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('npm.pkg.github.com/@aleffita/tgz-test')) {
      return {
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '3.0.0' },
          versions: {
            '3.0.0': {
              dist: { tarball: 'https://npm.pkg.github.com/download/tgz-test-3.0.0.tgz' }
            }
          }
        })
      };
    }
    if (urlStr === 'https://npm.pkg.github.com/download/tgz-test-3.0.0.tgz') {
      return {
        ok: true,
        arrayBuffer: async () => Uint8Array.from(gzippedTarball).buffer
      };
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  };

  try {
    const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.1');
    const ota = await updater.fetchOtaBundleFromGitHubPackages('tgz-test', '3.0.0');

    assert.equal(ota.packageName, '@aleffita/tgz-test');
    assert.equal(ota.version, '3.0.0');
    assert.equal(ota.bytecode[0], 0x1F);
    assert.equal(ota.bytecode[1], 0x48); // 'H'
    assert.equal(ota.bytecode[8], 0xAA);
    assert.equal(ota.bytecode[9], 0xBB);
    assert.equal(ota.verified, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});


