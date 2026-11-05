/**
 * WeChat-Style Super-App Explorer Engine
 * Integrates navigation, theme context, child Cordis Fiber sandboxing,
 * and Mini-App lifecycle management.
 */

import {
  LynxFitaContext,
  DmaService,
  ProtobufService,
  CompilerService,
  FfiService,
  GpuService,
  RouterService
} from '@lynxfita/core';
import { SuperAppNavigator, type NavigationRoute } from './lib/navigation.js';
import { ThemeManager } from './lib/theme_context.js';
import { SessionHistoryManager } from './lib/session_history.js';
import { MiniAppContainerManager } from './lib/miniapp_container.js';
import { renderHeaderBar } from './homepage/Navigator.js';
import { renderHomePage, REGISTERED_MINIAPPS } from './homepage/HomePage.js';
import { renderSettingsPage, type SettingsViewState } from './homepage/SettingsPage.js';
import { createWeatherMiniApp, WEATHER_MINIAPP_META } from './miniapps/weather_miniapp.js';
import { createWitFfiStudioMiniApp, WIT_FFI_STUDIO_META } from './miniapps/wit_ffi_studio_miniapp.js';
import { createDmaGpuLabMiniApp, DMA_GPU_LAB_META } from './miniapps/dma_gpu_lab_miniapp.js';

export interface SuperAppConfig {
  context?: LynxFitaContext;
  initialUrl?: string;
}

export class SuperAppExplorer {
  public readonly context: LynxFitaContext;
  public readonly navigator: SuperAppNavigator;
  public readonly themeManager: ThemeManager;
  public readonly historyManager: SessionHistoryManager;
  public readonly containerManager: MiniAppContainerManager;

  private settingsState: SettingsViewState = {
    activeRole: 'viewer',
    crlRevoked: false,
    activeFederationBundle: '2.1.0-stable'
  };

  constructor(config: SuperAppConfig = {}) {
    this.context = config.context || new LynxFitaContext();

    // Ensure core endogenous Cordis services are mounted
    if (!this.context.hasService('dma')) {
      new DmaService(this.context);
    }
    if (!this.context.hasService('protobuf')) {
      new ProtobufService(this.context);
    }
    if (!this.context.hasService('compiler')) {
      new CompilerService(this.context);
    }
    if (!this.context.hasService('ffi')) {
      new FfiService(this.context);
    }
    if (!this.context.hasService('gpu')) {
      new GpuService(this.context);
    }
    if (!this.context.hasService('router')) {
      new RouterService(this.context);
    }

    this.navigator = new SuperAppNavigator(config.initialUrl || 'lynxfita://home');
    this.themeManager = new ThemeManager();
    this.historyManager = new SessionHistoryManager();
    this.containerManager = new MiniAppContainerManager(this.context);

    this.historyManager.log('cordis', 'Super-App Explorer initialized with endogenous Cordis spine');
  }

  public async navigate(url: string, title?: string): Promise<NavigationRoute> {
    const route = this.navigator.navigate(url, title);
    this.historyManager.log('navigation', `Navigated to ${url} (${route.title})`);

    // If navigating to a Mini-App, launch its isolated Fiber
    if (route.host === 'miniapp') {
      const appId = route.path.replace(/^\/+/, '');
      await this.ensureMiniAppLaunched(appId);
    }

    return route;
  }

  public async back(): Promise<NavigationRoute | undefined> {
    const prev = this.navigator.getCurrentRoute();
    if (prev && prev.host === 'miniapp') {
      const appId = prev.path.replace(/^\/+/, '');
      await this.containerManager.unloadMiniApp(appId);
      this.historyManager.log('cordis', `Unloaded Mini-App fiber '${appId}' and unwound LIFO effects`);
    }

    const route = this.navigator.back();
    if (route) {
      this.historyManager.log('navigation', `Navigated back to ${route.url}`);
    }
    return route;
  }

  public async ensureMiniAppLaunched(appId: string): Promise<void> {
    if (this.containerManager.getInstance(appId)) {
      return;
    }

    if (appId === 'weather-showcase') {
      await this.containerManager.launchMiniApp(WEATHER_MINIAPP_META, ctx => createWeatherMiniApp(ctx));
      this.historyManager.log('cordis', 'Mounted Mini-App weather-showcase in child Fiber');
    } else if (appId === 'wit-ffi-studio') {
      await this.containerManager.launchMiniApp(WIT_FFI_STUDIO_META, ctx => createWitFfiStudioMiniApp(ctx));
      this.historyManager.log('cordis', 'Mounted Mini-App wit-ffi-studio in child Fiber');
    } else if (appId === 'dma-gpu-lab') {
      await this.containerManager.launchMiniApp(DMA_GPU_LAB_META, ctx => createDmaGpuLabMiniApp(ctx));
      this.historyManager.log('cordis', 'Mounted Mini-App dma-gpu-lab in child Fiber');
    }
  }

