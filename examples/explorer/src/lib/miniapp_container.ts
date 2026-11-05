/**
 * WeChat-Style Mini-App Container with Cordis Fiber Sandboxing
 * Mounts each Mini-App inside an isolated child Cordis Context & Fiber (ctx.isolate()).
 * Unwinds all registered effects in LIFO order upon Mini-App close/back.
 */

import type { LynxFitaContext, Fiber } from '@lynxfita/core';

export interface MiniAppMetadata {
  id: string;
  name: string;
  icon: string;
  description: string;
  version: string;
  author: string;
  inject: string[];
}

export interface MiniAppInstance {
  meta: MiniAppMetadata;
  context: LynxFitaContext;
  fiber: Fiber;
  status: 'launching' | 'active' | 'hidden' | 'unloaded';
  onLaunch: () => Promise<void> | void;
  onShow: () => Promise<void> | void;
  onHide: () => Promise<void> | void;
  onUnload: () => Promise<void> | void;
  renderHtml: () => string;
  dispatch?: ((intent: any) => Promise<any> | any) | undefined;
}

export class MiniAppContainerManager {
  private activeInstances = new Map<string, MiniAppInstance>();

  constructor(private rootContext: LynxFitaContext) {}

  public async launchMiniApp(
    meta: MiniAppMetadata,
    factory: (ctx: LynxFitaContext) => Promise<{
      onShow?: (() => Promise<void> | void) | undefined;
      onHide?: (() => Promise<void> | void) | undefined;
      renderHtml: () => string;
      dispatch?: ((intent: any) => Promise<any> | any) | undefined;
    }>
  ): Promise<MiniAppInstance> {
    // If already launched, bring to show
    const existing = this.activeInstances.get(meta.id);
    if (existing && existing.status !== 'unloaded') {
      await existing.onShow();
      existing.status = 'active';
      return existing;
    }

    // Isolate a dedicated child Cordis context and fiber for this Mini-App
    const childContext = this.rootContext.isolate(`miniapp-${meta.id}`);
    const fiber = childContext.fiber;

    // Validate inject coeffects
    for (const dep of meta.inject) {
      if (!childContext.hasService(dep)) {
        throw new Error(`Mini-App '${meta.id}' requires missing coeffect service '${dep}'`);
      }
    }

    const appLogic = await factory(childContext);

    const instance: MiniAppInstance = {
      meta,
      context: childContext,
      fiber,
      status: 'launching',
      onLaunch: async () => {
        // Registered initial effects
      },
      onShow: async () => {
        if (appLogic.onShow) await appLogic.onShow();
      },
      onHide: async () => {
        if (appLogic.onHide) await appLogic.onHide();
      },
      onUnload: async () => {
        await fiber._unload();
      },
      renderHtml: appLogic.renderHtml,
      dispatch: appLogic.dispatch
    };

    await instance.onLaunch();
    await instance.onShow();
    instance.status = 'active';
    this.activeInstances.set(meta.id, instance);

    return instance;
  }

  public async unloadMiniApp(id: string): Promise<boolean> {
    const instance = this.activeInstances.get(id);
    if (!instance) return false;

    await instance.onHide();
    await instance.onUnload();
    instance.status = 'unloaded';
    this.activeInstances.delete(id);
    return true;
  }

  public getInstance(id: string): MiniAppInstance | undefined {
    return this.activeInstances.get(id);
  }

  public getActiveCount(): number {
    return this.activeInstances.size;
  }
}
