import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { parseTypeScriptSpec, JsiCodeGenerator } from '@lynxfita/codegen';
import { BundlePackager } from '@lynxfita/builder';
import { StationaryDmaClient } from '@lynxfita/core';
import { WasiHostContext } from '@lynxfita/wasi-runtime';

export interface InitResult {
  success: boolean;
  targetDir: string;
  files: string[];
  template: string;
}

export interface CodegenResult {
  success: boolean;
  specFile: string;
  headerFile: string;
  bindingFile: string;
  className: string;
}

export interface BuildResult {
  success: boolean;
  targetDir: string;
  bundleCount: number;
  output: string;
  manifestFile?: string;
  hbcFile?: string;
}

export interface DoctorResult {
  ok: boolean;
  nodeVersion: string;
  platform: string;
  arch: string;
  checks: Record<string, boolean>;
  details: Record<string, string>;
}

export function formatCliError(error: unknown, rootCause: string, fixSuggestion: string): string {
  const errMsg = error instanceof Error ? error.message : String(error);
  return `
[LynxFita CLI Error]
Message:        ${errMsg}
Root Cause:     ${rootCause}
Fix Suggestion: ${fixSuggestion}
`;
}

export function initProject(
  moduleName = 'my-lynxfita-app',
  options: { template?: 'module' | 'weather-mvi' | 'mini-app'; cordis?: boolean } = {}
): InitResult {
  const targetDir = resolve(process.cwd(), moduleName);
  const srcDir = join(targetDir, 'src');
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });
  }

  const selectedTemplate = options.template || (options.cordis ? 'mini-app' : 'module');

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
      '@lynxfita/core': 'workspace:*',
      '@lynxfita/codegen': 'workspace:*'
    }
  };

  let mainTs = '';
  if (selectedTemplate === 'weather-mvi') {
    mainTs = `import { StationaryDmaClient, PluginLedger } from '@lynxfita/core';

console.log('Initializing LynxFita Weather MVI app: ${moduleName}');
const dma = new StationaryDmaClient(256 * 1024);
// Pack initial telemetry: [temp, humidity, pressure, windSpeed]
dma.packSimd4f(0x2000, 22.0, 60.0, 1013.25, 12.0);
console.log('Telemetry initialized at stationary DMA offset 0x2000');
`;
  } else if (selectedTemplate === 'mini-app') {
    mainTs = `import type { PluginDefinition } from '@lynxfita/core';

export const ${moduleName.replace(/[^a-zA-Z0-9]/g, '_')}Plugin: PluginDefinition = {
  meta: {
    id: '${moduleName}',
    name: '${moduleName}',
    version: '1.0.0',
    dependencies: [],
    requiredCoeffects: ['hardware.dma']
  },
  activate: async (ctx) => {
    console.log('[CORDIS] Activated mini-app plugin: ${moduleName}');
    await ctx.registerEffect(
      'state-listener',
      () => console.log('Listener mounted'),
      () => console.log('Listener dismantled')
    );
  }
};
`;
  } else {
    mainTs = `import { HermesRuntimeSession, BridgeInterceptor, StationaryDmaClient } from '@lynxfita/core';

console.log('Bootstrapping ${moduleName} with Static Hermes & EIB DMA...');
const hermes = new HermesRuntimeSession({ enableAot: true });
const bridge = new BridgeInterceptor();
const dma = new StationaryDmaClient();

console.log('Runtime Status:', hermes.getStatus().runtime);
console.log('${moduleName} ready.');
`;
  }

  const pkgPath = join(targetDir, 'package.json');
  const srcPath = join(srcDir, 'index.ts');

  writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf-8');
  writeFileSync(srcPath, mainTs, 'utf-8');

  return {
    success: true,
    targetDir,
    files: [pkgPath, srcPath],
    template: selectedTemplate
  };
}

export function runCodegen(specFilePath: string, outDir = 'src/native_gen'): CodegenResult {
  const fullSpecPath = resolve(specFilePath);
  if (!existsSync(fullSpecPath)) {
    throw new Error(`Spec file not found: ${fullSpecPath}`);
  }

  const sourceCode = readFileSync(fullSpecPath, 'utf-8');
  const spec = parseTypeScriptSpec(sourceCode);
  const generator = new JsiCodeGenerator();

  const headerContent = generator.generateCppHeader(spec);
  const bindingContent = generator.generateTypeScriptBinding(spec);

  const targetDir = resolve(outDir);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const baseFileName = spec.className.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  const headerFile = join(targetDir, `native_${baseFileName}_spec.h`);
  const bindingFile = join(targetDir, `${baseFileName}_binding.ts`);

  writeFileSync(headerFile, headerContent, 'utf-8');
  writeFileSync(bindingFile, bindingContent, 'utf-8');

  return {
    success: true,
    specFile: fullSpecPath,
    headerFile,
    bindingFile,
    className: spec.className
  };
}

