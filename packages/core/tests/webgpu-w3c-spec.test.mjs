import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WebGpuComputePipeline,
  GPUBufferUsageFlags,
  TENSOR_FMA_WGSL_SHADER,
  WEATHER_PARTICLES_WGSL_SHADER
} from '../dist/index.js';

/**
 * Spec-compliant WebGPU W3C Mock Implementation for Test & Verification.
 * Enforces:
 * 1. MAP_READ can only be paired with COPY_DST (rejects STORAGE | MAP_READ).
 * 2. writeBuffer strictly requires COPY_DST on destination buffer.
 * 3. copyBufferToBuffer requires COPY_SRC on source and COPY_DST on destination.
 * 4. Staging readback protocol: copyBufferToBuffer -> submit -> mapAsync -> getMappedRange -> unmap.
 */
function createW3cWebGpuMock() {
  const recordedSteps = [];

  class MockGPUBuffer {
    constructor(descriptor) {
      this.size = descriptor.size;
      this.usage = descriptor.usage;
      this.data = new Uint8Array(descriptor.size);
      this.isMapped = false;
      this.isDestroyed = false;

      // W3C Spec Rule: MAP_READ can only be combined with COPY_DST
      if (this.usage & GPUBufferUsageFlags.MAP_READ) {
        const allowedMask = GPUBufferUsageFlags.MAP_READ | GPUBufferUsageFlags.COPY_DST;
        if ((this.usage & ~allowedMask) !== 0) {
          throw new Error(
            `GPUValidationError: MAP_READ (0x0001) cannot be combined with usage 0x${this.usage.toString(16)} (violates W3C WebGPU specification)`
          );
        }
      }
    }

    async mapAsync(mode) {
      if (this.isDestroyed) throw new Error('GPUBuffer is destroyed');
      if (mode === GPUBufferUsageFlags.MAP_READ && !(this.usage & GPUBufferUsageFlags.MAP_READ)) {
        throw new Error('GPUValidationError: Buffer does not have MAP_READ usage flag');
      }
      this.isMapped = true;
      recordedSteps.push('mapAsync');
    }

    getMappedRange(offset = 0, size = this.size) {
      if (!this.isMapped) throw new Error('GPUBuffer is not mapped');
      recordedSteps.push('getMappedRange');
      return this.data.buffer.slice(
        this.data.byteOffset + offset,
        this.data.byteOffset + offset + size
      );
    }

    unmap() {
      this.isMapped = false;
      recordedSteps.push('unmap');
    }

    destroy() {
      this.isDestroyed = true;
      recordedSteps.push('destroy');
    }
  }

  const pendingBufferCopies = [];
  let boundPipeline = null;
  let boundEntries = [];

  const mockDevice = {
    createShaderModule({ code }) {
      return { code };
    },
    createComputePipeline({ compute }) {
      return {
        layout: 'auto',
        compute,
        getBindGroupLayout(idx) {
          return { index: idx };
        }
      };
    },
    createBuffer(desc) {
      return new MockGPUBuffer(desc);
    },
    createBindGroup({ entries }) {
      return { entries };
    },
    queue: {
      writeBuffer(buffer, bufferOffset, data, dataOffset = 0, size) {
        if (!(buffer.usage & GPUBufferUsageFlags.COPY_DST)) {
          throw new Error(
            `GPUValidationError: queue.writeBuffer called on buffer without COPY_DST (usage: 0x${buffer.usage.toString(16)})`
          );
        }
        const srcArray = data instanceof ArrayBuffer
          ? new Uint8Array(data, dataOffset, size ?? data.byteLength)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset + dataOffset, size ?? data.byteLength)
            : new Uint8Array(data);

        buffer.data.set(srcArray, bufferOffset);
        recordedSteps.push('writeBuffer');
      },
      submit(commandBuffers) {
        recordedSteps.push('submit');
        for (const cmd of commandBuffers) {
          if (cmd.copies) {
            for (const copy of cmd.copies) {
              copy.dst.data.set(copy.src.data.subarray(copy.srcOffset, copy.srcOffset + copy.size), copy.dstOffset);
            }
          }
        }
      }
    },
    createCommandEncoder() {
      const copies = [];
      return {
        beginComputePass() {
          return {
            setPipeline(p) {
              boundPipeline = p;
              recordedSteps.push('setPipeline');
            },
            setBindGroup(index, bg) {
              boundEntries = bg.entries;
              recordedSteps.push('setBindGroup');
            },
            dispatchWorkgroups(workgroupsX) {
              recordedSteps.push('dispatchWorkgroups');
              // Simulate shader computation based on shader code
              if (boundPipeline.compute.module.code === TENSOR_FMA_WGSL_SHADER) {
                // FMA: entry 0: bufA, 1: bufB, 2: bufParams, 3: bufDst
                const bufA = boundEntries[0].resource.buffer;
                const bufB = boundEntries[1].resource.buffer;
                const bufParams = boundEntries[2].resource.buffer;
                const bufDst = boundEntries[3].resource.buffer;

                const paramsView = new DataView(bufParams.data.buffer, bufParams.data.byteOffset);
                const scale = paramsView.getFloat32(0, true);
                const count = paramsView.getUint32(4, true);

                const viewA = new Float32Array(bufA.data.buffer, bufA.data.byteOffset, count);
                const viewB = new Float32Array(bufB.data.buffer, bufB.data.byteOffset, count);
                const viewDst = new Float32Array(bufDst.data.buffer, bufDst.data.byteOffset, count);

                for (let i = 0; i < count; i++) {
                  viewDst[i] = viewA[i] + viewB[i] * scale;
                }
              } else if (boundPipeline.compute.module.code === WEATHER_PARTICLES_WGSL_SHADER) {
                // Weather particles
                const uniformBuf = boundEntries[0].resource.buffer;
                const bufIn = boundEntries[1].resource.buffer;
                const bufOut = boundEntries[2].resource.buffer;

                const uv = new DataView(uniformBuf.data.buffer, uniformBuf.data.byteOffset);
                const temp = uv.getFloat32(0, true);
                const humidity = uv.getFloat32(4, true);
                const pressure = uv.getFloat32(8, true);
                const windSpeed = uv.getFloat32(12, true);
                const particleCount = uv.getUint32(16, true);
                const deltaTime = uv.getFloat32(20, true);

                const inF32 = new Float32Array(bufIn.data.buffer, bufIn.data.byteOffset, particleCount * 8);
                const outF32 = new Float32Array(bufOut.data.buffer, bufOut.data.byteOffset, particleCount * 8);

                const buoyancy = (temp - 20.0) * 0.05;
                const damping = Math.min(Math.max(1.0 - (pressure - 1000.0) * 0.001, 0.85), 0.99);
                const horizontalAdvection = windSpeed * 0.2;

                for (let i = 0; i < particleCount; i++) {
                  const off = i * 8;
                  let px = inF32[off];
                  let py = inF32[off + 1];
                  let vx = inF32[off + 4];
                  let vy = inF32[off + 5];

                  const turb = Math.sin(px * 0.1 + humidity * 0.05) * (humidity * 0.01);
                  vx = (vx + horizontalAdvection * 0.1) * damping;
                  vy = (vy + buoyancy + turb) * damping;
                  px += vx * deltaTime;
                  py += vy * deltaTime;

                  outF32[off] = px;
                  outF32[off + 1] = py;
                  outF32[off + 2] = humidity;
                  outF32[off + 3] = temp;
                  outF32[off + 4] = vx;
                  outF32[off + 5] = vy;
                  outF32[off + 6] = inF32[off + 6];
                  outF32[off + 7] = inF32[off + 7];
                }
              }
            },
            end() {
              recordedSteps.push('endPass');
            }
          };
        },
        copyBufferToBuffer(src, srcOffset, dst, dstOffset, size) {
          if (!(src.usage & GPUBufferUsageFlags.COPY_SRC)) {
            throw new Error('GPUValidationError: Source buffer requires COPY_SRC');
          }
          if (!(dst.usage & GPUBufferUsageFlags.COPY_DST)) {
            throw new Error('GPUValidationError: Destination buffer requires COPY_DST');
          }
          recordedSteps.push('copyBufferToBuffer');
          copies.push({ src, srcOffset, dst, dstOffset, size });
        },
        finish() {
          recordedSteps.push('encoderFinish');
          return { copies };
        }
      };
    }
  };

  const mockAdapter = {
    requestDevice: async () => mockDevice
  };

  const mockGpu = {
    requestAdapter: async () => mockAdapter
  };

  return {
    mockGpu,
    mockDevice,
    recordedSteps,
    MockGPUBuffer
  };
}

