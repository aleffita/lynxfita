# CORDIS: Spatiotemporal Composability in LynxFita

## Theoretical Foundation: arXiv:2608.25512
CORDIS defines a formal programming paradigm for dynamic modular software systems based on two mathematical duals:
1. **Temporal Composability (Revertible Effects)**: Every state mutation or external resource registration performed by a module registers an inverse operation. When a module is deactivated or hot-reloaded, its inverse stack executes in LIFO order, restoring pristine state with zero memory leaks.
2. **Spatial Composability (Reactive Coeffects)**: Modules declare contextual environment dependencies (coeffects). A module activates automatically only when its required coeffects are satisfied and gracefully hibernates when they are retracted.

## LynxFita Implementation
LynxFita integrates CORDIS directly into `@lynxfita/core` and the native Hermes runtime:
- **`PluginLedger`**: Deterministic ledger tracking plugin registration, dependencies, state versions, and hashes.
- **Dynamic Hot Reloading**: Bytecode bundles or native modules can be reloaded on the fly without restarting the host application process.
- **Zero Node Dependency**: Operates independently of Node.js lifecycle mechanics, executing cleanly inside embedded Hermes or WASI hosts.
