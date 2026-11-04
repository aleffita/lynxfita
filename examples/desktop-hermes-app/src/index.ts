import { BridgeInterceptor, HermesRuntimeSession } from '@lynxfita/core';
import { WasiHostContext } from '@lynxfita/wasi-runtime';

console.log('=== LynxFita Desktop Hermes App Bootstrap ===');

// 1. Initialize Static Hermes Session
const hermesSession = new HermesRuntimeSession({
  enableAot: true,
  heapSizeMb: 64
});

console.log('Hermes Runtime:', hermesSession.getStatus().runtime);

// 2. Setup Direct JSI Coexistence Bridge
const bridge = new BridgeInterceptor();

bridge.register('system', 'getDeviceInfo', () => {
  return {
    os: 'Windows NT (Desktop)',
    architecture: 'x64',
    engine: 'Hermes-StaticH',
    zeroJsonBridge: true
  };
});

// 3. Setup Sandboxed WASI Subsystem
const wasiCtx = new WasiHostContext();
wasiCtx.writeString(0, 'LynxFita WASI Subsystem Online');
console.log('WASI Status:', wasiCtx.readString(0, 30));

// 4. Invoke direct JSI call via spkPipe compatibility hook
const deviceInfo = bridge.dispatch('system', 'getDeviceInfo', {});
console.log('Direct JSI Result:', deviceInfo.data);
console.log('Bridge Stats:', bridge.getStats());
console.log('Bootstrap completed successfully without JSON bridge overhead.');
