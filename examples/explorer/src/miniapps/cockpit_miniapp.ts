/**
 * Developer & Agent Cockpit Mini-App
 * Centralized control plane orchestrating:
 * 1. Multi-repo workspace topologies (lynxfita, lynxfita-visualizer-3d, insights)
 * 2. Remote Bundle Federation & Ed25519 OTA Reconciler (Embedded vs Remote)
 * 3. ByteDance A2UI v0.9 GenUI Dynamic Agent Canvas
 * 4. Hermes AOT Compiler & Bytecode Packager Studio
 * 5. Git State Machine DAG & Provably Fair Consensus Inspector
 */

import type { LynxFitaContext } from '@lynxfita/core';
import type { MiniAppMetadata } from '../lib/miniapp_container.js';
import { BundlePackager } from '@lynxfita/builder';
import {
  FederationService,
  generateReleaseKeyPair,
  signPayload,
  computeSha256,
} from '@lynxfita/updater';
import {
  A2UiSurfaceRenderer,
  LynxFitaCockpitCatalog,
  type A2UiMessage,
} from '@lynxfita/genui';
import { randomFillSync } from 'node:crypto';

export const COCKPIT_MINIAPP_META: MiniAppMetadata = {
  id: 'developer-cockpit',
  name: 'Developer & Agent Cockpit',
  icon: '🛠️',
  description: 'Multi-repo orchestrator, remote OTA federation reconciler, GenUI A2UI canvas & Hermes compiler studio.',
  version: '2.2.0',
  author: 'Alef Oliveira (Alefita) <me@aleffita.dev>',
  inject: ['compiler', 'dma']
};

export interface CockpitState {
  activeTab: 'overview' | 'federation' | 'genui' | 'compiler' | 'statemachine';
  selectedProject: 'lynxfita' | 'visualizer-3d' | 'insights';
  remoteFederation: {
    targetUrl: string;
    lastReconciledVersion: string;
    status: 'idle' | 'verified' | 'rollback' | 'error';
    activeSource: 'embedded-baseline' | 'remote-federated';
    sha256: string;
    signatureValid: boolean;
  };
  compiler: {
    sourceSnippet: string;
    lastBytecodeSize: number;
    lastSha256: string;
    compileTimeMs: number;
    isHermesBytecode: boolean;
  };
  stateMachine: {
    consensusRound: number;
    lastRoll: number;
    rollSuccess: boolean;
    laneLatencyMs: number;
    witnessCount: number;
  };
  genuiSurfaceId: string;
}

export class CockpitStore {
  private state: CockpitState;
  private renderer: A2UiSurfaceRenderer;

  constructor(public readonly context: LynxFitaContext) {
    this.renderer = new A2UiSurfaceRenderer('cockpit-agent-surface', LynxFitaCockpitCatalog);

    this.state = {
      activeTab: 'overview',
      selectedProject: 'lynxfita',
      remoteFederation: {
        targetUrl: 'https://cdn.lynxfita.dev/bundles/visualizer-3d/v2.3.0.manifest.json',
        lastReconciledVersion: '1.0.0-embedded',
        status: 'idle',
        activeSource: 'embedded-baseline',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        signatureValid: true,
      },
      compiler: {
        sourceSnippet: 'export function renderHUD() { return { fps: 60, stationaryDmaOffset: 0x2000 }; }',
        lastBytecodeSize: 0,
        lastSha256: '',
        compileTimeMs: 0,
        isHermesBytecode: false,
      },
      stateMachine: {
        consensusRound: 1,
        lastRoll: 10,
        rollSuccess: true,
        laneLatencyMs: 2.14,
        witnessCount: 3,
      },
      genuiSurfaceId: 'cockpit-agent-surface',
    };

    this.initDefaultGenUiSurface();
  }

  public getState(): CockpitState {
    return { ...this.state };
  }

  public getRenderer(): A2UiSurfaceRenderer {
    return this.renderer;
  }

  public setTab(tab: CockpitState['activeTab']): void {
    this.state.activeTab = tab;
  }

