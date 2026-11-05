/**
 * Lightweight Header-Only Protocol Buffer Wire Protocol Encoder & Decoder & Cordis Service
 */

import { Service, type LynxFitaContext } from './cordis.js';

export enum WireType {
  Varint = 0,
  Fixed64 = 1,
  LengthDelimited = 2,
  Fixed32 = 5
}

export class ProtobufWire {
  public static encodeVarint(value: number): Uint8Array {
    const bytes: number[] = [];
    let v = value;
    while (v >= 0x80) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v & 0x7f);
    return new Uint8Array(bytes);
  }

  public static decodeVarint(buffer: Uint8Array, offset = 0): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let index = offset;

    while (index < buffer.length) {
      const byte = buffer[index++];
      if (byte === undefined) break;
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return { value: result, bytesRead: index - offset };
      }
      shift += 7;
    }
    throw new Error('Malformed varint in protobuf stream');
  }

  public static encodeMethodCall(moduleName: string, methodName: string, payload: string): Uint8Array {
    const enc = new TextEncoder();
    const modBytes = enc.encode(moduleName);
    const methBytes = enc.encode(methodName);
    const payloadBytes = enc.encode(payload);

    const parts: Uint8Array[] = [];

    // Field 1: module (tag: (1 << 3) | 2 = 10)
    parts.push(this.encodeVarint((1 << 3) | WireType.LengthDelimited));
    parts.push(this.encodeVarint(modBytes.length));
    parts.push(modBytes);

    // Field 2: method (tag: (2 << 3) | 2 = 18)
    parts.push(this.encodeVarint((2 << 3) | WireType.LengthDelimited));
    parts.push(this.encodeVarint(methBytes.length));
    parts.push(methBytes);

    // Field 3: payload (tag: (3 << 3) | 2 = 26)
    parts.push(this.encodeVarint((3 << 3) | WireType.LengthDelimited));
    parts.push(this.encodeVarint(payloadBytes.length));
    parts.push(payloadBytes);

    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const p of parts) {
      result.set(p, cur);
      cur += p.length;
    }
    return result;
  }

  public static decodeMethodCall(buffer: Uint8Array): { moduleName: string; methodName: string; payload: string } {
    const dec = new TextDecoder();
    let offset = 0;
    let moduleName = '';
    let methodName = '';
    let payload = '';

    while (offset < buffer.length) {
      const tagInfo = this.decodeVarint(buffer, offset);
      offset += tagInfo.bytesRead;

      const fieldNumber = tagInfo.value >>> 3;
      const wireType = tagInfo.value & 0x07;

      if (wireType === WireType.LengthDelimited) {
        const lenInfo = this.decodeVarint(buffer, offset);
        offset += lenInfo.bytesRead;
        const fieldBytes = buffer.subarray(offset, offset + lenInfo.value);
        offset += lenInfo.value;

        const str = dec.decode(fieldBytes);
        if (fieldNumber === 1) moduleName = str;
        else if (fieldNumber === 2) methodName = str;
        else if (fieldNumber === 3) payload = str;
      } else {
        throw new Error(`Unsupported wire type: ${wireType}`);
      }
    }

    return { moduleName, methodName, payload };
  }
}

export class ProtobufService extends Service {
  public static provide = 'protobuf';
  public static inject = [];

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'protobuf');
  }

  public encodeVarint(val: number): Uint8Array {
    return ProtobufWire.encodeVarint(val);
  }

  public decodeVarint(buffer: Uint8Array, offset = 0) {
    return ProtobufWire.decodeVarint(buffer, offset);
  }

  public encodeMethodCall(mod: string, method: string, payload: string): Uint8Array {
    return ProtobufWire.encodeMethodCall(mod, method, payload);
  }

  public decodeMethodCall(buffer: Uint8Array) {
    return ProtobufWire.decodeMethodCall(buffer);
  }
}