test('W3C WebGPU Spec Validator - Rejects illegal buffer combinations', () => {
  const { MockGPUBuffer } = createW3cWebGpuMock();

  // Illegal: STORAGE | MAP_READ (DEF-02 defect condition)
  assert.throws(() => {
    new MockGPUBuffer({ size: 64, usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.MAP_READ });
  }, /GPUValidationError.*MAP_READ.*cannot be combined/);

  // Illegal: UNIFORM | MAP_READ
  assert.throws(() => {
    new MockGPUBuffer({ size: 64, usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.MAP_READ });
  }, /GPUValidationError.*MAP_READ.*cannot be combined/);

  // Legal: COPY_DST | MAP_READ (Staging buffer)
  const stagingBuf = new MockGPUBuffer({
    size: 64,
    usage: GPUBufferUsageFlags.COPY_DST | GPUBufferUsageFlags.MAP_READ
  });
  assert.equal(stagingBuf.usage, 0x0009);

  // Legal: STORAGE | COPY_DST (Input buffer)
  const inBuf = new MockGPUBuffer({
    size: 64,
    usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST
  });
  assert.equal(inBuf.usage, 0x0088);

  // Legal: STORAGE | COPY_SRC (Output buffer)
  const outBuf = new MockGPUBuffer({
    size: 64,
    usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_SRC
  });
  assert.equal(outBuf.usage, 0x0084);
});

