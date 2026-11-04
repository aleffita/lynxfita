# Desktop Hermes App Example

This example demonstrates how an application running on LynxFita executes:
1. Static Hermes runtime bytecode initialization.
2. Direct JSI native module invocation using the coexistence `BridgeInterceptor`.
3. WASI/WASIX sandboxed native module execution.
4. Complete bypass of legacy JSON serialization (`spkPipe` / `NativeModules`).

## Running

```bash
pnpm install
pnpm --filter desktop-hermes-app build
pnpm --filter desktop-hermes-app start
```
