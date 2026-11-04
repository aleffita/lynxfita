import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const lynxFitaDir = path.join(rootDir, 'node_modules', '@lynxfita');
const alefFitaDir = path.join(rootDir, 'node_modules', '@aleffita');

const packages = [
  'core',
  'wasi-runtime',
  'codegen',
  'builder',
  'updater',
  'cli'
];

for (const pkg of packages) {
  // 1. @lynxfita/<pkg>
  const targetDir = path.join(lynxFitaDir, pkg);
  fs.mkdirSync(targetDir, { recursive: true });

  const pkgJson = {
    name: `@lynxfita/${pkg}`,
    version: '2.0.0',
    type: 'module',
    main: './index.js',
    exports: './index.js',
    types: `../../../packages/${pkg}/dist/index.d.ts`
  };

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(pkgJson, null, 2) + '\n',
    'utf-8'
  );

  const indexJs = `export * from '../../../packages/${pkg}/dist/index.js';\n`;
  fs.writeFileSync(path.join(targetDir, 'index.js'), indexJs, 'utf-8');

  // 2. @aleffita/lynxfita-<pkg> (Alias for GitHub Packages parity)
  const scopedDir = path.join(alefFitaDir, `lynxfita-${pkg}`);
  fs.mkdirSync(scopedDir, { recursive: true });

  const scopedPkgJson = {
    name: `@aleffita/lynxfita-${pkg}`,
    version: '2.0.0',
    type: 'module',
    main: './index.js',
    exports: './index.js',
    types: `../../../packages/${pkg}/dist/index.d.ts`
  };

  fs.writeFileSync(
    path.join(scopedDir, 'package.json'),
    JSON.stringify(scopedPkgJson, null, 2) + '\n',
    'utf-8'
  );

  fs.writeFileSync(path.join(scopedDir, 'index.js'), indexJs, 'utf-8');
}

// 3. Configure @lynxfita/example-weather-showcase and @aleffita/lynxfita-bundle-weather-showcase
const weatherDirs = [
  path.join(lynxFitaDir, 'example-weather-showcase'),
  path.join(alefFitaDir, 'lynxfita-bundle-weather-showcase')
];

for (const wDir of weatherDirs) {
  fs.mkdirSync(wDir, { recursive: true });
  const wPkgJson = {
    name: path.basename(wDir),
    version: '2.0.0',
    type: 'module',
    main: './index.js',
    exports: './index.js',
    types: `../../../examples/weather-showcase/dist/index.d.ts`
  };
  fs.writeFileSync(
    path.join(wDir, 'package.json'),
    JSON.stringify(wPkgJson, null, 2) + '\n',
    'utf-8'
  );
  const wIndexJs = `export * from '../../../examples/weather-showcase/dist/index.js';\n`;
  fs.writeFileSync(path.join(wDir, 'index.js'), wIndexJs, 'utf-8');
}

console.log('[Workspace Setup] Configured @lynxfita/* and @aleffita/lynxfita-* proxy stubs in node_modules.');
