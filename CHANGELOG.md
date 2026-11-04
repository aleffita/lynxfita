# Changelog

All notable changes to the **LynxFita** research monorepo and runtime engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
