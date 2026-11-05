/**
 * Module Federation Reconciler & Cordis Service
 * Reconciles embedded installation baseline (1.0.0-embedded) vs. remote federated bundles.
 * Uses Ed25519 cryptographic signatures and SHA-256 payload integrity verification.
 * Automatically unloads child Fiber and deterministically rolls back to embedded baseline on integrity failure.
 */

import { Service, type LynxFitaContext, type Fiber, type CompilerService } from '@lynxfita/core';
import { verifyPayload, computeSha256 } from './signature.js';

export interface FederatedBundle {
  version: string;
  name: string;
  sourceCode: string;
  sha256?: string;
  isEmbeddedBaseline?: boolean;
}

export interface ReconcileResult {
  activeVersion: string;
  bundleName: string;
  source: 'remote-federated' | 'embedded-baseline';
  isFallback: boolean;
  sha256: string;
  signatureValid: boolean;
}

export class FederationService extends Service {
  public static provide = 'federation';
  public static inject = ['compiler'];

  private embeddedBaseline: FederatedBundle = {
    version: '1.0.0-embedded',
    name: 'weather-showcase-baseline',
    sourceCode: 'export const version = "1.0.0-embedded"; export default { city: "Default Offline", temp: 20.0 };',
    isEmbeddedBaseline: true,
  };

  private activeBundleFiber: Fiber | undefined;
  private currentActiveVersion = '1.0.0-embedded';

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'federation');
  }

  public getActiveVersion(): string {
    return this.currentActiveVersion;
  }

  public getEmbeddedBaseline(): FederatedBundle {
    return this.embeddedBaseline;
  }

  /**
   * Reconcile remote bundle against embedded baseline using Ed25519 signature & SHA-256 integrity verification.
   */
  public async reconcile(
    bundle: FederatedBundle,
    signatureHex: string,
    trustedPublicKeyPem: string
  ): Promise<ReconcileResult> {
    const compiler = this.ctx.getService<CompilerService>('compiler');
    if (!compiler) {
      throw new Error('CompilerService required for federation reconcile');
    }

    const calculatedSha256 = computeSha256(bundle.sourceCode);
    const expectedSha256 = bundle.sha256 || calculatedSha256;
    const shaMatches = calculatedSha256 === expectedSha256;

    // Verify Ed25519 signature over bundle source code
    const sigValid = shaMatches && verifyPayload(bundle.sourceCode, signatureHex, trustedPublicKeyPem);

    if (!sigValid) {
      await this.rollbackToEmbeddedBaseline('Ed25519 signature verification or SHA-256 integrity check failed');
      await this.ctx.emit('federation:rejected', {
        version: bundle.version,
        name: bundle.name,
        reason: 'Signature or checksum mismatch',
      });
      return {
        activeVersion: this.embeddedBaseline.version,
        bundleName: this.embeddedBaseline.name,
        source: 'embedded-baseline',
        isFallback: true,
        sha256: calculatedSha256,
        signatureValid: false,
      };
    }

    // Unload previous child fiber if any
    if (this.activeBundleFiber) {
      await this.activeBundleFiber._unload();
    }

    const childCtx = this.ctx.isolate(`federation-${bundle.version}`);
    this.activeBundleFiber = childCtx.fiber;

    // Compile via Runtime AOT
    compiler.compile(bundle.sourceCode, `bundle://${bundle.name}`);

    // Register active bundle effect disposer
    childCtx.fiber.registerDisposer(() => {
      this.currentActiveVersion = this.embeddedBaseline.version;
    });

    this.currentActiveVersion = bundle.version;
    await this.ctx.emit('federation:activated', {
      version: bundle.version,
      name: bundle.name,
      sha256: calculatedSha256,
    });

    return {
      activeVersion: bundle.version,
      bundleName: bundle.name,
      source: 'remote-federated',
      isFallback: false,
      sha256: calculatedSha256,
      signatureValid: true,
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