test('W3C WebGPU Spec Validator - writeBuffer strictly enforces COPY_DST flag', () => {
  const { mockDevice, MockGPUBuffer } = createW3cWebGpuMock();

  // Buffer without COPY_DST (e.g. STORAGE | COPY_SRC only)
  const noCopyDstBuf = new MockGPUBuffer({
    size: 64,
    usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_SRC
  });

  assert.throws(() => {
    mockDevice.queue.writeBuffer(noCopyDstBuf, 0, new Float32Array([1, 2, 3]));
  }, /GPUValidationError: queue\.writeBuffer called on buffer without COPY_DST/);

  // Buffer with COPY_DST
  const validDstBuf = new MockGPUBuffer({
    size: 64,
    usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_DST
  });
  assert.doesNotThrow(() => {
    mockDevice.queue.writeBuffer(validDstBuf, 0, new Float32Array([1, 2, 3]));
  });
});

test('WebGpuComputePipeline - executeFma strictly complies with W3C WebGPU staging protocol', async () => {
  const { mockGpu, recordedSteps } = createW3cWebGpuMock();

  const origGpuDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu');
  Object.defineProperty(globalThis.navigator, 'gpu', {
    value: mockGpu,
    configurable: true,
    writable: true
  });

  try {
    const pipeline = new WebGpuComputePipeline();
    assert.equal(pipeline.hasHardwareWebGpu(), true);

    const a = new Float32Array([10, 20, 30, 40]);
    const b = new Float32Array([1, 2, 3, 4]);
    const scale = 2.5;

    const result = await pipeline.executeFma(a, b, scale);

    // Verify backend is real WebGPU
    assert.equal(result.backend, 'webgpu-hardware');
    assert.equal(result.elementsProcessed, 4);

    // Verify mathematical result computed by simulated WebGPU kernel:
    // 10 + 1*2.5 = 12.5, 20 + 2*2.5 = 25.0, 30 + 3*2.5 = 37.5, 40 + 4*2.5 = 50.0
    assert.equal(result.data[0], 12.5);
    assert.equal(result.data[1], 25.0);
    assert.equal(result.data[2], 37.5);
    assert.equal(result.data[3], 50.0);

    // Verify strict W3C protocol execution sequence:
    // 3 writeBuffers (a, b, params) -> pass -> copyBufferToBuffer -> submit -> mapAsync -> getMappedRange -> unmap
    assert.ok(recordedSteps.includes('writeBuffer'));
    assert.ok(recordedSteps.includes('dispatchWorkgroups'));
    assert.ok(recordedSteps.includes('copyBufferToBuffer'));
    assert.ok(recordedSteps.includes('submit'));
    assert.ok(recordedSteps.includes('mapAsync'));
    assert.ok(recordedSteps.includes('getMappedRange'));
    assert.ok(recordedSteps.includes('unmap'));

    const copyIdx = recordedSteps.indexOf('copyBufferToBuffer');
    const submitIdx = recordedSteps.indexOf('submit');
    const mapIdx = recordedSteps.indexOf('mapAsync');
    const getMappedIdx = recordedSteps.indexOf('getMappedRange');
    const unmapIdx = recordedSteps.indexOf('unmap');

    assert.ok(copyIdx < submitIdx, 'copyBufferToBuffer must happen before queue.submit');
    assert.ok(submitIdx < mapIdx, 'submit must happen before mapAsync');
    assert.ok(mapIdx < getMappedIdx, 'mapAsync must resolve before getMappedRange');
    assert.ok(getMappedIdx < unmapIdx, 'getMappedRange must precede unmap');
  } finally {
    if (origGpuDesc) {
      Object.defineProperty(globalThis.navigator, 'gpu', origGpuDesc);
    } else {
      delete globalThis.navigator.gpu;
    }
  }
});

