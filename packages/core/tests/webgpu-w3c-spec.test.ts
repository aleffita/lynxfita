/**
 * WebGPU W3C Spec & Atmospheric WGSL Shader Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LynxFitaContext,
  DmaService,
  GpuService,
  WEATHER_ATMOSPHERE_WGSL_SHADER
} from '../dist/index.js';

test('GpuService atmospheric compute shader simulation', async () => {
  const ctx = new LynxFitaContext();
  new DmaService(ctx);
  const gpuSvc = new GpuService(ctx);

  assert.ok(WEATHER_ATMOSPHERE_WGSL_SHADER.includes('@compute'));
  assert.ok(WEATHER_ATMOSPHERE_WGSL_SHADER.includes('AtmosphericUniforms'));

  const inputTelemetry = new Float32Array([20.0, 22.0, 25.0, 19.0]);
  const result = await gpuSvc.executeAtmosphericShader(inputTelemetry, 1.0, 500.0);

  assert.equal(result.length, 4);
  assert.ok(result[0] !== undefined && result[0] > 0);
  assert.ok(result[1] !== undefined && result[1] > 0);
});

test('GpuService coeffects inject dma requirement', () => {
  assert.deepEqual(GpuService.inject, ['dma']);
});