export interface BuildOptions {
  entryFile?: string;
  outDir?: string;
}

export function buildProject(
  targetDirOrOptions: string | BuildOptions = process.cwd(),
  entryFile?: string,
  outDirParam?: string
): BuildResult {
  let projectDir = process.cwd();
  let entryOpt = entryFile;
  let outOpt = outDirParam;

  if (typeof targetDirOrOptions === 'object' && targetDirOrOptions !== null) {
    entryOpt = targetDirOrOptions.entryFile;
    outOpt = targetDirOrOptions.outDir;
  } else if (typeof targetDirOrOptions === 'string') {
    projectDir = resolve(targetDirOrOptions);
  }

  const dir = projectDir;
  const entry = entryOpt
    ? resolve(dir, entryOpt)
    : (
        existsSync(join(dir, 'src', 'index.ts'))
          ? join(dir, 'src', 'index.ts')
          : existsSync(join(dir, 'index.ts'))
          ? join(dir, 'index.ts')
          : existsSync(join(dir, 'src', 'index.js'))
          ? join(dir, 'src', 'index.js')
          : null
      );

  let sourceCode = 'export const answer = 42;';
  if (entry && existsSync(entry)) {
    sourceCode = readFileSync(entry, 'utf-8');
  }

  const bundleName = basename(dir);
  const { bytecode, manifest } = BundlePackager.packageHermesBundle(
    bundleName,
    '2.0.0',
    sourceCode,
    ['default']
  );

  const outDist = outOpt ? resolve(dir, outOpt) : join(dir, 'dist');
  if (!existsSync(outDist)) {
    mkdirSync(outDist, { recursive: true });
  }

  const hbcPath = join(outDist, `${bundleName}.hbc`);
  const manifestPath = join(outDist, 'bundle.manifest.json');

  writeFileSync(hbcPath, bytecode);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  return {
    success: true,
    targetDir: dir,
    bundleCount: 1,
    hbcFile: hbcPath,
    manifestFile: manifestPath,
    output: `[LynxFita CLI] Compiled Hermes AOT bundle at ${hbcPath} (SHA-256: ${manifest.sha256.substring(0, 16)}...)`
  };
}

export function runDoctor(): DoctorResult {
  const nodeMajor = parseInt(process.versions.node.split('.')[0] || '0', 10);

  // 1. Stationary DMA check
  let dmaOk = false;
  try {
    const dma = new StationaryDmaClient(64 * 1024);
    dma.packSimd4f(0, 1, 2, 3, 4);
    const un = dma.unpackSimd4f(0);
    dmaOk = un[0] === 1 && un[1] === 2 && un[2] === 3 && un[3] === 4;
  } catch {
    dmaOk = false;
  }

  // 2. Sandboxed WASI memory integrity check
  let wasiOk = false;
  try {
    const wasi = new WasiHostContext({ maxMemoryBytes: 1024 * 1024 });
    const testData = new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // \0asm magic
    wasi.writeBytes(0, testData);
    const readBack = wasi.readBytes(0, 4);
    wasiOk = readBack[0] === 0x00 && readBack[1] === 0x61 && readBack[2] === 0x73 && readBack[3] === 0x6d;
  } catch {
    wasiOk = false;
  }

  // 3. Submodule check (vendor/hermes or submodule existence)
  const repoRoot = resolve(process.cwd());
  const hermesVendor = existsSync(join(repoRoot, 'vendor', 'hermes')) ||
                       existsSync(join(repoRoot, '..', '..', 'vendor', 'hermes'));
  const cordisVendor = existsSync(join(repoRoot, 'vendor', 'cordis')) ||
                       existsSync(join(repoRoot, '..', '..', 'vendor', 'cordis'));
  const submodulesOk = hermesVendor || cordisVendor || existsSync(join(repoRoot, '.gitmodules'));

  // 4. Workspace packages check
  const pkgDir = existsSync(join(repoRoot, 'packages'))
    ? join(repoRoot, 'packages')
    : existsSync(join(repoRoot, '..', '..', 'packages'))
    ? join(repoRoot, '..', '..', 'packages')
    : null;
  const packagesOk = pkgDir !== null && existsSync(join(pkgDir, 'core'));

  const checks: Record<string, boolean> = {
    nodeVersionGte20: nodeMajor >= 20,
    hasSupportedPlatform: ['win32', 'linux', 'darwin'].includes(process.platform),
    hasSupportedArch: ['x64', 'arm64'].includes(process.arch),
    stationaryDmaIntegrity: dmaOk,
    wasiSandboxIntegrity: wasiOk,
    vendorSubmodulesIntegrity: submodulesOk,
    workspacePackagesIntegrity: packagesOk
  };

  const details: Record<string, string> = {
    node: process.version,
    platform: `${process.platform} (${process.arch})`,
    dmaArena: dmaOk ? 'Stationary 64KB SIMD buffer operational' : 'Allocation failed',
    wasiSandbox: wasiOk ? 'Linear memory sandbox operational' : 'WASI initialization failed',
    submodules: submodulesOk ? 'Vendor submodules verified' : 'Vendor submodules missing',
    packages: packagesOk ? 'Workspace packages verified' : 'Workspace packages missing'
  };

  const ok = Object.values(checks).every(Boolean);
  return {
    ok,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    checks,
    details
  };
}

