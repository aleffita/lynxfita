/**
 * Workspace proxy package materializer for exFAT and cross-platform environments.
 * Materializes @lynxfita/* and @aleffita/lynxfita-* package proxies in node_modules
 * without relying on filesystem directory symlinks.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

interface WorkspaceEntry {
  readonly localScopeName: string;
  readonly publishScopeName: string;
  readonly relDir: string;
}

const WORKSPACE_PACKAGES: readonly WorkspaceEntry[] = [
  { localScopeName: '@lynxfita/core', publishScopeName: '@aleffita/lynxfita-core', relDir: 'packages/core' },
  { localScopeName: '@lynxfita/codegen', publishScopeName: '@aleffita/lynxfita-codegen', relDir: 'packages/codegen' },
  { localScopeName: '@lynxfita/wasi-runtime', publishScopeName: '@aleffita/lynxfita-wasi-runtime', relDir: 'packages/wasi-runtime' },
  { localScopeName: '@lynxfita/builder', publishScopeName: '@aleffita/lynxfita-builder', relDir: 'packages/builder' },
  { localScopeName: '@lynxfita/updater', publishScopeName: '@aleffita/lynxfita-updater', relDir: 'packages/updater' },
  { localScopeName: '@lynxfita/cli', publishScopeName: '@aleffita/lynxfita-cli', relDir: 'packages/cli' },
  { localScopeName: '@lynxfita/genui', publishScopeName: '@aleffita/lynxfita-genui', relDir: 'packages/genui' },
  { localScopeName: '@lynxfita/example-weather-showcase', publishScopeName: '@aleffita/lynxfita-bundle-weather-showcase', relDir: 'examples/weather-showcase' },
  { localScopeName: '@lynxfita/example-plugin-weather-simd', publishScopeName: '@aleffita/lynxfita-example-plugin-weather-simd', relDir: 'examples/plugins/weather-simd' },
  { localScopeName: '@lynxfita/explorer', publishScopeName: '@aleffita/lynxfita-explorer', relDir: 'examples/explorer' },
];

function materializeProxy(pkgName: string, targetRelDir: string, version: string): void {
  const proxyDir = resolve(rootDir, 'node_modules', ...pkgName.split('/'));
  mkdirSync(proxyDir, { recursive: true });

  const depth = pkgName.split('/').length + 1;
  const upPrefix = Array.from({ length: depth }, () => '..').join('/');
  const distIndexRel = `${upPrefix}/${targetRelDir}/dist/index.js`;
  const distTypesRel = `${upPrefix}/${targetRelDir}/dist/index.d.ts`;

  const proxyPkgJson = {
    name: pkgName,
    version,
    type: 'module',
    main: './index.js',
    types: distTypesRel,
    exports: {
      '.': {
        types: distTypesRel,
        default: './index.js',
      },
    },
  };

  writeFileSync(resolve(proxyDir, 'package.json'), JSON.stringify(proxyPkgJson, null, 2) + '\n', 'utf8');
  writeFileSync(
    resolve(proxyDir, 'index.js'),
    `export * from '${distIndexRel}';\n`,
    'utf8',
  );
  writeFileSync(
    resolve(proxyDir, 'index.d.ts'),
    `export * from '${distTypesRel}';\n`,
    'utf8',
  );
}

export function setupWorkspaceProxies(): void {
  const rootPkgPath = resolve(rootDir, 'package.json');
  const rootPkg = existsSync(rootPkgPath)
    ? (JSON.parse(readFileSync(rootPkgPath, 'utf8')) as { version?: string })
    : { version: '2.1.0' };
  const version = rootPkg.version ?? '2.1.0';

  for (const entry of WORKSPACE_PACKAGES) {
    materializeProxy(entry.localScopeName, entry.relDir, version);
    materializeProxy(entry.publishScopeName, entry.relDir, version);
  }
}

setupWorkspaceProxies();
