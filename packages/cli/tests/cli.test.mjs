import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';

const cliPath = resolve('bin/lynxfita.js');

test('LynxFita CLI - displays help', () => {
  const output = execSync(`node "${cliPath}" help`, { encoding: 'utf-8' });
  assert.match(output, /LynxFita CLI/);
  assert.match(output, /lynxfita init/);
  assert.match(output, /lynxfita doctor/);
});

test('LynxFita CLI - doctor command', () => {
  const output = execSync(`node "${cliPath}" doctor`, { encoding: 'utf-8' });
  assert.match(output, /Subsystem check: OK/);
  assert.match(output, /Node\.js Version/);
});

test('LynxFita CLI - check command alias', () => {
  const output = execSync(`node "${cliPath}" check`, { encoding: 'utf-8' });
  assert.match(output, /Subsystem check: OK/);
});

test('LynxFita CLI - build command', () => {
  const output = execSync(`node "${cliPath}" build`, { encoding: 'utf-8' });
  assert.match(output, /Compiled Hermes AOT bundle/);
  assert.match(output, /Build completed successfully/);
});

test('LynxFita CLI - init module scaffolding', () => {
  const testDir = resolve('test-scaffold-mod');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  try {
    const output = execSync(`node "${cliPath}" init test-scaffold-mod`, { encoding: 'utf-8' });
    assert.match(output, /Successfully initialized/);
    assert.equal(existsSync(resolve(testDir, 'package.json')), true);
    assert.equal(existsSync(resolve(testDir, 'src/index.ts')), true);
  } finally {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }
});

test('LynxFita CLI - init weather-mvi template scaffolding', () => {
  const testDir = resolve('test-weather-app');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  try {
    const output = execSync(`node "${cliPath}" init test-weather-app --template weather-mvi`, { encoding: 'utf-8' });
    assert.match(output, /Successfully initialized \(weather-mvi\)/);
    assert.equal(existsSync(resolve(testDir, 'package.json')), true);
    assert.equal(existsSync(resolve(testDir, 'src/index.ts')), true);
  } finally {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }
});

test('LynxFita CLI - codegen command generates C++ header and TS binding', () => {
  const specDir = resolve('test-spec-gen');
  if (existsSync(specDir)) {
    rmSync(specDir, { recursive: true, force: true });
  }

  try {
    mkdirSync(specDir, { recursive: true });
    const specPath = resolve(specDir, 'NativeSensorSpec.ts');
    writeFileSync(specPath, `
      export interface NativeSensorSpec {
        getTemperature(sensorId: string): number;
        captureTelemetry(): Promise<Uint8Array>;
      }
    `);

    const outDir = resolve(specDir, 'out');
    const output = execSync(`node "${cliPath}" codegen "${specPath}" --out "${outDir}"`, { encoding: 'utf-8' });
    assert.match(output, /Codegen completed for 'Sensor'/);
    assert.equal(existsSync(resolve(outDir, 'native_sensor_spec.h')), true);
    assert.equal(existsSync(resolve(outDir, 'sensor_binding.ts')), true);
  } finally {
    if (existsSync(specDir)) {
      rmSync(specDir, { recursive: true, force: true });
    }
  }
});

