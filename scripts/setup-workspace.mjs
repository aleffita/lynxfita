import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const lynxFitaDir = path.join(rootDir, 'node_modules', '@lynxfita');

const packages = [
  'core',
  'wasi-runtime',
  'codegen',
  'builder',
  'updater',
  'cli'
];

for (const pkg of packages) {
  const targetDir = path.join(lynxFitaDir, pkg);
  fs.mkdirSync(targetDir, { recursive: true });

  const pkgJson = {
    name: `@lynxfita/${pkg}`,
    version: '0.1.0',
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
}

console.log('[Workspace Setup] Configured @lynxfita/* proxy stubs in node_modules.');
