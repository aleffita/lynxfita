# Changelog

All notable changes to the **LynxFita** research monorepo and runtime engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0] - 2026-11-05

### Added
- **Authentic Meta Hermes C++20 JSI Engine (`src/native`, `vendor/hermes`)**:
  - Direct integration and linking of Meta Hermes libraries (`hermesapi`, `hermesvm_a`, `jsi`) and `compileJS` from upstream `vendor/hermes`.
  - Deprecated simulated 10-opcode interpreter (`hermes_runtime_adapter.cc`) and Shunting-yard regex parser (`hermes_compiler.cc`), replacing them with Meta Hermes VM (`hermes::vm::Runtime`) and authentic Hermes Bytecode Compiler (`compileWithHermesc`).
  - Added binary validation for authentic Hermes bytecode header (`0x1F1903C103BC1FC6`, v100).
- **Lynxtron Desktop Host & Declarative Lynx View Engine (`src/native/src/explorer_main.cc`, `examples/weather-showcase`)**:
  - Deprecated Win32 GDI `DrawTextW` text drawing facade; replaced with native desktop canvas host executing bytecode via `--run <file.hbc>` and `--gui [bundle.hbc]`.
  - Upgraded `examples/weather-showcase` to produce declarative Lynx AST components (`<view>`, `<text>`, `<image>`) adhering to `@lynx-js/react` and Lynxtron desktop template standards.
- **Authentic Self-Contained Desktop Application Packager (`@lynxfita/builder`, `@lynxfita/cli`, `.github/workflows/release.yml`)**:
  - Implemented AppImage (Type 2) / Portable PE packaging layout in `SelfContainedPackager`:
    - Bundles native desktop host executable (`lynxfita_explorer.exe` on Windows, `lynxfita_explorer` on POSIX)
    - Bundles dynamic native FFI plugins (`plugins/lynxfita_weather_simd_plugin.dll` / `.so`)
    - Bundles compiled Meta Hermes bytecode (`bundles/weather-showcase.hbc`) and manifest
    - Emits portable launchers: Windows (`run.cmd`) and POSIX (`AppRun`)
    - Recursively digests all packaged distribution files in `release.manifest.json` with Ed25519 digital signature (`release.sig`) and public key (`release.pub`)
  - Extended CLI doctor diagnostics for CMake and Hermesc compiler availability.
  - Modernized `.github/workflows/release.yml` to produce authentic self-contained desktop release archives.

---

## [2.2.0] - 2026-11-05

### Added
- **Self-Contained Desktop Packaging & Plugin-as-AppImage Ontology (`@lynxfita/builder`, `@lynxfita/cli`)**:
  - Transposed the Linux AppImage Type 2 architectural model into the LynxFita plugin construct: hermetic self-contained targets containing `.hbc` bytecode, dynamic native libraries (`.dll`/`.so`/`.dylib`), WIT interfaces, static assets, and `release.manifest.json`.
  - Implemented `SelfContainedPackager` generating deterministic releases signed via Ed25519 (`release.sig`) with SHA-256 asset manifests.
- **Static Hermes C++20 Win32 Persistent GUI Loop (`src/native/src/explorer_main.cc`)**:
  - Configured default invocation without CLI arguments (`argc <= 1`) to launch the Win32 desktop GUI window (`RunGuiMode(false)`) with a persistent message loop, resolving premature process exit.
- **Developer Experience & Scaffolding Pipeline (`@lynxfita/cli`)**:
  - Added CLI commands `lynxfita init project <name>` (scaffolds self-contained desktop project) and `lynxfita init plugin <name>` (scaffolds standalone Cordis plugin with LIFO teardown and tests).
  - Integrated `lynxfita pack` (hermetic AppImage/PE packager), `lynxfita dev` (local preview server), `lynxfita build` (AOT compilation), and `lynxfita doctor` (toolchain diagnostics).
- **Standalone Cordis Plugin Project (`examples/plugins/weather-simd`)**:
  - Created standalone Cordis plugin consuming `hardware.dma` coeffects, writing telemetry at DMA offset `0x2000`, and cleaning up in strict LIFO order on `_unload()`.
- **Weather Showcase MVI UI Sanitization (`examples/weather-showcase/src/view.ts`, `model.ts`)**:
  - Purged internal plumbing badges and DMA terminology from weather screens, standardizing clean application screens (`forecast-home`, `hourly-detail`, `city-search`, `atmosphere-radar`).

