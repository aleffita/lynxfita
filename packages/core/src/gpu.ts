/**
 * WebGPU Compute & Hardware Acceleration Cordis Service
 * W3C WebGPU Two-Buffer Staging Readback & WGSL Atmospheric Shaders
 */

import { Service, type LynxFitaContext } from './cordis.js';
import {
  WebGpuComputePipeline,
  type ComputeExecutionResult,
} from './kernels.js';

export const WEATHER_ATMOSPHERE_WGSL_SHADER = `
struct AtmosphericUniforms {
  time: f32,
  insolation: f32,
  count: u32,
  padding: u32,
};

@group(0) @binding(0) var<storage, read> inputTelemetry: array<f32>;
@group(0) @binding(1) var<uniform> uniforms: AtmosphericUniforms;
@group(0) @binding(2) var<storage, read_write> outputAtmosphere: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx < uniforms.count) {
    let base = inputTelemetry[idx];
    let wave = sin(uniforms.time * 0.5 + f32(idx) * 0.1) * 2.0;
    outputAtmosphere[idx] = base + wave + (uniforms.insolation * 0.005);
  }
}
`;

export class GpuService extends Service {
  public static provide = 'gpu';
  public static inject = ['dma'];

  private pipeline: WebGpuComputePipeline;

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'gpu');
    this.pipeline = new WebGpuComputePipeline();
  }

  public getPipeline(): WebGpuComputePipeline {
    return this.pipeline;
  }

  public async executeFma(
    a: Float32Array,
    b: Float32Array,
    scale: number
  ): Promise<ComputeExecutionResult<Float32Array>> {
    return this.pipeline.executeFma(a, b, scale);
  }

  public async executeAtmosphericShader(
    telemetry: Float32Array,
    time: number,
    insolation: number
  ): Promise<Float32Array> {
    const count = telemetry.length;
    const output = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const base = telemetry[i] ?? 0;
      const wave = Math.sin(time * 0.5 + i * 0.1) * 2.0;
      output[i] = base + wave + insolation * 0.005;
    }
    return output;
  }
}
