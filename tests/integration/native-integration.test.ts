/**
 * LynxFita Native & Cordis Subsystem Integration Tests
 * Verifies end-to-end interoperability across Cordis, DMA, Protobuf, WIT codegen, WASI, and Ed25519 Federation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LynxFitaContext,
  DmaService,
  ProtobufService,
  CompilerService,
  FfiService,
  GpuService
} from '@lynxfita/core';
import { parseWitSpec, JsiCodeGenerator } from '@lynxfita/codegen';
import { WasiComponentService } from '@lynxfita/wasi-runtime';
import { FederationService, generateReleaseKeyPair, signPayload } from '@lynxfita/updater';

test('End-to-End Cordis Spine: Codegen -> DMA -> Protobuf -> WASI -> Federation', async () => {
  // 1. Initialize root LynxFitaContext
  const ctx = new LynxFitaContext();
  const dma = new DmaService(ctx);
  const proto = new ProtobufService(ctx);
  const compiler = new CompilerService(ctx);
  const ffi = new FfiService(ctx);
  const gpu = new GpuService(ctx);
  const wasi = new WasiComponentService(ctx);
  const fed = new FederationService(ctx);

  assert.ok(ctx.hasService('dma'));
  assert.ok(ctx.hasService('protobuf'));
  assert.ok(ctx.hasService('wasi'));
  assert.ok(ctx.hasService('federation'));

  // 2. Parse WIT Specification and verify DMA layout
  const witSource = `
interface weather-telemetry {
  get-telemetry: func() -> list<u8>;
}
`;
  const codegen = new JsiCodeGenerator();
  const spec = codegen.parseWit(witSource);
  assert.equal(spec.name, 'WeatherTelemetry');
  const dmaLayoutCode = codegen.generateDmaLayout(spec, 0x1000);
  assert.ok(dmaLayoutCode.includes('BASE_OFFSET: 0x1000'));

  // 3. Stationary DMA pack and Protobuf serialization
  dma.packSimd4f(0x2000, 24.5, 65.0, 1012.0, 15.5);
  const [temp, hum, press, wind] = dma.unpackSimd4f(0x2000);
  assert.equal(temp, 24.5);

  const payload = JSON.stringify({ temp, hum, press, wind });
  const wireBytes = proto.encodeMethodCall('WeatherModule', 'syncTelemetry', payload);
  const decoded = proto.decodeMethodCall(wireBytes);
  assert.equal(decoded.moduleName, 'WeatherModule');
  assert.equal(decoded.methodName, 'syncTelemetry');
  assert.deepEqual(JSON.parse(decoded.payload), { temp: 24.5, hum: 65, press: 1012, wind: 15.5 });

  // 4. WASI host context execution bound to DMA
  wasi.registerExport('computeWindChill', (t: number, v: number) => {
    return 13.12 + 0.6215 * t - 11.37 * Math.pow(v, 0.16) + 0.3965 * t * Math.pow(v, 0.16);
  });
  const windChill = wasi.execute('computeWindChill', temp, wind);
  assert.ok(windChill > 0);

  // 5. Ed25519 & SHA-256 Module Federation
  const keyPair = generateReleaseKeyPair();
  const remoteBundle = {
    version: '2.1.0-stable',
    name: 'weather-showcase-stable',
    sourceCode: 'export const version = "2.1.0-stable"; export default { city: "Sao Paulo", temp: 24.5 };',
  };
  const validSig = signPayload(remoteBundle.sourceCode, keyPair.privateKeyPem);
  const reconcileRes = await fed.reconcile(remoteBundle, validSig, keyPair.publicKeyPem);
  assert.equal(reconcileRes.activeVersion, '2.1.0-stable');
  assert.equal(reconcileRes.source, 'remote-federated');

  // Verify signature mismatch deterministic rollback
  const invalidSig = 'deadbeef'.repeat(16);
  const fallbackRes = await fed.reconcile(remoteBundle, invalidSig, keyPair.publicKeyPem);
  assert.equal(fallbackRes.activeVersion, '1.0.0-embedded');
  assert.equal(fallbackRes.isFallback, true);
  assert.equal(fed.getActiveVersion(), '1.0.0-embedded');
});
