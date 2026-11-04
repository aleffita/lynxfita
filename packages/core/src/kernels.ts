/**
 * LynxFita WebGPU & Hardware Compute Worklets
 * Accelerated WebGPU / WGSL Compute Shaders with Stationary DMA / C++20 SIMD Fallback.
 */

import { StationaryDmaClient } from './dma.js';

export interface TensorDescriptor {
  data: Float32Array;
  shape: number[];
}

export type KernelComputeFn = (
  inputs: Record<string, TensorDescriptor>
) => Promise<Record<string, TensorDescriptor>> | Record<string, TensorDescriptor>;

export interface ComputeExecutionResult<T> {
  data: T;
  backend: 'webgpu-hardware' | 'dma-simd-native';
  durationUs: number;
  throughputGflops: number;
  elementsProcessed: number;
}

/**
 * Standard WGSL Compute Shader for Fused Multiply-Add Tensor Vector operations:
 * dst[i] = a[i] + b[i] * scale
 */
export const TENSOR_FMA_WGSL_SHADER = `
struct Uniforms {
  scale: f32,
  count: u32,
};

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<uniform> params: Uniforms;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx < params.count) {
    dst[idx] = a[idx] + b[idx] * params.scale;
  }
}
`;

/**
 * Standard WGSL Compute Shader for Weather Particle Atmospheric Advection
 * Driven by the 4-float telemetry vector [temp, humidity, pressure, windSpeed] from DMA lane.
 */
export const WEATHER_PARTICLES_WGSL_SHADER = `
struct WeatherTelemetry {
  temp: f32,
  humidity: f32,
  pressure: f32,
  windSpeed: f32,
  particleCount: u32,
  deltaTime: f32,
};

struct Particle {
  pos: vec4<f32>,
  vel: vec4<f32>,
};

@group(0) @binding(0) var<uniform> weather: WeatherTelemetry;
@group(0) @binding(1) var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particlesOut: array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= weather.particleCount) {
    return;
  }

  var p = particlesIn[idx];
  let buoyancy = (weather.temp - 20.0) * 0.05;
  let damping = clamp(1.0 - (weather.pressure - 1000.0) * 0.001, 0.85, 0.99);
  let horizontalAdvection = weather.windSpeed * 0.2;
  let turbulence = sin(p.pos.x * 0.1 + weather.humidity * 0.05) * (weather.humidity * 0.01);

  p.vel.x = (p.vel.x + horizontalAdvection * 0.1) * damping;
  p.vel.y = (p.vel.y + buoyancy + turbulence) * damping;
  p.pos.x = p.pos.x + p.vel.x * weather.deltaTime;
  p.pos.y = p.pos.y + p.vel.y * weather.deltaTime;
  p.pos.z = weather.humidity;
  p.pos.w = weather.temp;

  particlesOut[idx] = p;
}
`;

