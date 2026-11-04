/**
 * Cell Broadband Engine (CBE) Element Interconnect Bus (EIB) DMA Client
 * Manages zero-copy stationary memory buffers and parallel DMA lane transfers.
 */

declare global {
  var __lynxfita_stationary_dma: any;
}

export interface DmaStats {
  capacity: number;
  totalTransfers: number;
  totalBytesTransferred: number;
}

export class StationaryDmaClient {
  private buffer: Uint8Array;
  private capacity: number;
  private transfersCount = 0;
  private bytesCount = 0;

  constructor(arenaSizeBytes = 1024 * 1024) {
    this.capacity = arenaSizeBytes;
    this.buffer = new Uint8Array(arenaSizeBytes);
  }

  public transfer(channelId: number, sourceOffset: number, destinationOffset: number, byteCount: number): string {
    if (typeof globalThis.__lynxfita_stationary_dma !== 'undefined') {
      return globalThis.__lynxfita_stationary_dma.transfer(channelId, sourceOffset, destinationOffset, byteCount);
    }

    // High-performance typed array in-memory DMA lane simulation
    if (sourceOffset + byteCount > this.capacity || destinationOffset + byteCount > this.capacity) {
      throw new Error('DMA bounds overflow: transfer exceeds stationary buffer capacity');
    }

    const chunk = this.buffer.subarray(sourceOffset, sourceOffset + byteCount);
    this.buffer.set(chunk, destinationOffset);
    this.transfersCount++;
    this.bytesCount += byteCount;

    return `DMA transfer complete: ${byteCount} bytes from ${sourceOffset} to ${destinationOffset}`;
  }

  public packSimd4f(offset: number, x: number, y: number, z: number, w: number): boolean {
    if (typeof globalThis.__lynxfita_stationary_dma !== 'undefined') {
      return globalThis.__lynxfita_stationary_dma.packSimd(offset, x, y, z, w);
    }

    if (offset + 16 > this.capacity) return false;
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + offset, 16);
    view.setFloat32(0, x, true);
    view.setFloat32(4, y, true);
    view.setFloat32(8, z, true);
    view.setFloat32(12, w, true);
    return true;
  }

  public unpackSimd4f(offset: number): [number, number, number, number] {
    if (offset + 16 > this.capacity) {
      throw new Error('Buffer overflow while reading SIMD vector');
    }
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + offset, 16);
    return [
      view.getFloat32(0, true),
      view.getFloat32(4, true),
      view.getFloat32(8, true),
      view.getFloat32(12, true)
    ];
  }

  public getStats(): DmaStats {
    if (typeof globalThis.__lynxfita_stationary_dma !== 'undefined') {
      return {
        capacity: Number(globalThis.__lynxfita_stationary_dma.capacity || 0),
        totalTransfers: Number(globalThis.__lynxfita_stationary_dma.totalTransfers || 0),
        totalBytesTransferred: Number(globalThis.__lynxfita_stationary_dma.totalBytesTransferred || 0)
      };
    }

    return {
      capacity: this.capacity,
      totalTransfers: this.transfersCount,
      totalBytesTransferred: this.bytesCount
    };
  }
}
