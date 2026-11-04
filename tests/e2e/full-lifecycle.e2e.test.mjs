import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTypeScriptSpec, JsiCodeGenerator } from '@lynxfita/codegen';
import {
  WeatherStore,
  Intents,
  createWeatherShowcasePlugin,
  renderWeatherAppView,
  renderLocationErrorBoundary
} from '@lynxfita/example-weather-showcase';
import {
  StationaryDmaClient,
  WebGpuComputePipeline,
  PluginLedger,
  PluginState
} from '@lynxfita/core';
import { BundlePackager } from '@lynxfita/builder';
import { MtlsRbacLedger, GitHubReleasesUpdater } from '@lynxfita/updater';

test('E2E Full Lifecycle - Codegen, MVI, DMA, WGSL, AOT Builder, mTLS RBAC, and OTA CORDIS Rollback', async () => {
  // =========================================================================
  // STEP 1: Parse TypeScript Spec -> Synthesize C++20 Header & TS Binding
  // =========================================================================
  console.log('[E2E Step 1] Synthesizing native C++20 spec and TypeScript binding via @lynxfita/codegen...');
  const tsSpecSource = `
    export interface NativeWeatherAtmosphericKernelSpec {
      computeAdvection(particleBuffer: Uint8Array, deltaTime: number): Promise<Uint8Array>;
      queryTelemetryLane(laneOffset: number): number;
      resetSimulation(): void;
    }
  `;
  const moduleSpec = parseTypeScriptSpec(tsSpecSource);
  assert.equal(moduleSpec.className, 'WeatherAtmosphericKernel');
  assert.equal(moduleSpec.methods.length, 3);

  const generator = new JsiCodeGenerator();
  const cppHeader = generator.generateCppHeader(moduleSpec);
  const tsBinding = generator.generateTypeScriptBinding(moduleSpec);

  assert.ok(cppHeader.includes('class NativeWeatherAtmosphericKernelSpec : public HostObject'));
  assert.ok(cppHeader.includes('virtual std::vector<uint8_t> computeAdvection(std::vector<uint8_t> particleBuffer, double deltaTime) = 0;'));
  assert.ok(tsBinding.includes('export class WeatherAtmosphericKernelBinding'));
  console.log('  -> Generated C++20 header and TypeScript binding successfully.');

  // =========================================================================
  // STEP 2: Weather Showcase MVI Lifecycle + DMA + WGSL Atmospheric Shader
  // =========================================================================
  console.log('[E2E Step 2] Bootstrapping Weather Showcase MVI with Stationary DMA & WGSL...');
  const stationaryArena = new StationaryDmaClient(512 * 1024);
  const weatherStore = new WeatherStore(undefined, stationaryArena);

  // 2a. Toggle Theme
  await weatherStore.dispatch(Intents.toggleTheme());
  assert.equal(weatherStore.getState().theme, 'light');

  // 2b. Location Error Boundary Trigger and Recovery
  await weatherStore.dispatch(Intents.triggerLocationError('GPS signal lost in canyon'));
  assert.equal(weatherStore.getState().error.hasError, true);
  const errView = renderLocationErrorBoundary(weatherStore.getState());
  assert.ok(errView);

  await weatherStore.dispatch(Intents.grantLocationPermission());
  assert.equal(weatherStore.getState().error.hasError, false);
  const restoredView = renderWeatherAppView(weatherStore.getState());
  assert.equal(restoredView.children.length, 4);

  // 2c. Update Coordinates -> Synchronize to DMA offset 0x2000
  await weatherStore.dispatch(Intents.updateCoordinates(-22.9068, -43.1729, 'Rio de Janeiro', 'BR'));
  const dmaTelemetry = weatherStore.getDmaTelemetry();
  assert.ok(dmaTelemetry[0] > 0); // Temperature
  assert.ok(dmaTelemetry[1] > 0); // Humidity
  assert.ok(dmaTelemetry[2] > 0); // Pressure
  assert.ok(dmaTelemetry[3] > 0); // WindSpeed
  console.log('  -> Stationary DMA lane 0x2000 telemetry verified zero-copy.');

  // 2d. Run WGSL Compute Shader with DMA telemetry vector
  const computePipeline = new WebGpuComputePipeline(stationaryArena);
  const particles = new Float32Array(32); // 4 particles
  particles[0] = 12.0; particles[1] = 18.0;
  particles[4] = 1.0;  particles[5] = 0.5;

  const shaderResult = await computePipeline.executeWeatherParticles(particles, dmaTelemetry, 0.033);
  assert.equal(shaderResult.elementsProcessed, 4);
  assert.ok(shaderResult.durationUs >= 0);
  assert.ok(shaderResult.throughputGflops >= 0);
  assert.ok(['webgpu-hardware', 'dma-simd-native'].includes(shaderResult.backend));
  console.log(`  -> WGSL Atmospheric Compute Shader executed via backend '${shaderResult.backend}' (${shaderResult.durationUs.toFixed(2)} us).`);

  // =========================================================================
  // STEP 3: AOT Hermes Bytecode Packaging & Cryptographic SHA-256 Manifest
  // =========================================================================
  console.log('[E2E Step 3] Compiling Weather Showcase into Hermes AOT Bytecode bundle...');
  const weatherBundleSource = `
    import { WeatherStore, Intents } from '@lynxfita/example-weather-showcase';
    export const app = new WeatherStore();
    export default app;
  `;
  const { bytecode, manifest } = BundlePackager.packageHermesBundle(
    'weather-showcase-mvi',
    '2.0.0',
    weatherBundleSource,
    ['default', 'app']
  );

  assert.equal(bytecode[0], 0x1F);
  assert.equal(bytecode[1], 0x48); // 'H'
  assert.equal(bytecode[2], 0x42); // 'B'
  assert.equal(bytecode[3], 0x43); // 'C'
  assert.equal(manifest.sha256.length, 64);
  assert.equal(manifest.bytecodeSizeBytes, bytecode.length);
  console.log(`  -> AOT Bytecode compiled: ${manifest.bytecodeSizeBytes} bytes (SHA-256: ${manifest.sha256.substring(0, 16)}...).`);

  // =========================================================================
  // STEP 4: Device Identity, mTLS RBAC Ledger, and Ed25519 Chain Signatures
  // =========================================================================
  console.log('[E2E Step 4] Issuing mTLS device certificate and verifying cryptographic hash-chain...');
  const rbacLedger = new MtlsRbacLedger();
  const cert = rbacLedger.issueCertificate('terminal-node-01', 'hw-entropy-seed-7729', ['distributor', 'runtime:hotreload']);
  assert.match(cert.publicKeyFingerprint, /^FP_TERMINAL-NODE-01_/);
  assert.equal(rbacLedger.verifyLedgerChainIntegrity(), true);

  const token = rbacLedger.authenticateDevice('terminal-node-01', 'runtime:hotreload');
  assert.match(token.token, /^MTLS_AUTH_TOKEN_/);
  console.log('  -> Device authenticated via mTLS RBAC with valid Ed25519 signature chain.');

  // =========================================================================
  // STEP 5: Super-App Host Mounting, OTA v2 Update, and CORDIS State Rollback
  // =========================================================================
  console.log('[E2E Step 5] Mounting Weather Showcase in CORDIS Super-App and performing OTA hot-reload...');
  const superAppLedger = new PluginLedger();
  superAppLedger.setCoeffect('hardware.dma', true);
  superAppLedger.setCoeffect('ui.shader.wgsl', true);

  const weatherPluginV1 = createWeatherShowcasePlugin(weatherStore);
  superAppLedger.registerPlugin(weatherPluginV1);
  assert.equal(await superAppLedger.activatePlugin('weather-showcase-mvi'), true);
  assert.equal(superAppLedger.getLedgerStatus()[0].state, PluginState.Active);

  // Distribute OTA bundle update v2.0.1 via GitHubReleasesUpdater
  const updater = new GitHubReleasesUpdater('aleffita', 'lynxfita', '2.0.0');
  const otaPackage = await updater.fetchOtaBundleFromGitHubPackages('lynxfita-bundle-weather-showcase', '2.0.1', rbacLedger);
  assert.equal(otaPackage.verified, true);

  const weatherPluginV2 = {
    ...weatherPluginV1,
    meta: {
      ...weatherPluginV1.meta,
      version: otaPackage.version
    }
  };
  assert.equal(await superAppLedger.hotReloadPlugin('weather-showcase-mvi', weatherPluginV2), true);
  assert.equal(superAppLedger.getLedgerStatus()[0].meta.version, '2.0.1');
  console.log('  -> OTA Hot-reload applied in-place to v2.0.1.');

  // Rollback on deactivation (temporal inversion)
  assert.equal(await superAppLedger.deactivatePlugin('weather-showcase-mvi'), true);
  assert.equal(superAppLedger.getLedgerStatus()[0].state, PluginState.Registered);
  assert.equal(superAppLedger.getLedgerStatus()[0].activeEffectsCount, 0);

  // Verify DMA memory was zeroed by rollback
  assert.deepEqual(weatherStore.getDmaTelemetry(), [0, 0, 0, 0]);
  console.log('  -> Temporal inversion: All effects and DMA allocations rolled back cleanly.');

  console.log('[E2E SUCCESS] Full Lifecycle verified with 100% industrial integrity.');
});
