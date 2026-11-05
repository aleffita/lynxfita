/**
 * Module Federation Reconciler & Cordis Service
 * Reconciles embedded installation baseline (1.0.0-embedded) vs. remote federated bundles
 * (2.1.0-stable for viewer, 2.2.0-canary-patron for top-patron).
 * Automatically unloads child Fiber and rolls back to embedded bundle on CRL certificate revocation.
 */

import { Service, type LynxFitaContext, type Fiber, type CompilerService } from '@lynxfita/core';
import type { AuthorityService } from './authority_service.js';

export interface FederatedBundle {
  version: string;
  name: string;
  sourceCode: string;
  minRole: 'viewer' | 'top-patron' | 'canary';
  isEmbeddedBaseline?: boolean;
}

export interface ReconcileResult {
  activeVersion: string;
  bundleName: string;
  source: 'remote-federated' | 'embedded-baseline';
  clientRole: string;
  serialNumber: string;
  isFallback: boolean;
}

export class FederationService extends Service {
  public static provide = 'federation';
  public static inject = ['authority', 'compiler'];

  private embeddedBaseline: FederatedBundle = {
    version: '1.0.0-embedded',
    name: 'weather-showcase-baseline',
    sourceCode: 'export const version = "1.0.0-embedded"; export default { city: "Default Offline", temp: 20.0 };',
    minRole: 'viewer',
    isEmbeddedBaseline: true,
  };

  private remoteBundles: Map<string, FederatedBundle> = new Map([
    [
      'viewer',
      {
        version: '2.1.0-stable',
        name: 'weather-showcase-stable',
        sourceCode: 'export const version = "2.1.0-stable"; export default { city: "Sao Paulo", temp: 24.5 };',
        minRole: 'viewer',
      },
    ],
    [
      'top-patron',
      {
        version: '2.2.0-canary-patron',
        name: 'weather-showcase-patron',
        sourceCode: 'export const version = "2.2.0-canary-patron"; export default { city: "Tokyo", temp: 18.2, patronFeatures: true };',
        minRole: 'top-patron',
      },
    ],
  ]);

  private activeBundleFiber: Fiber | undefined;
  private currentActiveVersion = '1.0.0-embedded';
  private currentActiveClientSerial: string | undefined;

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'federation');

    // Listen to live CRL revocation events from AuthorityService
    this.ctx.on('authority:revoked', async ({ serialNumber }: { serialNumber: string }) => {
      if (this.currentActiveClientSerial === serialNumber) {
        await this.rollbackToEmbeddedBaseline(`Certificate ${serialNumber} revoked on CRL`);
      }
    });
  }

  public getActiveVersion(): string {
    return this.currentActiveVersion;
  }

  public getEmbeddedBaseline(): FederatedBundle {
    return this.embeddedBaseline;
  }

  /**
   * Reconcile client certificate against module federation bundle targets
   */
  public async reconcile(clientCertPem: string): Promise<ReconcileResult> {
    const authority = this.ctx.getService<AuthorityService>('authority');
    const compiler = this.ctx.getService<CompilerService>('compiler');

    if (!authority || !compiler) {
      throw new Error('Authority and Compiler services required for federation reconcile');
    }

    const authResult = authority.verifyClientCertificate(clientCertPem);
    this.currentActiveClientSerial = authResult.serialNumber;

    if (!authResult.valid || authResult.revoked) {
      await this.rollbackToEmbeddedBaseline('Client certificate untrusted or revoked');
      return {
        activeVersion: this.embeddedBaseline.version,
        bundleName: this.embeddedBaseline.name,
        source: 'embedded-baseline',
        clientRole: authResult.role,
        serialNumber: authResult.serialNumber,
        isFallback: true,
      };
    }

    // Determine target bundle for role
    const targetBundle = this.remoteBundles.get(authResult.role) || this.remoteBundles.get('viewer')!;

    // Compile and activate in isolated child fiber
    if (this.activeBundleFiber) {
      await this.activeBundleFiber._unload();
    }

    const childCtx = this.ctx.isolate(`federation-${targetBundle.version}`);
    this.activeBundleFiber = childCtx.fiber;

    // Compile via Runtime AOT
    compiler.compile(targetBundle.sourceCode, `bundle://${targetBundle.name}`);

    // Register active bundle effects
    childCtx.fiber.registerDisposer(() => {
      this.currentActiveVersion = this.embeddedBaseline.version;
    });

    this.currentActiveVersion = targetBundle.version;
    await this.ctx.emit('federation:activated', {
      version: targetBundle.version,
      role: authResult.role,
    });

    return {
      activeVersion: targetBundle.version,
      bundleName: targetBundle.name,
      source: 'remote-federated',
      clientRole: authResult.role,
      serialNumber: authResult.serialNumber,
      isFallback: false,
    };
  }

  /**
   * Roll back immediately to the embedded installation baseline bundle
   */
  public async rollbackToEmbeddedBaseline(reason: string): Promise<void> {
    if (this.activeBundleFiber) {
      await this.activeBundleFiber._unload();
      this.activeBundleFiber = undefined;
    }
    this.currentActiveVersion = this.embeddedBaseline.version;
    await this.ctx.emit('federation:rollback', {
      version: this.embeddedBaseline.version,
      reason,
    });
  }
}
