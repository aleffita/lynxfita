/**
 * Self-Contained Desktop Application Packager for LynxFita
 * Implements the Linux AppImage (Type 2) / Portable PE packaging layout:
 * - bundles/ (Hermes .hbc bytecode + bundle.manifest.json)
 * - plugins/ (Dynamic native libraries .dll/.so/.dylib & Cordis plugins)
 * - assets/  (Static media, icons, and fonts)
 * - release.manifest.json + Ed25519 signature (release.sig)
 */

import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BundlePackager, type BundleManifest } from './bundle_packager.js';

export interface PackOptions {
  appName: string;
  version: string;
  sourceCode: string;
  outputDir: string;
  targetPlatform?: string;
}

export interface PackResult {
  packageDir: string;
  bundlesDir: string;
  pluginsDir: string;
  assetsDir: string;
  hbcPath: string;
  manifestPath: string;
  releaseManifestPath: string;
  signaturePath: string;
  publicKeyPath: string;
  manifest: BundleManifest;
  releaseManifest: Record<string, unknown>;
  signature: string;
  files: string[];
}

export class SelfContainedPackager {
  public static pack(options: PackOptions): PackResult {
    const packageDir = join(options.outputDir, 'package');
    const bundlesDir = join(packageDir, 'bundles');
    const pluginsDir = join(packageDir, 'plugins');
    const assetsDir = join(packageDir, 'assets');

    mkdirSync(bundlesDir, { recursive: true });
    mkdirSync(pluginsDir, { recursive: true });
    mkdirSync(assetsDir, { recursive: true });

    // 1. Compile bundle bytecode and manifest
    const { bytecode, manifest } = BundlePackager.packageHermesBundle(
      options.appName,
      options.version,
      options.sourceCode,
      ['default']
    );

    const hbcPath = join(bundlesDir, `${options.appName}.hbc`);
    const manifestPath = join(bundlesDir, 'bundle.manifest.json');
    writeFileSync(hbcPath, bytecode);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    // 2. Generate portable launcher descriptor
    const launcherDescriptor = {
      name: options.appName,
      version: options.version,
      type: 'self-contained-desktop',
      platform: options.targetPlatform || process.platform,
      arch: process.arch,
      runtime: 'static_h-hermes-c++20',
      entrypoint: `bundles/${options.appName}.hbc`,
      manifest: 'bundles/bundle.manifest.json',
      pluginsDir: 'plugins',
      assetsDir: 'assets'
    };
    const launcherPath = join(packageDir, 'lynxfita.app.json');
    writeFileSync(launcherPath, JSON.stringify(launcherDescriptor, null, 2) + '\n', 'utf8');

    // 3. Compute Release Manifest
    const releaseManifest = {
      appName: options.appName,
      version: options.version,
      timestamp: new Date().toISOString(),
      target: options.targetPlatform || process.platform,
      files: [
        { path: `bundles/${options.appName}.hbc`, sha256: manifest.sha256, sizeBytes: bytecode.length },
        { path: 'bundles/bundle.manifest.json', sha256: createHash('sha256').update(JSON.stringify(manifest, null, 2)).digest('hex') }
      ]
    };
    const releaseManifestBytes = Buffer.from(JSON.stringify(releaseManifest, null, 2), 'utf8');
    const releaseManifestPath = join(packageDir, 'release.manifest.json');
    writeFileSync(releaseManifestPath, releaseManifestBytes);

    // 4. Ed25519 Signing
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const sig = sign(null, releaseManifestBytes, privateKey).toString('hex');
    const signaturePath = join(packageDir, 'release.sig');
    writeFileSync(signaturePath, sig, 'utf8');

    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const publicKeyPath = join(packageDir, 'release.pub');
    writeFileSync(publicKeyPath, publicKeyPem, 'utf8');

    const files = [
      hbcPath,
      manifestPath,
      launcherPath,
      releaseManifestPath,
      signaturePath,
      publicKeyPath
    ];

    return {
      packageDir,
      bundlesDir,
      pluginsDir,
      assetsDir,
      hbcPath,
      manifestPath,
      releaseManifestPath,
      signaturePath,
      publicKeyPath,
      manifest,
      releaseManifest,
      signature: sig,
      files
    };
  }
}