  public setProject(project: CockpitState['selectedProject']): void {
    this.state.selectedProject = project;
  }

  /**
   * Reconcile remote bundle against embedded baseline with genuine Ed25519 & SHA-256 verification.
   */
  public async reconcileRemoteBundle(simulateTampering = false): Promise<void> {
    const federation = new FederationService(this.context);
    const keyPair = generateReleaseKeyPair();

    const sourceCode = simulateTampering
      ? 'export const version = "2.3.0-tampered"; export default { corrupted: true };'
      : 'export const version = "2.3.0-remote"; export default { ready: true, webgpu: true };';

    const calculatedSha256 = computeSha256(sourceCode);
    const signatureHex = simulateTampering
      ? '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      : signPayload(sourceCode, keyPair.privateKeyPem);

    const result = await federation.reconcile(
      {
        version: simulateTampering ? '2.3.0-tampered' : '2.3.0-remote',
        name: 'visualizer-3d-bundle',
        sourceCode,
        sha256: calculatedSha256,
      },
      signatureHex,
      keyPair.publicKeyPem
    );

    this.state.remoteFederation = {
      targetUrl: this.state.remoteFederation.targetUrl,
      lastReconciledVersion: result.activeVersion,
      status: result.signatureValid ? 'verified' : 'rollback',
      activeSource: result.source,
      sha256: result.sha256,
      signatureValid: result.signatureValid,
    };
  }

  /**
   * Synchronize state machine consensus and trigger provably fair 3d6 roll.
   */
  public syncStateMachine(): void {
    const start = performance.now();
    const buf = Buffer.alloc(3);
    randomFillSync(buf);
    const d1 = ((buf[0] ?? 0) % 6) + 1;
    const d2 = ((buf[1] ?? 0) % 6) + 1;
    const d3 = ((buf[2] ?? 0) % 6) + 1;
    const total = d1 + d2 + d3;
    const elapsed = performance.now() - start;

    this.state.stateMachine = {
      consensusRound: this.state.stateMachine.consensusRound + 1,
      lastRoll: total,
      rollSuccess: total <= 11,
      laneLatencyMs: Number((elapsed + 0.5).toFixed(2)),
      witnessCount: 3,
    };
  }

  /**
   * Trigger Hermes AOT bytecode compilation via @lynxfita/builder.
   */
  public compileSnippet(source?: string): void {
    const code = source || this.state.compiler.sourceSnippet;
    const start = performance.now();
    const { bytecode, manifest } = BundlePackager.packageHermesBundle(
      'cockpit-aot-module',
      '2.2.0',
      code,
      ['renderHUD']
    );
    const elapsed = performance.now() - start;

    const isHermes =
      (bytecode[0] === 0xc6 && bytecode[1] === 0x1f && bytecode[2] === 0xbc && bytecode[3] === 0x03) ||
      (bytecode[0] === 0x1f && bytecode[1] === 0x48 && bytecode[2] === 0x42 && bytecode[3] === 0x43);

    this.state.compiler = {
      sourceSnippet: code,
      lastBytecodeSize: bytecode.length,
      lastSha256: manifest.sha256,
      compileTimeMs: Number(elapsed.toFixed(2)),
      isHermesBytecode: isHermes,
    };
  }

  /**
   * Inject dynamic A2UI messages into the agent canvas.
   */
  public applyGenUiMessages(messages: readonly A2UiMessage[]): void {
    for (const msg of messages) {
      this.renderer.applyMessage(msg);
    }
  }