test('WebGpuComputePipeline - executeWeatherParticles strictly complies with W3C WebGPU staging protocol', async () => {
  const { mockGpu, recordedSteps } = createW3cWebGpuMock();

  const origGpuDesc = Object.getOwnPropertyDescriptor(globalThis.navigator, 'gpu');
  Object.defineProperty(globalThis.navigator, 'gpu', {
    value: mockGpu,
    configurable: true,
    writable: true
  });

  try {
    const pipeline = new WebGpuComputePipeline();
    const particles = new Float32Array(16); // 2 particles
    particles[0] = 5.0;  particles[1] = 10.0; // pos.x, pos.y
    particles[4] = 0.5;  particles[5] = 1.0;  // vel.x, vel.y
    particles[8] = 15.0; particles[9] = 20.0;
    particles[12] = 0.2; particles[13] = 0.8;

    const weatherTelemetry = [25.0, 60.0, 1013.25, 10.0]; // temp, humidity, pressure, windSpeed

    const result = await pipeline.executeWeatherParticles(particles, weatherTelemetry, 0.05);

    assert.equal(result.backend, 'webgpu-hardware');
    assert.equal(result.elementsProcessed, 2);

    // pos.z stores humidity (60.0), pos.w stores temp (25.0)
    assert.equal(result.data[2], 60.0);
    assert.equal(result.data[3], 25.0);
    assert.equal(result.data[10], 60.0);
    assert.equal(result.data[11], 25.0);

    // Verify W3C staging protocol sequence
    assert.ok(recordedSteps.includes('copyBufferToBuffer'));
    assert.ok(recordedSteps.includes('mapAsync'));
    assert.ok(recordedSteps.includes('getMappedRange'));
    assert.ok(recordedSteps.includes('unmap'));
  } finally {
    if (origGpuDesc) {
      Object.defineProperty(globalThis.navigator, 'gpu', origGpuDesc);
    } else {
      delete globalThis.navigator.gpu;
    }
  }
});