export function validateWgslShader(shaderCode: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!shaderCode || shaderCode.trim().length === 0) {
    return { valid: false, errors: ['Shader source code is empty'] };
  }

  if (!shaderCode.includes('@compute')) {
    errors.push('Missing @compute stage attribute');
  }

  if (!/@workgroup_size\(\s*\d+\s*(?:,\s*\d+\s*)?(?:,\s*\d+\s*)?\)/.test(shaderCode)) {
    errors.push('Missing or malformed @workgroup_size attribute');
  }

  if (!/@group\(\s*\d+\s*\)/.test(shaderCode)) {
    errors.push('Missing @group(0) attribute on resource binding');
  }

  if (!/@binding\(\s*\d+\s*\)/.test(shaderCode)) {
    errors.push('Missing @binding(...) attribute on resource binding');
  }

  if (!shaderCode.includes('fn main')) {
    errors.push('Missing entrypoint function: fn main');
  }

  // Check balanced curly braces
  let openBraces = 0;
  for (const char of shaderCode) {
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (openBraces < 0) {
      errors.push('Unmatched closing brace in shader syntax');
      break;
    }
  }
  if (openBraces > 0) {
    errors.push('Unclosed open brace in shader syntax');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export class WebGpuComputePipeline {
  private dmaClient: StationaryDmaClient;

  constructor(dmaClient?: StationaryDmaClient) {
    this.dmaClient = dmaClient || new StationaryDmaClient(512 * 1024);
  }

  public static validateShader(shaderCode: string): { valid: boolean; errors: string[] } {
    return validateWgslShader(shaderCode);
  }

  public hasHardwareWebGpu(): boolean {
    const nav = (globalThis as any).navigator;
    return typeof nav !== 'undefined' && typeof nav.gpu !== 'undefined';
  }

  /**
   * Execute Fused Multiply-Add (dst = a + b * scale)
   * Dispatches to WebGPU device if available, otherwise executes 4-way SIMD on Stationary DMA.
   */
  public async executeFma(
    a: Float32Array,
    b: Float32Array,
    scale: number
  ): Promise<ComputeExecutionResult<Float32Array>> {
    const start = performance.now();
    const count = Math.min(a.length, b.length);
    const dst = new Float32Array(count);

    if (this.hasHardwareWebGpu()) {
      try {
        const gpu = (globalThis as any).navigator.gpu;
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          if (device) {
            const shaderModule = device.createShaderModule({ code: TENSOR_FMA_WGSL_SHADER });
            const pipeline = device.createComputePipeline({
              layout: 'auto',
              compute: { module: shaderModule, entryPoint: 'main' }
            });
            const byteLen = count * 4;
            const bufA = device.createBuffer({ size: byteLen, usage: 0x0080 | 0x0004 });
            const bufB = device.createBuffer({ size: byteLen, usage: 0x0080 | 0x0004 });
            const bufParams = device.createBuffer({ size: 16, usage: 0x0040 | 0x0004 });
            const bufDst = device.createBuffer({ size: byteLen, usage: 0x0080 | 0x0001 });

            device.queue.writeBuffer(bufA, 0, a.buffer, a.byteOffset, byteLen);
            device.queue.writeBuffer(bufB, 0, b.buffer, b.byteOffset, byteLen);
            const paramsView = new DataView(new ArrayBuffer(16));
            paramsView.setFloat32(0, scale, true);
            paramsView.setUint32(4, count, true);
            device.queue.writeBuffer(bufParams, 0, paramsView.buffer);

            const bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: bufA } },
                { binding: 1, resource: { buffer: bufB } },
                { binding: 2, resource: { buffer: bufParams } },
                { binding: 3, resource: { buffer: bufDst } }
              ]
            });

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(Math.ceil(count / 64));
            passEncoder.end();
            device.queue.submit([commandEncoder.finish()]);

            const elapsedUs = (performance.now() - start) * 1000;
            const flops = count * 2;
            const gflops = (flops / (elapsedUs / 1000000)) / 1e9;
            return {
              data: dst,
              backend: 'webgpu-hardware',
              durationUs: Math.max(0.1, elapsedUs),
              throughputGflops: gflops,
              elementsProcessed: count
            };
          }
        }
      } catch {
        // Fall back to SIMD / DMA
      }
    }

    // 4-way SIMD Native / Stationary DMA Execution Fallback
    // Employs SIMD 4-float chunks over typed memory
    const simdChunkCount = Math.floor(count / 4);
    for (let chunk = 0; chunk < simdChunkCount; ++chunk) {
      const idx = chunk * 4;
      this.dmaClient.packSimd4f(0, a[idx]!, a[idx + 1]!, a[idx + 2]!, a[idx + 3]!);
      this.dmaClient.packSimd4f(16, b[idx]!, b[idx + 1]!, b[idx + 2]!, b[idx + 3]!);
      const aVec = this.dmaClient.unpackSimd4f(0);
      const bVec = this.dmaClient.unpackSimd4f(16);
      this.dmaClient.packSimd4f(
        32,
        aVec[0] + bVec[0] * scale,
        aVec[1] + bVec[1] * scale,
        aVec[2] + bVec[2] * scale,
        aVec[3] + bVec[3] * scale
      );
      const outVec = this.dmaClient.unpackSimd4f(32);
      dst[idx] = outVec[0];
      dst[idx + 1] = outVec[1];
      dst[idx + 2] = outVec[2];
      dst[idx + 3] = outVec[3];
    }
    // Trailing scalar elements
    for (let i = simdChunkCount * 4; i < count; ++i) {
      dst[i] = a[i]! + b[i]! * scale;
    }

    const elapsedUs = (performance.now() - start) * 1000;
    const flops = count * 2;
    const gflops = (flops / (Math.max(0.1, elapsedUs) / 1000000)) / 1e9;

    return {
      data: dst,
      backend: 'dma-simd-native',
      durationUs: Math.max(0.1, elapsedUs),
      throughputGflops: gflops,
      elementsProcessed: count
    };
  }

  /**
   * Execute Weather Particle Simulation
   * Governed by telemetry vector [temp, humidity, pressure, windSpeed] from DMA lane offset 0x2000.
   */
  public async executeWeatherParticles(
    particles: Float32Array,
    weatherParams: [number, number, number, number],
    deltaTime = 0.016
  ): Promise<ComputeExecutionResult<Float32Array>> {
    const start = performance.now();
    const particleCount = Math.floor(particles.length / 8); // 8 floats per particle: pos(4), vel(4)
    const out = new Float32Array(particles.length);

    // Stash telemetry in stationary DMA offset 0x2000 (8192 bytes)
    this.dmaClient.packSimd4f(0x2000, weatherParams[0], weatherParams[1], weatherParams[2], weatherParams[3]);
    const [temp, humidity, pressure, windSpeed] = this.dmaClient.unpackSimd4f(0x2000);

    if (this.hasHardwareWebGpu() && particleCount > 0) {
      try {
        const gpu = (globalThis as any).navigator.gpu;
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          if (device) {
            const shaderModule = device.createShaderModule({ code: WEATHER_PARTICLES_WGSL_SHADER });
            const pipeline = device.createComputePipeline({
              layout: 'auto',
              compute: { module: shaderModule, entryPoint: 'main' }
            });

            // 6-field WeatherTelemetry uniform struct: temp, humidity, pressure, windSpeed, particleCount, deltaTime
            const uniformBuffer = device.createBuffer({ size: 32, usage: 0x0040 | 0x0004 });
            const uniformData = new ArrayBuffer(32);
            const uniformView = new DataView(uniformData);
            uniformView.setFloat32(0, temp, true);
            uniformView.setFloat32(4, humidity, true);
            uniformView.setFloat32(8, pressure, true);
            uniformView.setFloat32(12, windSpeed, true);
            uniformView.setUint32(16, particleCount, true);
            uniformView.setFloat32(20, deltaTime, true);
            device.queue.writeBuffer(uniformBuffer, 0, uniformData);

            const byteLen = particles.byteLength;
            const bufIn = device.createBuffer({ size: byteLen, usage: 0x0080 | 0x0004 });
            const bufOut = device.createBuffer({ size: byteLen, usage: 0x0080 | 0x0001 });

            device.queue.writeBuffer(bufIn, 0, particles.buffer, particles.byteOffset, byteLen);

            const bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: { buffer: bufIn } },
                { binding: 2, resource: { buffer: bufOut } }
              ]
            });

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(Math.ceil(particleCount / 64));
            passEncoder.end();
            device.queue.submit([commandEncoder.finish()]);

            const elapsedUs = (performance.now() - start) * 1000;
            const ops = particleCount * 14;
            const gflops = (ops / (Math.max(0.1, elapsedUs) / 1000000)) / 1e9;

            return {
              data: out,
              backend: 'webgpu-hardware',
              durationUs: Math.max(0.1, elapsedUs),
              throughputGflops: gflops,
              elementsProcessed: particleCount
            };
          }
        }
      } catch {
        // Fall back to SIMD / DMA
      }
    }

    const buoyancy = (temp - 20.0) * 0.05;
    const damping = Math.min(Math.max(1.0 - (pressure - 1000.0) * 0.001, 0.85), 0.99);
    const horizontalAdvection = windSpeed * 0.2;

    for (let i = 0; i < particleCount; ++i) {
      const offset = i * 8;
      let posX = particles[offset] ?? 0;
      let posY = particles[offset + 1] ?? 0;
      let velX = particles[offset + 4] ?? 0;
      let velY = particles[offset + 5] ?? 0;

      const turbulence = Math.sin(posX * 0.1 + humidity * 0.05) * (humidity * 0.01);
      velX = (velX + horizontalAdvection * 0.1) * damping;
      velY = (velY + buoyancy + turbulence) * damping;

      posX += velX * deltaTime;
      posY += velY * deltaTime;

      out[offset] = posX;
      out[offset + 1] = posY;
      out[offset + 2] = humidity;
      out[offset + 3] = temp;
      out[offset + 4] = velX;
      out[offset + 5] = velY;
      out[offset + 6] = particles[offset + 6] ?? 0;
      out[offset + 7] = particles[offset + 7] ?? 0;
    }

    const elapsedUs = (performance.now() - start) * 1000;
    const ops = particleCount * 14;
    const gflops = (ops / (Math.max(0.1, elapsedUs) / 1000000)) / 1e9;

    return {
      data: out,
      backend: 'dma-simd-native',
      durationUs: Math.max(0.1, elapsedUs),
      throughputGflops: gflops,
      elementsProcessed: particleCount
    };
  }
}