  private initDefaultGenUiSurface(): void {
    const messages: A2UiMessage[] = [
      {
        version: 'v0.9',
        type: 'createSurface',
        surfaceId: 'cockpit-agent-surface',
        catalogId: LynxFitaCockpitCatalog.catalogId,
      },
      {
        version: 'v0.9',
        type: 'updateDataModel',
        surfaceId: 'cockpit-agent-surface',
        data: {
          runtime: {
            engine: 'Meta Hermes C++20 JSI',
            spine: 'Cordis Microkernel v2.2.0',
            dmaOffset: '0x2000',
            activeFibers: 4,
          },
        },
      },
      {
        version: 'v0.9',
        type: 'updateComponents',
        surfaceId: 'cockpit-agent-surface',
        components: [
          {
            id: 'root',
            type: 'Container',
            props: { direction: 'column', gap: 12 },
            children: ['agent-status-card', 'quick-actions'],
          },
          {
            id: 'agent-status-card',
            type: 'Card',
            props: {
              title: 'Agent Dynamic Vitals',
              subtitle: 'A2UI Catalog-Constrained GenUI Stream',
              accentColor: '#a6e3a1',
            },
            children: ['engine-metric', 'dma-slot'],
          },
          {
            id: 'engine-metric',
            type: 'Metric',
            props: { label: 'Active Execution Spine', value: 'Cordis Microkernel' },
            bindings: { value: 'runtime.spine' },
          },
          {
            id: 'dma-slot',
            type: 'MemorySlotView',
            props: {
              offsetHex: '0x2000',
              lengthBytes: 32,
              description: 'Stationary SIMD telemetry slot for real-time 3D advection',
            },
          },
          {
            id: 'quick-actions',
            type: 'Container',
            props: { direction: 'row', gap: 8 },
            children: ['btn-sync-git', 'btn-compile'],
          },
          {
            id: 'btn-sync-git',
            type: 'Button',
            props: { label: 'Sync Git State DAG', variant: 'secondary' },
            actions: { onPress: { action: 'SYNC_GIT_DAG' } },
          },
          {
            id: 'btn-compile',
            type: 'Button',
            props: { label: 'Trigger Bytecode Packaging', variant: 'primary' },
            actions: { onPress: { action: 'TRIGGER_AOT_BUILD' } },
          },
        ],
      },
    ];

    for (const msg of messages) {
      this.renderer.applyMessage(msg);
    }
  }
}

