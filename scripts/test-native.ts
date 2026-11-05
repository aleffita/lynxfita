/**
 * Cross-platform C++20 native build and test orchestrator in pure TypeScript.
 * Replaces legacy scripts/test-native.cmd so Windows (MSVC/Ninja), Linux (GCC/Clang),
 * and macOS (AppleClang) share one typed entrypoint.
 */

import { spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const nativeSrcDir = resolve(rootDir, 'src', 'native');
const buildDir = resolve(rootDir, 'build', 'native');

function runChecked(cmd: string, args: readonly string[], cwd: string, env?: NodeJS.ProcessEnv): void {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: env ?? process.env,
    shell: false,
  });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status ?? 'signal'}): ${cmd} ${args.join(' ')}`);
  }
}

function buildAndTestWindows(): void {
  const vcvarsCandidates = [
    'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\BuildTools2022\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat',
  ];
  const vcvars = vcvarsCandidates.find((p) => existsSync(p));
  const testExe = resolve(buildDir, 'lynxfita_native_tests.exe');

  if (vcvars) {
    const batchCmd = `call "${vcvars}" >nul && cmake -S "${nativeSrcDir}" -B "${buildDir}" -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build "${buildDir}" --config Release`;
    execSync(batchCmd, { cwd: rootDir, stdio: 'inherit' });
  } else {
    runChecked('cmake', ['-S', nativeSrcDir, '-B', buildDir, '-DCMAKE_BUILD_TYPE=Release'], rootDir);
    runChecked('cmake', ['--build', buildDir, '--config', 'Release'], rootDir);
  }

  const resolvedTestExe = existsSync(testExe)
    ? testExe
    : resolve(buildDir, 'Release', 'lynxfita_native_tests.exe');
  runChecked(resolvedTestExe, [], buildDir);
}

function buildAndTestPosix(): void {
  runChecked('cmake', ['-S', nativeSrcDir, '-B', buildDir, '-DCMAKE_BUILD_TYPE=Release'], rootDir);
  runChecked('cmake', ['--build', buildDir, '--config', 'Release'], rootDir);
  const testBin = resolve(buildDir, 'lynxfita_native_tests');
  runChecked(testBin, [], buildDir);
}

mkdirSync(buildDir, { recursive: true });
if (process.platform === 'win32') {
  buildAndTestWindows();
} else {
  buildAndTestPosix();
}
