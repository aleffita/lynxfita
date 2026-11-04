export interface WasiHostConfig {
  maxMemoryBytes: number;
  environment: Record<string, string>;
  preopenedPaths: string[];
}

export class WasiHostContext {
  private config: WasiHostConfig;
  private memory: Uint8Array;

  constructor(config: Partial<WasiHostConfig> = {}) {
    this.config = {
      maxMemoryBytes: 64 * 1024 * 1024,
      environment: {},
      preopenedPaths: [],
      ...config
    };
    this.memory = new Uint8Array(64 * 1024); // 64KB initial 1 WASM page
  }

  public writeBytes(offset: number, bytes: Uint8Array): number {
    if (offset < 0 || !Number.isInteger(offset)) {
      throw new Error(`WASI memory out-of-bounds: invalid negative offset ${offset}`);
    }
    if (offset + bytes.length > this.memory.length) {
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
