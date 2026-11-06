/**
 * Self-Contained Desktop Release Packager for LynxFita
 * Generates an authentic AppImage (Type 2) / Portable PE release distribution containing:
 * - Native C++20 Desktop Host executable (lynxfita_explorer.exe / lynxfita_explorer)
 * - Portable Windows launcher (run.cmd) and POSIX launcher (AppRun)
 * - Meta Hermes HBC bytecode bundle (bundles/<app>.hbc) and manifest
 * - Dynamic native FFI plugins (plugins/lynxfita_weather_simd_plugin.dll / .so)
 * - Application descriptor (lynxfita.app.json)
 * - Cryptographically signed release manifest (release.manifest.json + release.sig + release.pub)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { SelfContainedPackager, resolveHermescBinary } from '../packages/builder/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const appName = process.env.APP_NAME || 'weather-showcase';
const releaseVersion = process.env.RELEASE_VERSION || '2.2.0';
const outputDir = process.env.OUTPUT_DIR || resolve(rootDir, 'dist/staging');

console.log(`[package-release] Packaging self-contained distribution for ${appName} (v${releaseVersion})...`);

const precompiledHbcPath = resolve(rootDir, 'examples/weather-showcase/dist/weather-showcase.hbc');
let precompiledBytecode: Uint8Array | undefined = undefined;

if (existsSync(precompiledHbcPath)) {
  const bytes = readFileSync(precompiledHbcPath);
  precompiledBytecode = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
} else {
  // Generate standalone showcase bundle and compile via hermesc
  const bundleScript = resolve(rootDir, 'scripts/bundle-showcase.ts');
  const hermescPath = resolveHermescBinary();
  if (existsSync(bundleScript) && hermescPath) {
    try {
      console.log('[package-release] Compiling standalone weather showcase bundle with hermesc...');
      execSync(`node --experimental-strip-types "${bundleScript}"`, { stdio: 'inherit' });
      const jsBundle = resolve(rootDir, 'examples/weather-showcase/dist/weather_bundle.js');
      if (existsSync(jsBundle)) {
        execSync(`"${hermescPath}" -emit-binary -out "${precompiledHbcPath}" -O "${jsBundle}"`, { stdio: 'inherit' });
        if (existsSync(precompiledHbcPath)) {
          const bytes = readFileSync(precompiledHbcPath);
          precompiledBytecode = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        }
      }
    } catch (err) {
      console.warn('[package-release] Precompilation failed, falling back to source packaging:', err);
    }
  }
}

const showcaseDistIndex = resolve(rootDir, 'examples/weather-showcase/dist/index.js');
let sourceCode = 'export const answer = 42;';
if (existsSync(showcaseDistIndex)) {
  sourceCode = readFileSync(showcaseDistIndex, 'utf8');
}

const result = SelfContainedPackager.pack({
  appName,
  version: releaseVersion,
  sourceCode,
  bytecode: precompiledBytecode,
  outputDir
});

console.log(`[package-release] Package generated successfully at: ${result.packageDir}`);
console.log(`[package-release] Native Host: ${result.nativeHostPath ?? 'not bundled (will look in PATH or current dir)'}`);
console.log(`[package-release] Bytecode Bundle: ${result.hbcPath}`);
console.log(`[package-release] Windows Launcher: ${result.runCmdPath}`);
console.log(`[package-release] POSIX Launcher: ${result.appRunPath}`);
console.log(`[package-release] Release Manifest: ${result.releaseManifestPath} (${(result.releaseManifest as any).files?.length ?? 0} files hashed)`);
console.log(`[package-release] Ed25519 Signature: ${result.signaturePath}`);