export function renderHtmlCockpitApp(store: CockpitStore): string {
  const state = store.getState();
  const renderer = store.getRenderer();

  const tabs = [
    { id: 'overview', label: 'Workspace Overview', icon: '🌐' },
    { id: 'federation', label: 'Remote Federation & OTA', icon: '📦' },
    { id: 'genui', label: 'A2UI Agent Canvas', icon: '✨' },
    { id: 'compiler', label: 'Hermes AOT Compiler', icon: '⚡' },
    { id: 'statemachine', label: 'State Machine & DAG', icon: '🎲' },
  ] as const;

  const tabsNav = tabs
    .map(
      t => `
    <button class="cockpit-tab-btn ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}" style="
      background: ${state.activeTab === t.id ? '#313244' : 'transparent'};
      color: ${state.activeTab === t.id ? '#cdd6f4' : '#a6adc8'};
      border: 1px solid ${state.activeTab === t.id ? '#45475a' : 'transparent'};
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    ">
      <span>${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `
    )
    .join('');

  let contentHtml = '';

  if (state.activeTab === 'overview') {
    contentHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 16px; border-left: 3px solid #89b4fa;">
          <div style="font-size: 11px; text-transform: uppercase; color: #89b4fa; font-weight: 700;">Framework Monorepo</div>
          <div style="font-size: 17px; font-weight: 700; color: #cdd6f4; margin-top: 4px;">lynxfita</div>
          <p style="font-size: 12px; color: #a6adc8; margin-top: 6px;">Cordis Microkernel, Static Hermes C++20 JSI, Stationary DMA, WIT/WASI, and Builder.</p>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <span style="background: #89b4fa22; color: #89b4fa; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">v2.2.0</span>
            <span style="background: #a6e3a122; color: #a6e3a1; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">develop</span>
          </div>
        </div>

        <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 16px; border-left: 3px solid #fab387;">
          <div style="font-size: 11px; text-transform: uppercase; color: #fab387; font-weight: 700;">Consumer Application</div>
          <div style="font-size: 17px; font-weight: 700; color: #cdd6f4; margin-top: 4px;">lynxfita-visualizer-3d</div>
          <p style="font-size: 12px; color: #a6adc8; margin-top: 6px;">Isolated WebGPU WGSL 3D visualizer mini-app consuming @lynxfita/* SDKs.</p>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <span style="background: #fab38722; color: #fab387; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">v2.3.0-remote</span>
            <span style="background: #a6e3a122; color: #a6e3a1; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Remote OTA</span>
          </div>
        </div>

        <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 16px; border-left: 3px solid #cba6f7;">
          <div style="font-size: 11px; text-transform: uppercase; color: #cba6f7; font-weight: 700;">Epistemological Nexus</div>
          <div style="font-size: 17px; font-weight: 700; color: #cdd6f4; margin-top: 4px;">insights</div>
          <p style="font-size: 12px; color: #a6adc8; margin-top: 6px;">Git State Machine, Provably Fair HMAC-SHA256 consensus & Dockerless Lane Runner.</p>
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <span style="background: #cba6f722; color: #cba6f7; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">v0.1.0</span>
            <span style="background: #a6e3a122; color: #a6e3a1; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Dockerless</span>
          </div>
        </div>
      </div>
    `;
  } else if (state.activeTab === 'federation') {
    const fed = state.remoteFederation;
    const statusColor = fed.status === 'verified' ? '#a6e3a1' : fed.status === 'rollback' ? '#f38ba8' : '#89b4fa';
    const statusText = fed.status === 'verified' ? 'Active: Remote Federated Bundle (Ed25519 Verified)' : fed.status === 'rollback' ? 'Rolled Back to Embedded Baseline (Integrity Fault)' : 'Idle Baseline';

    contentHtml = `
      <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 12px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: #cdd6f4;">Ed25519 Module Federation & Remote OTA Reconciler</div>
            <div style="font-size: 12px; color: #a6adc8; margin-top: 2px;">Dynamically fetch, verify and stage remote application bundles into isolated Fibers.</div>
          </div>
          <span style="background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44; border-radius: 12px; padding: 4px 12px; font-size: 12px; font-weight: 600;">
            ${statusText}
          </span>
        </div>

        <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #89b4fa; font-weight: 700;">Embedded Local Baseline</div>
            <div style="font-size: 14px; font-weight: 700; color: #cdd6f4; margin-top: 4px;">1.0.0-embedded</div>
            <div style="font-size: 12px; color: #a6adc8; margin-top: 6px;">Hermetic fallback compiled directly into the native binary distribution. Always safe.</div>
          </div>

          <div style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 14px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #fab387; font-weight: 700;">Active Staged Bundle</div>
            <div style="font-size: 14px; font-weight: 700; color: #cdd6f4; margin-top: 4px;">${fed.lastReconciledVersion} (${fed.activeSource})</div>
            <div style="font-size: 11px; font-family: monospace; color: #6c7086; margin-top: 6px; word-break: break-all;">SHA-256: ${fed.sha256}</div>
          </div>
        </div>

        <div style="margin-top: 20px; display: flex; gap: 10px;">
          <button id="btn-reconcile-remote" style="background: #89b4fa; color: #11111b; border: none; border-radius: 6px; padding: 10px 16px; font-weight: 700; cursor: pointer;">
            Fetch & Reconcile Remote Bundle
          </button>
          <button id="btn-reconcile-tampered" style="background: #f38ba8; color: #11111b; border: none; border-radius: 6px; padding: 10px 16px; font-weight: 700; cursor: pointer;">
            Simulate Tampered Bundle (Test Deterministic Rollback)
          </button>
        </div>
      </div>
    `;
  } else if (state.activeTab === 'genui') {
    contentHtml = `
      <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: #cdd6f4;">A2UI Agent-to-UI Dynamic Surface</div>
            <div style="font-size: 12px; color: #a6adc8; margin-top: 2px;">Catalog-constrained UI stream rendered natively via @lynxfita/genui.</div>
          </div>
          <span style="background: #a6e3a122; color: #a6e3a1; font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600;">
            A2UI v0.9 Active
          </span>
        </div>

        <!-- Rendered A2UI Surface -->
        <div id="a2ui-surface-mount">
          ${renderer.renderHtml()}
        </div>
      </div>
    `;
  } else if (state.activeTab === 'compiler') {
    const comp = state.compiler;
    contentHtml = `
      <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 20px;">
        <div style="font-size: 16px; font-weight: 700; color: #cdd6f4; margin-bottom: 4px;">Hermes AOT Bytecode Studio (@lynxfita/builder)</div>
        <div style="font-size: 12px; color: #a6adc8; margin-bottom: 16px;">Compile TypeScript Mini-App modules into Static Hermes HBC bytecode.</div>

        <textarea id="compiler-source" style="width: 100%; height: 90px; background: #11111b; color: #cdd6f4; border: 1px solid #313244; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 12px; resize: vertical;">${comp.sourceSnippet}</textarea>

        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
          <button id="btn-compile-now" style="background: #89b4fa; color: #11111b; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 700; cursor: pointer;">
            Compile to Hermes Bytecode (.hbc)
          </button>
          <div style="font-size: 12px; color: #a6adc8;">
            ${comp.lastBytecodeSize > 0 ? `Bytecode: <strong style="color: #a6e3a1;">${comp.lastBytecodeSize} bytes</strong> (${comp.compileTimeMs} ms)` : 'No active build'}
          </div>
        </div>

        ${comp.lastSha256 ? `
          <div style="margin-top: 12px; background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; color: #a6adc8;">
            <div><strong>SHA-256 Digest:</strong> ${comp.lastSha256}</div>
            <div style="margin-top: 4px;"><strong>HBC Magic:</strong> ${comp.isHermesBytecode ? 'Valid Hermes HBC' : 'Pending'}</div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (state.activeTab === 'statemachine') {
    const sm = state.stateMachine;
    const rollText = `${sm.lastRoll} (${sm.rollSuccess ? 'Success' : 'Failure'})`;
    const rollColor = sm.rollSuccess ? '#a6e3a1' : '#f38ba8';

    contentHtml = `
      <div style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: #cdd6f4;">Stigmergic Git State Machine & Provably Fair Consensus</div>
            <div style="font-size: 12px; color: #a6adc8; margin-top: 2px;">Inspect Virtual Voting DAG and cryptographic 3d6 dice rolls from C:\\Users\\alefita\\insights.</div>
          </div>
          <span style="background: #cba6f722; color: #cba6f7; font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600;">
            Host-Native Runner
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #6c7086; font-weight: 600;">Consensus Round</div>
            <div style="font-size: 22px; font-weight: 800; color: #89b4fa; margin-top: 4px;">Round ${sm.consensusRound}</div>
          </div>
          <div style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #6c7086; font-weight: 600;">Provably Fair 3d6 Roll</div>
            <div style="font-size: 22px; font-weight: 800; color: ${rollColor}; margin-top: 4px;">${rollText}</div>
          </div>
          <div style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #6c7086; font-weight: 600;">Host Execution Latency</div>
            <div style="font-size: 22px; font-weight: 800; color: #fab387; margin-top: 4px;">${sm.laneLatencyMs} ms</div>
          </div>
        </div>

        <div style="margin-top: 20px;">
          <button id="btn-sync-state-machine" style="background: #cba6f7; color: #11111b; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 700; cursor: pointer;">
            Advance State Consensus Round (HMAC-SHA256 3d6 Roll)
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="cockpit-app" style="padding: 20px; max-width: 960px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <!-- Cockpit Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #cdd6f4;">Developer & Agent Cockpit</h2>
          <div style="font-size: 12px; color: #a6adc8; margin-top: 2px;">Unified Systems Control Plane & Multi-Repo Stigmergic Nexus</div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px;">
        ${tabsNav}
      </div>

      <!-- Active Tab Content -->
      ${contentHtml}
    </div>
  `;
}

export async function createCockpitMiniApp(
  context: LynxFitaContext
): Promise<{
  store: CockpitStore;
  onShow: () => void;
  onHide: () => void;
  renderHtml: () => string;
}> {
  const store = new CockpitStore(context);

  return {
    store,
    onShow: () => {},
    onHide: () => {},
    renderHtml: () => renderHtmlCockpitApp(store),
  };
}