export class KernelWorkletDispatcher {
  private registeredKernels = new Map<string, KernelComputeFn>();
  public readonly pipeline: WebGpuComputePipeline;

  constructor(pipeline?: WebGpuComputePipeline) {
    this.pipeline = pipeline || new WebGpuComputePipeline();
    this.registerStandardKernels();
  }

  public registerKernel(name: string, computeFn: KernelComputeFn): void {
    this.registeredKernels.set(name, computeFn);
  }

  public hasKernel(name: string): boolean {
    return this.registeredKernels.has(name);
  }

  public async executeKernel(
    name: string,
    inputs: Record<string, TensorDescriptor>
  ): Promise<Record<string, TensorDescriptor>> {
    const fn = this.registeredKernels.get(name);
    if (!fn) {
      throw new Error(`Kernel '${name}' is not registered`);
    }
    return await fn(inputs);
  }

  private registerStandardKernels(): void {
    // 1. Element-wise Add Kernel
    this.registerKernel('ai.onnx.Add', (inputs) => {
      const a = inputs['a'];
      const b = inputs['b'];
      if (!a || !b) throw new Error('Missing input tensor a or b for Add kernel');

      const len = Math.min(a.data.length, b.data.length);
      const out = new Float32Array(len);
      for (let i = 0; i < len; ++i) {
        const valA = a.data[i] ?? 0;
        const valB = b.data[i] ?? 0;
        out[i] = valA + valB;
      }
      return { c: { data: out, shape: a.shape } };
    });

    // 2. Vector Dot Product Kernel (SIMD reduction)
    this.registerKernel('ai.onnx.DotProduct', (inputs) => {
      const a = inputs['a'];
      const b = inputs['b'];
      if (!a || !b) throw new Error('Missing input tensor a or b for DotProduct kernel');

      let dot = 0;
      const len = Math.min(a.data.length, b.data.length);
      for (let i = 0; i < len; ++i) {
        const valA = a.data[i] ?? 0;
        const valB = b.data[i] ?? 0;
        dot += valA * valB;
      }
      return { output: { data: new Float32Array([dot]), shape: [1] } };
    });

    // 3. Fused Multiply-Add (FMA) Accelerated Kernel
    this.registerKernel('ai.lynxfita.FMA', async (inputs) => {
      const a = inputs['a'];
      const b = inputs['b'];
      const scaleTensor = inputs['scale'];
      if (!a || !b) throw new Error('Missing input tensor a or b for FMA kernel');

      const scale = scaleTensor ? (scaleTensor.data[0] ?? 1.0) : 1.0;
      const result = await this.pipeline.executeFma(a.data, b.data, scale);
      return {
        dst: {
          data: result.data,
          shape: a.shape
        }
      };
    });

    // 4. Weather Particles Simulation Kernel
    this.registerKernel('weather.AtmosphericAdvection', async (inputs) => {
      const particles = inputs['particles'];
      const telemetry = inputs['telemetry'];
      if (!particles || !telemetry) {
        throw new Error('Missing particles or telemetry tensor for AtmosphericAdvection kernel');
      }

      const weatherParams: [number, number, number, number] = [
        telemetry.data[0] ?? 20.0,
        telemetry.data[1] ?? 50.0,
        telemetry.data[2] ?? 1013.25,
        telemetry.data[3] ?? 5.0
      ];

      const result = await this.pipeline.executeWeatherParticles(particles.data, weatherParams);
      return {
        particlesOut: {
          data: result.data,
          shape: particles.shape
        }
      };
    });
  }
}
