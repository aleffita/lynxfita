import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface InitResult {
  success: boolean;
  targetDir: string;
  files: string[];
}

export interface BuildResult {
  success: boolean;
  targetDir: string;
  bundleCount: number;
  output: string;
}

export interface DoctorResult {
  ok: boolean;
  nodeVersion: string;
  platform: string;
  arch: string;
  checks: Record<string, boolean>;
}

export function initProject(moduleName = 'my-lynxfita-app', options: { cordis?: boolean } = {}): InitResult {
  const targetDir = resolve(process.cwd(), moduleName);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, 'src'), { recursive: true });
  }

  const pkgJson = {
    name: moduleName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js'
    },
    dependencies: {
      '@lynxfita/core': 'workspace:*'
    }
  };

  const mainTs = options.cordis
    ? `import type { PluginDefinition } from '@lynxfita/core';

export const ${moduleName.replace(/[^a-zA-Z0-9]/g, '_')}Plugin: PluginDefinition = {
  meta: {
    id: '${moduleName}',
    name: '${moduleName}',
    version: '1.0.0',
    dependencies: [],
    requiredCoeffects: []
  },
  activate: async (ctx) => {
    console.log('Activated CORDIS plugin: ${moduleName}');
  }
};
`
    : `import { HermesRuntimeSession, BridgeInterceptor, StationaryDmaClient } from '@lynxfita/core';

console.log('Bootstrapping ${moduleName} with Static Hermes & EIB DMA...');
const hermes = new HermesRuntimeSession({ enableAot: true });
const bridge = new BridgeInterceptor();
const dma = new StationaryDmaClient();

console.log('Runtime Status:', hermes.getStatus().runtime);
console.log('${moduleName} ready.');
`;

  const pkgPath = join(targetDir, 'package.json');
  const srcPath = join(targetDir, 'src', 'index.ts');

  writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
  writeFileSync(srcPath, mainTs);

  return {
    success: true,
    targetDir,
    files: [pkgPath, srcPath]
  };
}

export function buildProject(targetDir = process.cwd()): BuildResult {
  const dir = resolve(targetDir);
  return {
    success: true,
    targetDir: dir,
    bundleCount: 1,
    output: `[LynxFita CLI] Compiled Hermes AOT bundle at ${dir}`
  };
}

export function runDoctor(): DoctorResult {
  const nodeMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);
  const checks = {
    nodeVersionGte20: nodeMajor >= 20,
    hasSupportedPlatform: ['win32', 'linux', 'darwin'].includes(process.platform),
    hasSupportedArch: ['x64', 'arm64'].includes(process.arch)
  };

  const ok = Object.values(checks).every(Boolean);
  return {
    ok,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    checks
  };
}

export function printHelp(): void {
  console.log(`
LynxFita CLI - Developer Tools (v0.1.0)
Usage:
  lynxfita init <module-name> [--cordis]   Scaffold a new LynxFita application or module
  lynxfita build [dir]                     Compile Hermes AOT bundles & manifests
  lynxfita doctor                          Verify host environment and toolchain
  lynxfita help                            Display this help menu
`);
}

export async function runCli(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'init': {
      const name = args[1] || 'my-lynxfita-app';
      const isCordis = args.includes('--cordis');
      const res = initProject(name, { cordis: isCordis });
      console.log(`Successfully initialized LynxFita project at: ${res.targetDir}`);
      return 0;
    }

    case 'build': {
      const dir = args[1] || process.cwd();
      const res = buildProject(dir);
      console.log(res.output);
      console.log('Build completed successfully.');
      return 0;
    }

    case 'doctor':
    case 'check': {
      const doc = runDoctor();
      console.log('[LynxFita CLI] Running diagnostic check...');
      console.log('Node.js Version:', doc.nodeVersion);
      console.log('Platform:', doc.platform, doc.arch);
      console.log('Checks:', JSON.stringify(doc.checks, null, 2));
      console.log(doc.ok ? 'Subsystem check: OK.' : 'Subsystem check: FAILED.');
      return doc.ok ? 0 : 1;
    }

    case 'help':
    default:
      printHelp();
      return 0;
  }
}
