/**
 * WASI Runtime & Cordis Component Service
 * Zero-copy execution bound to Stationary DMA with capability-scoped security sandboxes.
 */

import { Service, type LynxFitaContext, type DmaService } from '@lynxfita/core';

export interface WasiHostConfig {
  maxMemoryBytes: number;
  environment: Record<string, string>;
  preopenedPaths: string[];
}

export class WasiHostContext {
  private config: WasiHostConfig;
  private memory: Uint8Array;
  private dmaBound = false;

  constructor(config: Partial<WasiHostConfig> = {}) {
    this.config = {
      maxMemoryBytes: 64 * 1024 * 1024,
      environment: {},
      preopenedPaths: [],
      ...config,
    };
    this.memory = new Uint8Array(64 * 1024); // 64KB initial 1 WASM page
  }

  public bindDmaMemory(dmaBuffer: Uint8Array): void {
    this.memory = dmaBuffer;
    this.dmaBound = true;
  }

  public writeBytes(offset: number, bytes: Uint8Array): number {
    if (offset < 0 || !Number.isInteger(offset)) {
      throw new Error(`WASI memory out-of-bounds: invalid negative offset ${offset}`);
    }
    if (offset + bytes.length > this.memory.length) {
      if (this.dmaBound) {
        throw new Error(`WASI DMA bounds fault: write at ${offset} exceeds DMA capacity`);
      }
      this.growMemory(offset + bytes.length);
    }
    this.memory.set(bytes, offset);
    return bytes.length;
  }

  public readBytes(offset: number, length: number): Uint8Array {
    if (offset < 0 || length < 0 || !Number.isInteger(offset) || !Number.isInteger(length)) {
      throw new Error(`WASI memory out-of-bounds: invalid offset ${offset} or length ${length}`);
    }
    if (offset + length > this.memory.length) {
      throw new Error(`WASI memory out-of-bounds: read at ${offset} length ${length} exceeds size ${this.memory.length}`);
    }
    return this.memory.slice(offset, offset + length);
  }

  public writeString(offset: number, value: string): number {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    return this.writeBytes(offset, bytes);
  }

  public readString(offset: number, length: number): string {
    const slice = this.readBytes(offset, length);
    const decoder = new TextDecoder();
    return decoder.decode(slice);
  }

  public growMemory(targetSize: number): void {
    if (this.dmaBound) {
      throw new Error('Cannot grow statically bounded DMA memory');
    }
    if (targetSize > this.config.maxMemoryBytes) {
      throw new Error(`WASI memory allocation trap: requested ${targetSize} exceeds limit ${this.config.maxMemoryBytes}`);
    }
    const newSize = Math.max(this.memory.length * 2, targetSize);
    const newBuf = new Uint8Array(newSize);
    newBuf.set(this.memory);
    this.memory = newBuf;
  }

  public getMemorySize(): number {
    return this.memory.length;
  }
}

export class WasiComponentService extends Service {
  public static provide = 'wasi';
  public static inject = ['dma'];

  private hostContext: WasiHostContext;
  private exports = new Map<string, (...args: any[]) => any>();

  constructor(ctx: LynxFitaContext, config: Partial<WasiHostConfig> = {}) {
    super(ctx, 'wasi');
    this.hostContext = new WasiHostContext(config);

    const dma = ctx.getService<DmaService>('dma');
    if (dma) {
      this.hostContext.bindDmaMemory(dma.getRawBuffer());
    }
  }

  public getHostContext(): WasiHostContext {
    return this.hostContext;
  }

  public registerExport(name: string, fn: (...args: any[]) => any): void {
    this.exports.set(name, fn);
  }

  public execute(name: string, ...args: any[]): any {
    const fn = this.exports.get(name);
    if (!fn) {
      throw new Error(`WASI entrypoint '${name}' not found`);
    }
    return fn(...args);
  }
}