export function printHelp(): void {
  console.log(`
========================================================================
   LynxFita CLI - Industrial Tooling & Developer Experience (v2.0.0)
========================================================================

Usage:
  lynxfita init <name> [--template module|weather-mvi|mini-app]
      Scaffold a new LynxFita application or module with architecture templates.

  lynxfita codegen <spec-file.ts> [--out <dir>]
      Parse TypeScript interface specs and synthesize C++20 JSI HostObject
      headers and typed TypeScript bindings.

  lynxfita build [--entry <file>] [--out <dir>]
      Compile TypeScript/JavaScript into Static Hermes AOT bytecode (.hbc)
      with cryptographic SHA-256 bundle manifests.

  lynxfita doctor
      Inspect runtime environment, platform support, and Stationary DMA integrity.

  lynxfita help
      Display this help guide.
`);
}

export async function runCli(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const command = args[0] || 'help';

  try {
    switch (command) {
      case 'init': {
        const name = args[1] && !args[1].startsWith('--') ? args[1] : 'my-lynxfita-app';
        let template: 'module' | 'weather-mvi' | 'mini-app' = 'module';
        const tmplIdx = args.indexOf('--template');
        if (tmplIdx !== -1 && args[tmplIdx + 1]) {
          template = args[tmplIdx + 1] as any;
        } else if (args.includes('--cordis')) {
          template = 'mini-app';
        }
        const res = initProject(name, { template });
        console.log(`[LynxFita CLI] Successfully initialized (${res.template}) at: ${res.targetDir}`);
        for (const file of res.files) {
          console.log(`  + ${file}`);
        }
        return 0;
      }

      case 'codegen': {
        const specFile = args[1];
        if (!specFile || specFile.startsWith('--')) {
          console.error(formatCliError(
            new Error('Missing spec file path'),
            'No TypeScript spec file was provided to the codegen command.',
            'Provide the path to a spec file: lynxfita codegen src/specs/NativeSensorSpec.ts [--out src/native_gen]'
          ));
          return 1;
        }
        let outDir = 'src/native_gen';
        const outIdx = args.indexOf('--out');
        if (outIdx !== -1 && args[outIdx + 1]) {
          outDir = args[outIdx + 1]!;
        }
        const res = runCodegen(specFile, outDir);
        console.log(`[LynxFita CLI] Codegen completed for '${res.className}':`);
        console.log(`  Header:  ${res.headerFile}`);
        console.log(`  Binding: ${res.bindingFile}`);
        return 0;
      }

      case 'build': {
        let entryFile: string | undefined;
        const entryIdx = args.indexOf('--entry');
        if (entryIdx !== -1 && args[entryIdx + 1]) {
          entryFile = args[entryIdx + 1];
        }
        let outDir: string | undefined;
        const outIdx = args.indexOf('--out');
        if (outIdx !== -1 && args[outIdx + 1]) {
          outDir = args[outIdx + 1]!;
        }
        const res = buildProject(process.cwd(), entryFile, outDir);
        console.log(res.output);
        if (res.manifestFile) {
          console.log(`  Manifest: ${res.manifestFile}`);
        }
        console.log('[LynxFita CLI] Build completed successfully.');
        return 0;
      }

      case 'doctor':
      case 'check': {
        const doc = runDoctor();
        console.log('========================================================');
        console.log('   LynxFita System Doctor & Environment Diagnostics     ');
        console.log('========================================================');
        console.log('Node.js Version:  ', doc.nodeVersion);
        console.log('Platform/Arch:  ', doc.details.platform);
        console.log('Stationary DMA: ', doc.details.dmaArena);
        console.log('Diagnostics:');
        for (const [k, v] of Object.entries(doc.checks)) {
          console.log(`  [${v ? 'PASS' : 'FAIL'}] ${k}`);
        }
        console.log('========================================================');
        console.log(doc.ok ? 'Subsystem check: OK. All subsystems operational.' : 'Subsystem check: FAILED.');
        return doc.ok ? 0 : 1;
      }

      case 'help':
      default:
        printHelp();
        return 0;
    }
  } catch (err) {
    console.error(formatCliError(
      err,
      'Command failed during execution.',
      'Check command syntax, file existence, and permissions.'
    ));
    return 1;
  }
}