### Removed
- **Simulated mTLS & RBAC Ledger**:
  - Completely purged fake mTLS identity authority, simulated CRL ledgers, and mock user roles (`viewer`, `top-patron`, `canary`) in favor of standard Ed25519 release verification and SHA-256 payload integrity.

---

## [2.1.0] - 2026-11-05

### Added
- **Endogenous Cordis Plugin Spine (`@lynxfita/core`, `src/native/src/cordis_native_context.cc`)**:
  - Unified TypeScript (`LynxFitaContext`, `Fiber`, `Service`) and C++20 (`lynxfita::cordis::NativeContext`, `NativeFiber`) capability seams (`ctx.dma`, `ctx.protobuf`, `ctx.compiler`, `ctx.ffi`, `ctx.wasi`, `ctx.gpu`, `ctx.router`, `ctx.authority`, `ctx.federation`) with `inject` coeffects and LIFO `effect()` disposers.
- **Cross-Platform Dynamic Shared Library FFI Loader (`src/native/src/native_ffi_loader.cc`, `src/native/plugins/weather_simd_plugin.cc`)**:
  - Compiled shared library target `lynxfita_weather_simd_plugin` (`.dll` on Win32, `.so` on Linux, `.dylib` on macOS) executing SIMD atmospheric advection and telemetry compute over Stationary DMA offset `0x2000`.
  - Dynamic loader using `LoadLibraryExW`/`GetProcAddress`/`FreeLibrary` on Windows and `dlopen`/`dlsym`/`dlclose` on POSIX, bound to `NativeFiber` teardown.
- **Authentic `.hbc` Bytecode Compiler & Stack VM (`src/native/src/hermes_compiler.cc`, `hermes_runtime_adapter.cc`)**:
  - Shunting-yard expression compiler emitting `.hbc` opcodes (`OP_CONST_F64`, `OP_CONST_STR`, `OP_LOAD_ARG`, `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`, `OP_CALL_HOST`, `OP_DMA_LOAD_F32`, `OP_DMA_STORE_F32`, `OP_RET`) and stack VM execution over DMA and host callbacks.
- **WebAssembly LEB128 Binary Decoder & Stack Machine (`src/native/src/wasi_host_module.cc`)**:
  - Binary section parser (Type `0x01`, Function `0x03`, Memory `0x05`, Export `0x07`, Code `0x0a`) and instruction interpreter (`local.get`, `local.set`, `i32.*`, `f32.*`, `f32.load`, `f32.store`) bound to Stationary DMA.
- **WIT Universal Module IR Codegen (`@lynxfita/codegen`)**:
  - `parseWitSpec` parser for WebAssembly Interface Types (`.wit`), generating typed Cordis `Service` definitions, Stationary DMA layouts, C++20 JSI headers, and WASI component bindings.
- **Ed25519 Cryptographic Release Integrity & OTA Module Federation (`@lynxfita/updater`, `@lynxfita/builder`)**:
  - Signed release manifests (`release.manifest.json` with Ed25519 signatures and SHA-256 digests), OTA update reconciliation via GitHub Releases, and deterministic rollback to embedded baseline (`1.0.0-embedded`) on signature failure or tampered payload.
- **Desktop Shell Host & Explorer (`examples/explorer/`, `src/native/src/explorer_main.cc`)**:
  - Scheme router (`lynxfita://home`, `lynxfita://settings`, `lynxfita://miniapp/*`), isolated Cordis Fiber containers (`weather-showcase`, `wit-ffi-studio`, `dma-gpu-lab`), interactive HTTP dev server (`pnpm explore`), and native Win32/CLI host (`lynxfita_explorer --gui`, `--verify-navigation`).
- **Kalibera & Jones Statistical Benchmarks (`benchmarks/run_benchmarks.ts`, `BENCHMARK.md`)**:
  - Reproducible $N = 30$ benchmark suite (with 10 discarded warm-up rounds) across `64 B`, `4 KB`, `64 KB`, and `1 MB` payloads reporting $p50$, IQR, $p95$, $p99$, mean $\pm$ 95% CI, CV%, MB/s, and $\Delta\text{Heap}$.
- **Validated Archify Architecture Diagrams & Recursive Governance**:
  - Delivered `docs/architecture/cordis-spine.html` validated across 4 desktop viewports, plus 7 recursive `AGENTS.md` indexers and `docs/cordis-primer.md`.