  public getSettingsState(): SettingsViewState {
    return { ...this.settingsState };
  }

  public setMtlsRole(role: SettingsViewState['activeRole']): void {
    this.settingsState.activeRole = role;
    if (!this.settingsState.crlRevoked) {
      this.settingsState.activeFederationBundle =
        role === 'top-patron' || role === 'canary' ? '2.2.0-canary-patron (Remote AOT)' : '2.1.0-stable (Remote AOT)';
    }
    this.historyManager.log('mtls', `Client identity switched to '${role}' role (${this.settingsState.activeFederationBundle})`);
  }

  public toggleCrlRevocation(): boolean {
    this.settingsState.crlRevoked = !this.settingsState.crlRevoked;
    if (this.settingsState.crlRevoked) {
      this.settingsState.activeFederationBundle = '1.0.0-embedded (CRL Rollback)';
    } else {
      this.settingsState.activeFederationBundle =
        this.settingsState.activeRole === 'top-patron' || this.settingsState.activeRole === 'canary'
          ? '2.2.0-canary-patron (Remote AOT)'
          : '2.1.0-stable (Remote AOT)';
    }
    this.historyManager.log(
      'mtls',
      this.settingsState.crlRevoked
        ? 'Certificate serial revoked in live CRL -> Fiber._unload() rollback to 1.0.0-embedded'
        : `Certificate restored in CRL -> reconciled ${this.settingsState.activeFederationBundle}`
    );
    return this.settingsState.crlRevoked;
  }

  public setFederationBundle(bundle: string): void {
    this.settingsState.activeFederationBundle = bundle;
    this.historyManager.log('cordis', `Federation channel switched to bundle ${bundle}`);
  }

  public async renderHtmlPage(): Promise<string> {
    const route = this.navigator.getCurrentRoute() || {
      scheme: 'lynxfita',
      host: 'home',
      path: '',
      url: 'lynxfita://home',
      query: {},
      title: 'Home'
    };
    const theme = this.themeManager.getColors();
    const headerHtml = renderHeaderBar(this.navigator, this.themeManager, route.title);

    let bodyHtml = '';
    if (route.host === 'home') {
      bodyHtml = renderHomePage(this.context, this.themeManager, this.historyManager);
    } else if (route.host === 'settings') {
      bodyHtml = renderSettingsPage(this.context, this.themeManager, this.settingsState);
    } else if (route.host === 'miniapp') {
      const appId = route.path.replace(/^\/+/, '');
      const instance = this.containerManager.getInstance(appId);
      if (instance) {
        bodyHtml = instance.renderHtml();
      } else {
        bodyHtml = `<div style="padding: 2rem; text-align: center; color: ${theme.text};">Mini-App '${appId}' is loading...</div>`;
      }
    } else {
      bodyHtml = `<div style="padding: 2rem; color: ${theme.text};">Unknown route: ${route.url}</div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${route.title} - LynxFita Super-App Explorer</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: ${theme.bg};
      color: ${theme.text};
      min-height: 100vh;
    }
  </style>
</head>
<body>
  ${headerHtml}
  <div id="app-root">
    ${bodyHtml}
  </div>

  <script>
    // Global navigation bridges for interactive browser shell
    window.lynxfitaNavigate = function(url, title) {
      fetch('/api/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, title: title })
      }).then(() => window.location.reload());
    };

    window.lynxfitaNavigateBack = function() {
      fetch('/api/back', { method: 'POST' })
        .then(() => window.location.reload());
    };

    window.lynxfitaToggleTheme = function() {
      fetch('/api/theme/toggle', { method: 'POST' })
        .then(() => window.location.reload());
    };

    window.lynxfitaSetRole = function(role) {
      fetch('/api/settings/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role })
      }).then(() => window.location.reload());
    };

    window.lynxfitaToggleCrlRevocation = function() {
      fetch('/api/settings/crl-toggle', { method: 'POST' })
        .then(() => window.location.reload());
    };

    window.lynxfitaSyncFederation = function() {
      fetch('/api/settings/federation-sync', { method: 'POST' })
        .then(() => window.location.reload());
    };

    window.lynxfitaCompileWit = function() {
      const input = document.getElementById('wit-source-input');
      const val = input ? input.value : '';
      fetch('/api/wit/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: val })
      }).then(() => window.location.reload());
    };

    window.lynxfitaRunSimdFfi = function() {
      fetch('/api/simd/execute', { method: 'POST' })
        .then(() => window.location.reload());
    };

    window.dispatchWeatherIntent = function(intent) {
      fetch('/api/weather/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intent)
      }).then(() => window.location.reload());
    };
  </script>
</body>
</html>`;
  }
}

export * from './lib/navigation.js';
export * from './lib/miniapp_container.js';
export * from './lib/theme_context.js';
export * from './lib/session_history.js';
export { REGISTERED_MINIAPPS };
export { startExplorerServer } from './host/server.js';
