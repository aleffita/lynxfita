import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PluginLedger,
  PluginState,
  StationaryDmaClient,
  ProtobufWire,
  WebGpuComputePipeline,
  TENSOR_FMA_WGSL_SHADER,
  WEATHER_PARTICLES_WGSL_SHADER
} from '@lynxfita/core';

test('Integration - Native Standalone C++20 Executables', () => {
  const isWindows = process.platform === 'win32';
  const nativeTestsBin = resolve(isWindows ? 'build/native/lynxfita_native_tests.exe' : 'build/native/lynxfita_native_tests');
  const explorerBin = resolve(isWindows ? 'build/native/lynxfita_explorer.exe' : 'build/native/lynxfita_explorer');

  if (existsSync(nativeTestsBin)) {
    const testOutput = execSync(`"${nativeTestsBin}"`, { encoding: 'utf-8' });
    assert.match(testOutput, /ALL NATIVE TESTS PASSED SUCCESSFULLY/);
  }

  if (existsSync(explorerBin)) {
    const versionOutput = execSync(`"${explorerBin}" --version`, { encoding: 'utf-8' });
    assert.match(versionOutput, /lynxfita_explorer v2\.0\.0/);

    const demoOutput = execSync(`"${explorerBin}" --demo`, { encoding: 'utf-8' });
    assert.match(demoOutput, /ALL SUBSYSTEMS VERIFIED & OPERATIONAL/);
    assert.match(demoOutput, /Synchronizing Weather Showcase SIMD Telemetry into DMA offset 0x2000/);
    assert.match(demoOutput, /Executing C\+\+20 SIMD Vector FMA Compute Kernel/);
    assert.match(demoOutput, /Initializing Sandboxed WASI Host Module/);
    assert.match(demoOutput, /Initializing Hermes Runtime AOT Compiler/);

    const helpOutput = execSync(`"${explorerBin}" --help`, { encoding: 'utf-8' });
    assert.match(helpOutput, /Usage:/);
    assert.match(helpOutput, /--run <file\.hbc>/);

    // Test --run with an actual bytecode bundle if available
    const bundlePath = resolve('packages/cli/dist/cli.hbc');
    if (existsSync(bundlePath)) {
      const runOutput = execSync(`"${explorerBin}" --run "${bundlePath}"`, { encoding: 'utf-8' });
      assert.match(runOutput, /Loading Hermes bytecode bundle/);
      assert.match(runOutput, /Hermes Bytecode Loaded/);
    }

    // Negative path 1: --run missing argument
    assert.throws(() => {
      execSync(`"${explorerBin}" --run`, { encoding: 'utf-8', stdio: 'pipe' });
    });

    // Negative path 2: unknown flag
    assert.throws(() => {
      execSync(`"${explorerBin}" --unknown-flag-xyz`, { encoding: 'utf-8', stdio: 'pipe' });
    });
  }
});

test('Integration - CORDIS + DMA + Protobuf + WebGPU WGSL Cross-Module Pipeline', async () => {
  const dma = new StationaryDmaClient(512 * 1024);
  const ledger = new PluginLedger();
  const pipeline = new WebGpuComputePipeline(dma);

  ledger.setCoeffect('hardware.dma', true);
  ledger.setCoeffect('compute.wgsl', true);

  let kernelExecuted = false;

  const acceleratedPlugin = {
    meta: {
      id: 'weather-compute-accelerator',
      name: 'Weather Compute Accelerator',
      version: '2.0.0',
      dependencies: [],
      requiredCoeffects: ['hardware.dma', 'compute.wgsl']
    },
    activate: async (ctx) => {
      // 1. Pack initial weather vector into DMA offset 0x2000: [temp, humidity, pressure, windSpeed]
      dma.packSimd4f(0x2000, 26.5, 70.0, 1012.0, 14.0);

      // 2. Register reversible compute worker
      await ctx.registerEffect(
        'wgsl-particle-advection-effect',
        async () => {
          const particles = new Float32Array(16);
          particles[0] = 5.0;  particles[1] = 10.0; // pos
          particles[4] = 0.5;  particles[5] = 1.0;  // vel
          particles[8] = 15.0; particles[9] = 20.0;
          particles[12] = 0.2; particles[13] = 0.8;

          const telemetry = dma.unpackSimd4f(0x2000);
          const result = await pipeline.executeWeatherParticles(particles, telemetry, 0.05);
          assert.equal(result.elementsProcessed, 2);
          assert.ok(result.durationUs >= 0);
          kernelExecuted = true;
        },
        () => {
          kernelExecuted = false;
        }
      );
    }
  };

  ledger.registerPlugin(acceleratedPlugin);
  assert.equal(await ledger.activatePlugin('weather-compute-accelerator'), true);
  assert.equal(kernelExecuted, true);
  assert.equal(ledger.getLedgerStatus()[0].state, PluginState.Active);

  // Reversible rollback
  assert.equal(await ledger.deactivatePlugin('weather-compute-accelerator'), true);
  assert.equal(kernelExecuted, false);
});