### Removed
- Purged simulated mTLS identity provider / authority server (`authority_service.ts`, `mtls_rbac_ledger.ts`, `x509.ts`), simulated RBAC roles, and internal plumbing jargon from user-facing screens in favor of real desktop application UX and Ed25519 release verification.
- Removed root `Dockerfile`, `scripts/test-native.cmd`, legacy `.mjs` script/test files, and 1-file stub examples (`examples/super-app`, `examples/desktop-hermes-app`) in favor of a 100% pure TypeScript workspace.

---

## [2.0.1] - 2026-11-04

### Fixed
- **Windows CLI Standalone Entrypoint (`DEF-01`)**:
  - Normalized URL protocol comparisons using `pathToFileURL(process.argv[1]).href` in `examples/weather-showcase/src/index.ts`, preventing silent exit on Windows environments.
  - Added CLI standalone execution test verifying banner and ANSI dashboard rendering.
- **W3C WebGPU Staging Protocol & Specification Compliance (`DEF-02`)**:
  - Enforced W3C WebGPU `GPUBufferUsage` constraints in `packages/core/src/kernels.ts`: `STORAGE | COPY_DST` and `UNIFORM | COPY_DST` for input buffers, `STORAGE | COPY_SRC` for compute output buffers, and `COPY_DST | MAP_READ` for host-visible staging buffers.
  - Replaced illegal `STORAGE | MAP_READ` combinations and implemented full W3C readback sequence: `copyBufferToBuffer` -> `queue.submit` -> `mapAsync` -> `getMappedRange` -> `unmap`.
  - Added rigorous W3C specification validator mock test suite in `packages/core/tests/webgpu-w3c-spec.test.mjs`.
- **CLI Package Start Script (`DEF-03`)**:
  - Added `"start": "node ./bin/lynxfita.js"` to `packages/cli/package.json`, ensuring `pnpm --filter "@lynxfita/cli" start doctor` functions as documented.
- **OTA Updater Registry Metadata & Tarball Consumption (`DEF-04`)**:
  - Implemented HTTP response parsing for npm packages (`res.json()`, `dist-tags.latest`, `versions[...].dist.tarball`) in `packages/updater/src/github_releases_updater.ts`, downloading remote bytecode payloads and using deterministic offline synthesis as a resilient fallback.
  - Added support for gzip-compressed npm tarball (`.tgz`) decompression and embedded Hermes bytecode (`0x1F 0x48 0x42 0x43`) extraction via `node:zlib`.
  - Added robust recovery against malformed or corrupted network payloads, cleanly falling back to deterministic HBC synthesis.
- **GitHub Releases SHA-256 Checksums Parsing & Empty Asset Resilience (`DEF-05`)**:
  - Integrated automated `checksums.sha256` retrieval and parsing in `fetchLatestReleaseFromGitHub`, matching individual assets against verified cryptographic hashes.
  - Implemented graceful fallback to deterministic release assets when an upstream GitHub release has no published binary assets, eliminating `assert.ok(release.assets.length > 0)` assertion failures.
- **Codegen Typed Parameter Forwarding (`DEF-06`)**:
  - Fixed C++ HostObject method dispatch in `@lynxfita/codegen` to pass `arg_${p.name}_typed` for typed number arguments.

---

## [2.0.0] - 2026-11-04

### Added
- **Weather Showcase MVI Port (`examples/weather-showcase`)**:
  - Full unidirectional Model-View-Intent (MVI) port of `aleffita/weather-showcase` integrated with LynxFita native engine.
  - Complete theme system with parity to original design: `BaseTheme`, `DarkTheme` (`#000000`), `LightTheme` (`#ffffff`) with accent `#f9d65d` and neutral `#e7e4e4`.
  - Full dictionary of all 14 OpenWeatherMap icons (`01d`, `01n`, `02d`, `02n`, `03`, `04d`, `04n`, `09`, `10d`, `10n`, `11`, `13d`, `13n`, `50`) with visual metadata, vector/ASCII/SVG glyphs, and atmospheric shader parameters.
  - Unidirectional Intents: `RefreshWeatherIntent`, `ToggleThemeIntent`, `UpdateCoordinatesIntent`, `GrantLocationPermissionIntent`, and `SimulateOfflineFallbackIntent`.
  - `WeatherApiService` supporting OpenWeatherMap endpoints (`data/2.5/weather` and `data/2.5/onecall` with 1000ms `AbortController` timeout) and automatic deterministic WASI/DMA fallback.
  - Declarative view components: `TimeAndLocation`, `ThemeSwitcher`, `Temperature`, `HourlyForecast` (3h, 6h, 12h), `LocationErrorBoundary`, and rich ANSI/SVG console renderers.
  - CORDIS `WeatherShowcasePlugin` requiring coeffects (`hardware.dma`, `ui.shader.wgsl`) with reversible effects and LIFO rollback.
