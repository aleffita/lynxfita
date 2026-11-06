/**
 * Self-Contained Desktop Application Packager for LynxFita
 * Implements the Linux AppImage (Type 2) / Portable PE packaging layout:
 * - lynxfita_explorer.exe / lynxfita_explorer (Native C++20 Desktop Host)
 * - run.cmd (Windows Portable Launcher)
 * - AppRun (POSIX Executable Launcher)
 * - lynxfita.app.json (Application Metadata Descriptor)
 * - bundles/ (Hermes .hbc bytecode + bundle.manifest.json)
 * - plugins/ (Dynamic native libraries .dll/.so/.dylib & Cordis plugins)
 * - assets/  (Static media, icons, and fonts)
 * - release.manifest.json + Ed25519 signature (release.sig) + public key (release.pub)
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { BundlePackager, type BundleManifest } from './bundle_packager.js';

export interface PackOptions {
  appName: string;
  version: string;
  sourceCode?: string;
  bytecode?: Uint8Array;
  outputDir: string;
  targetPlatform?: string;
  nativeHostPath?: string;
  plugins?: string[];
  assets?: string[];
  signingPrivateKey?: string;
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
  runCmdPath: string;
  appRunPath: string;
  nativeHostPath?: string | undefined;
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
    let bytecode: Uint8Array;
    let manifest: BundleManifest;
    if (options.bytecode && options.bytecode.length > 0) {
      bytecode = options.bytecode;
      const sha256 = createHash('sha256').update(bytecode).digest('hex');
      manifest = {
        bundleName: options.appName,
        version: options.version,
        target: 'hermes-static_h',
        sha256,
        bytecodeSizeBytes: bytecode.length,
        entrypoint: `${options.appName}.hbc`,
        exportedModules: ['default'],
        deterministicSignature: `sig-deterministic-${sha256.substring(0, 16)}`
      };
    } else {
      const source = options.sourceCode ?? 'export const answer = 42;';
      const bundled = BundlePackager.packageHermesBundle(
        options.appName,
        options.version,
        source,
        ['default']
      );
      bytecode = bundled.bytecode;
      manifest = bundled.manifest;
    }

    const hbcPath = join(bundlesDir, `${options.appName}.hbc`);
    const manifestPath = join(bundlesDir, 'bundle.manifest.json');
    writeFileSync(hbcPath, bytecode);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    // 2. Locate and bundle native desktop host executable
    const targetPlatform = options.targetPlatform || process.platform;
    const isWin = targetPlatform === 'win32';
    const hostBinName = isWin ? 'lynxfita_explorer.exe' : 'lynxfita_explorer';

    let resolvedNativeHost: string | undefined = undefined;
    if (options.nativeHostPath && existsSync(options.nativeHostPath)) {
      resolvedNativeHost = options.nativeHostPath;
    } else {
      const hostCandidates = [
        join(process.cwd(), 'build', 'native', hostBinName),
        join(process.cwd(), 'build', 'native', 'Release', hostBinName),
        join(process.cwd(), '..', '..', 'build', 'native', hostBinName),
        join(process.cwd(), '..', '..', 'build', 'native', 'Release', hostBinName)
      ];
      for (const cand of hostCandidates) {
        if (existsSync(cand)) {
          resolvedNativeHost = cand;
          break;
        }
      }
    }

    let copiedNativeHost: string | undefined = undefined;
    if (resolvedNativeHost && existsSync(resolvedNativeHost)) {
      const targetHostPath = join(packageDir, hostBinName);
      copyFileSync(resolvedNativeHost, targetHostPath);
      try {
        chmodSync(targetHostPath, 0o755);
      } catch {}
      copiedNativeHost = targetHostPath;
    }

    // 3. Bundle dynamic FFI plugins
    if (options.plugins && options.plugins.length > 0) {
      for (const p of options.plugins) {
        if (existsSync(p)) {
          copyFileSync(p, join(pluginsDir, basename(p)));
        }
      }
    } else {
      const pluginExtensions = isWin ? ['.dll'] : ['.so', '.dylib'];
      const defaultPluginNames = ['lynxfita_weather_simd_plugin'];
      for (const base of defaultPluginNames) {
        for (const ext of pluginExtensions) {
          const pluginName = `${base}${ext}`;
          const pluginCandidates = [
            join(process.cwd(), 'build', 'native', pluginName),
            join(process.cwd(), 'build', 'native', 'Release', pluginName),
            join(process.cwd(), '..', '..', 'build', 'native', pluginName),
            join(process.cwd(), '..', '..', 'build', 'native', 'Release', pluginName)
          ];
          for (const cand of pluginCandidates) {
            if (existsSync(cand)) {
              copyFileSync(cand, join(pluginsDir, pluginName));
              break;
            }
          }
        }
      }
    }

    // 4. Bundle static assets
    if (options.assets && options.assets.length > 0) {
      for (const a of options.assets) {
        if (existsSync(a)) {
          copyFileSync(a, join(assetsDir, basename(a)));
        }
      }
    }

    // 5. Generate portable launchers
    const runCmdContent = `@echo off
setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set TARGET_BUNDLE=%~1
if "%TARGET_BUNDLE%"=="" set TARGET_BUNDLE=%SCRIPT_DIR%bundles\\${options.appName}.hbc
if exist "%SCRIPT_DIR%lynxfita_explorer.exe" (
  "%SCRIPT_DIR%lynxfita_explorer.exe" --gui "%TARGET_BUNDLE%" %2 %3 %4 %5
) else if exist "%SCRIPT_DIR%${options.appName}.exe" (
  "%SCRIPT_DIR%${options.appName}.exe" --gui "%TARGET_BUNDLE%" %2 %3 %4 %5
) else (
  echo [LynxFita] Native desktop host not found in %SCRIPT_DIR%
  exit /b 1
)
`;
    const runCmdPath = join(packageDir, 'run.cmd');
    writeFileSync(runCmdPath, runCmdContent, 'utf8');

    const appRunContent = `#!/bin/sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET_BUNDLE="\${1:-$HERE/bundles/${options.appName}.hbc}"
shift 2>/dev/null || true
if [ -x "$HERE/lynxfita_explorer" ]; then
  exec "$HERE/lynxfita_explorer" --gui "$TARGET_BUNDLE" "$@"
elif [ -x "$HERE/${options.appName}" ]; then
  exec "$HERE/${options.appName}" --gui "$TARGET_BUNDLE" "$@"
elif [ -f "$HERE/lynxfita_explorer" ]; then
  chmod +x "$HERE/lynxfita_explorer"
  exec "$HERE/lynxfita_explorer" --gui "$TARGET_BUNDLE" "$@"
else
  echo "[LynxFita] Native desktop host not found in $HERE"
  exit 1
fi
`;
    const appRunPath = join(packageDir, 'AppRun');
    writeFileSync(appRunPath, appRunContent, 'utf8');
    try {
      chmodSync(appRunPath, 0o755);
    } catch {}

    // 6. Generate portable launcher descriptor
    const launcherDescriptor = {
      name: options.appName,
      version: options.version,
      type: 'self-contained-desktop',
      platform: targetPlatform,
      arch: process.arch,
      runtime: 'static_h-hermes-c++20',
      entrypoint: `bundles/${options.appName}.hbc`,
      manifest: 'bundles/bundle.manifest.json',
      pluginsDir: 'plugins',
      assetsDir: 'assets',
      launchers: {
        windows: 'run.cmd',
        posix: 'AppRun'
      }
    };
    const launcherPath = join(packageDir, 'lynxfita.app.json');
    writeFileSync(launcherPath, JSON.stringify(launcherDescriptor, null, 2) + '\n', 'utf8');

    // 7. Compute Release Manifest covering all packaged files
    const allPackagedFiles = collectFilesRecursively(packageDir);
    const fileEntries: { path: string; sha256: string; sizeBytes: number }[] = [];

    for (const filePath of allPackagedFiles) {
      const rel = relative(packageDir, filePath).replace(/\\/g, '/');
      if (
        rel === 'release.manifest.json' ||
        rel === 'release.sig' ||
        rel === 'release.pub'
      ) {
        continue;
      }
      const bytes = readFileSync(filePath);
      const fileSha = createHash('sha256').update(bytes).digest('hex');
      fileEntries.push({
        path: rel,
        sha256: fileSha,
        sizeBytes: bytes.length
      });
    }

    fileEntries.sort((a, b) => a.path.localeCompare(b.path));

    const releaseManifest = {
      appName: options.appName,
      version: options.version,
      timestamp: new Date().toISOString(),
      target: targetPlatform,
      arch: process.arch,
      files: fileEntries
    };
    const releaseManifestBytes = Buffer.from(JSON.stringify(releaseManifest, null, 2) + '\n', 'utf8');
    const releaseManifestPath = join(packageDir, 'release.manifest.json');
    writeFileSync(releaseManifestPath, releaseManifestBytes);

    // 8. Ed25519 Signing
    let sig: string;
    let publicKeyPem: string;
    if (options.signingPrivateKey) {
      const privateKey = createPrivateKey(options.signingPrivateKey);
      const publicKey = createPublicKey(privateKey);
      sig = sign(null, releaseManifestBytes, privateKey).toString('hex');
      publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    } else {
      const { publicKey, privateKey } = generateKeyPairSync('ed25519');
      sig = sign(null, releaseManifestBytes, privateKey).toString('hex');
      publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    }
    const signaturePath = join(packageDir, 'release.sig');
    writeFileSync(signaturePath, sig, 'utf8');

    const publicKeyPath = join(packageDir, 'release.pub');
    writeFileSync(publicKeyPath, publicKeyPem, 'utf8');

    const outputFiles = [
      ...allPackagedFiles,
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
      runCmdPath,
      appRunPath,
      nativeHostPath: copiedNativeHost,
      manifest,
      releaseManifest,
      signature: sig,
      files: Array.from(new Set(outputFiles))
    };
  }
}

function collectFilesRecursively(dir: string): string[] {
  const result: string[] = [];
  if (!existsSync(dir)) return result;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFilesRecursively(full));
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}
