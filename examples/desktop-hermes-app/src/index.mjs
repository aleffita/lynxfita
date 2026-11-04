import { BridgeInterceptor, HermesRuntimeSession } from '../../../packages/core/dist/index.js';
import { WasiHostContext } from '../../../packages/wasi-runtime/dist/index.js';

console.log('========================================================');
console.log('   LynxFita Desktop Hermes App Bootstrap & JSI Demo    ');
console.log('========================================================');

// 1. Initialize Static Hermes Session
const hermesSession = new HermesRuntimeSession({
  enableAot: true,
  heapSizeMb: 64
});

console.log('Engine Runtime:     ', hermesSession.getStatus().runtime);

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
const msg = 'LynxFita WASI Subsystem Online';
wasiCtx.writeString(0, msg);
console.log('WASI Status:        ', wasiCtx.readString(0, msg.length));

// 4. Invoke direct JSI call via compatibility hook
const deviceInfo = bridge.dispatch('system', 'getDeviceInfo', {});
console.log('Direct JSI Result:  ', deviceInfo.data);
console.log('Bridge Stats:       ', bridge.getStats());
console.log('========================================================');
console.log('App bootstrap completed successfully without JSON bridge.');