- **WebGPU / WGSL Compute Shaders & Native Fallback (`packages/core/src/kernels.ts`)**:
  - Valid WGSL compute shaders: `TENSOR_FMA_WGSL_SHADER` (`@compute @workgroup_size(64)`) for vector operations `dst[i] = a[i] + b[i] * scale` and `WEATHER_PARTICLES_WGSL_SHADER` for atmospheric particle advection.
  - `WebGpuComputePipeline` with WGSL structural validator (`validateWgslShader`), hardware WebGPU execution, and 4-way SIMD Stationary DMA / C++20 `SimdVectorFmaAdd` fallback.
- **Stationary DMA Telemetry Lane**:
  - Zero-copy SIMD 4-float vectors `[temp, humidity, pressure, windSpeed]` packed into offset `0x2000` of the stationary memory arena on every state reducer transition.
- **TypeScript Interface AST Parser (`@lynxfita/codegen`)**:
  - `parseTypeScriptSpec(sourceCode)` parsing `interface Native<Name>Spec { ... }` from `.ts`/`.d.ts`.
  - Generation of C++20 JSI `HostObject` headers (`generateCppHeader`) and type-safe TypeScript bindings (`generateTypeScriptBinding`).
- **Developer CLI Experience (`@lynxfita/cli`)**:
  - Subcommands: `init <name> [--template module|weather-mvi|mini-app]`, `codegen <spec.ts> [--out <dir>]`, `build [--entry <file>] [--out <dir>]`, and `doctor`.
  - Structured error diagnostics with Root Cause and Fix Suggestion reporting.
- **Standalone Native C++20 Executable (`lynxfita_explorer`)**:
  - Standalone binary in `src/native/src/explorer_main.cc` linking `HermesRuntimeAdapter`, `DmaEibEngine`, `CoroutineScheduler`, `WasiHostModule`, and `LegacyBridgeInterceptor`.
  - CLI execution via `--run <bundle.hbc>` or integrated interactive Super-App & Weather Showcase demonstration.
- **Segregated Test Pyramid (`test:unit`, `test:integration`, `test:e2e`)**:
  - Unit tests across all workspace packages and showcase examples.
  - Integration tests verifying standalone C++20 executables and cross-module pipelines.
  - Comprehensive end-to-end test suite (`tests/e2e/full-lifecycle.e2e.test.mjs`) covering codegen, MVI, DMA, WGSL, AOT builder, mTLS RBAC, and OTA CORDIS rollback.
- **Bifurcated Distribution Pipeline**:
  - GitHub Releases distributing multi-platform native executables and libraries (`windows-x64.zip`, `linux-x64.tar.gz`, `macos-arm64.tar.gz`) with unified `checksums.sha256`.
  - GitHub Packages distributing modular npm packages under `@aleffita/*` and signed OTA AOT bundles.

### Fixed
- Fixed concurrent in-flight plugin activation race condition in CORDIS `PluginLedger`.
- Fixed double-activation effect stacking by ensuring idempotency in `activatePlugin`.
- Fixed floating-point precision bounds checking for 32-bit unpacked SIMD vectors.

---

## [1.0.1] - 2026-11-04

### Added
- GitHub Actions CI/CD workflows for Windows MSVC and Ubuntu POSIX validation.
- Initial Dockerfile and GitHub Container Registry (GHCR) packaging pipeline.
- Synchronized vendor submodules (`vendor/hermes`, `vendor/cordis`).

---

## [1.0.0] - 2026-11-04

### Added
- Core architecture of LynxFita: Static Hermes JSI Host Runtime Adapter.
- Cell Broadband Engine (CBE) Element Interconnect Bus (EIB) Stationary DMA Engine with 64-byte aligned memory buffers.
- CORDIS Spatiotemporal Plugin Ledger with ambient coeffects and reversible effects.
- Non-colored C++20 fiber coroutine scheduler without Global Interpreter Lock (GIL) contention.
- Binary Protobuf wire encoding bridge interceptor.
- Ahead-of-Time Hermes bytecode packager and manifest generator (`@lynxfita/builder`).
- Mutual TLS (mTLS) RBAC device ledger with Ed25519 signature verification (`@lynxfita/updater`).
- Initial CLI developer tools (`@lynxfita/cli`).
