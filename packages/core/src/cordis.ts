/**
 * CORDIS: Endogenous Spatiotemporal Composability Spine
 * Based on arXiv:2608.25512 (A Programming Paradigm for Spatiotemporal Composability)
 * Modeled on vendor/cordis (Context, Fiber, Service, Registry, Reflect, isolate, effect, emit, waterfall, inject)
 */

export type Disposer = () => Promise<void> | void;
export type EffectCallback = () => Promise<void | Disposer> | void | Disposer;
export type EventHandler = (...args: any[]) => any;

export interface RevertibleEffect {
  name: string;
  appliedAt: number;
  revert: Disposer;
}

export interface PluginMeta {
  id: string;
  name?: string;
  version?: string;
  dependencies?: string[];
  requiredCoeffects?: string[];
}

export interface ServiceConstructor<T extends Service = Service> {
  new (ctx: LynxFitaContext, ...args: any[]): T;
  provide?: string;
  inject?: readonly string[];
}

export type PluginFunction<C = any> = (ctx: LynxFitaContext, config?: C) => any;
export type PluginObject<C = any> = {
  name?: string;
  apply: (ctx: LynxFitaContext, config?: C) => any;
  inject?: readonly string[];
};
export type Plugin<C = any> =
  | ServiceConstructor
  | PluginFunction<C>
  | PluginObject<C>
  | GeneratorFunction;

// ============================================================================
// Cordis Fiber: Bounded Lifecycle Unit with LIFO Effect Unwinding
// ============================================================================

export class Fiber {
  public readonly id: string;
  public readonly context: LynxFitaContext;
  public state: 'active' | 'unloaded' = 'active';
  public readonly disposers: Disposer[] = [];
  public readonly inject: readonly string[] = [];

  constructor(id: string, context: LynxFitaContext, inject: readonly string[] = []) {
    this.id = id;
    this.context = context;
    this.inject = inject;
  }

  public registerDisposer(disposer: Disposer): void {
    if (this.state === 'unloaded') {
      throw new Error(`Cannot register disposer on unloaded Fiber ${this.id}`);
    }
    this.disposers.push(disposer);
  }

  public async _unload(): Promise<void> {
    if (this.state === 'unloaded') {
      return;
    }
    this.state = 'unloaded';

    // Unwind all registered disposers in reverse order (LIFO)
    while (this.disposers.length > 0) {
      const disposer = this.disposers.pop();
      if (disposer) {
        try {
          await disposer();
        } catch (err) {
          console.error(`[Fiber ${this.id}] Error during LIFO disposer unwind:`, err);
        }
      }
    }
  }
}

// ============================================================================
// Cordis Service Base Class
// ============================================================================

export abstract class Service {
  public name: string;
  public ctx: LynxFitaContext;

  constructor(ctx: LynxFitaContext, name?: string) {
    const serviceName = name ?? (this.constructor as any).provide;
    if (!serviceName) {
      throw new Error(`Service constructor must declare static provide or pass name`);
    }
    this.ctx = ctx;
    this.name = serviceName;

    // Validate inject coeffects
    const injectCoeffects = (this.constructor as any).inject ?? [];
    for (const coeffect of injectCoeffects) {
      if (!ctx.hasService(coeffect)) {
        throw new Error(
          `Service '${serviceName}' requires missing coeffect service '${coeffect}'`,
        );
      }
    }

    // Mount onto context
    ctx.provide(serviceName, this);

    // Register LIFO disposer to unmount when active fiber unloads
    ctx.fiber.registerDisposer(() => {
      ctx.unprovide(serviceName);
    });
  }
}

// ============================================================================
// LynxFitaContext: Unified Endogenous Runtime Spine
// ============================================================================

export class LynxFitaContext {
  public readonly id: string;
  public readonly root: LynxFitaContext;
  public readonly parent: LynxFitaContext | undefined;
  public readonly fiber: Fiber;

  protected services = new Map<string, Service>();
  protected events = new Map<string, Set<EventHandler>>();
  protected childContexts = new Set<LynxFitaContext>();
  protected plugins = new Map<any, Fiber>();

  [key: string]: any;

  constructor(parent?: LynxFitaContext, fiberId = 'root') {
    this.parent = parent;
    this.root = parent ? parent.root : this;
    this.id = parent ? `${parent.id}.${fiberId}` : fiberId;
    this.fiber = new Fiber(this.id, this);

    // Delegate service lookups to parent via prototype or getter
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (target.services.has(prop)) {
            return target.services.get(prop);
          }
          if (target.parent && target.parent.hasService(prop)) {
            return target.parent.getService(prop);
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Create an isolated child context with its own child fiber
   */
  public isolate(key = 'child'): LynxFitaContext {
    const child = new LynxFitaContext(this, key);
    this.childContexts.add(child);
    this.fiber.registerDisposer(async () => {
      await child.fiber._unload();
      this.childContexts.delete(child);
    });
    return child;
  }

  /**
   * Register a revertible effect or generator disposable
   */
  public effect(
    applyOrCallback: EffectCallback,
    revert?: Disposer,
  ): Disposer {
    let activeDisposer: Disposer | undefined = revert;

    if (!revert) {
      const res = applyOrCallback();
      if (typeof res === 'function') {
        activeDisposer = res;
      } else if (res && typeof (res as Promise<any>).then === 'function') {
        (res as Promise<any>).then((ret) => {
          if (typeof ret === 'function') {
            activeDisposer = ret;
          }
        });
      }
    } else {
      applyOrCallback();
    }

    const unregister = () => {
      if (activeDisposer) {
        const d = activeDisposer;
        activeDisposer = undefined;
        return d();
      }
    };

    this.fiber.registerDisposer(unregister);
    return unregister;
  }

  /**
   * Mount a Cordis Service instance
   */
  public provide(name: string, service: Service): void {
    this.services.set(name, service);
    this[name] = service;
    this.emit(`service:${name}`, service);
  }

  public unprovide(name: string): void {
    this.services.delete(name);
    delete this[name];
    this.emit(`service:unloaded:${name}`);
  }

  public hasService(name: string): boolean {
    if (this.services.has(name)) return true;
    if (this.parent) return this.parent.hasService(name);
    return false;
  }

  public getService<T = any>(name: string): T | undefined {
    if (this.services.has(name)) return this.services.get(name) as T;
    if (this.parent) return this.parent.getService<T>(name);
    return undefined;
  }

  public getServices(): ReadonlyMap<string, Service> {
    const map = new Map<string, Service>();
    if (this.parent) {
      for (const [k, v] of this.parent.getServices()) {
        map.set(k, v);
      }
    }
    for (const [k, v] of this.services) {
      map.set(k, v);
    }
    return map;
  }

  /**
   * Register a plugin, service constructor, or generator
   */
  public plugin<C = any>(pluginDef: Plugin<C>, config?: C): Fiber {
    const childCtx = this.isolate(
      typeof pluginDef === 'function' ? pluginDef.name || 'plugin' : 'plugin',
    );
    const fiber = childCtx.fiber;

    if (typeof pluginDef === 'function') {
      // Check if it's a Service constructor
      if (
        pluginDef.prototype &&
        (pluginDef.prototype instanceof Service || 'provide' in pluginDef)
      ) {
        const SvcClass = pluginDef as ServiceConstructor;
        new SvcClass(childCtx, config);
      } else {
        // Function or generator
        const result = (pluginDef as any)(childCtx, config);
        // If generator, collect yielded disposers
        if (result && typeof result[Symbol.iterator] === 'function') {
          for (const item of result) {
            if (typeof item === 'function') {
              fiber.registerDisposer(item);
            }
          }
        } else if (typeof result === 'function') {
          fiber.registerDisposer(result);
        }
      }
    } else if (pluginDef && typeof (pluginDef as any).apply === 'function') {
      const result = (pluginDef as any).apply(childCtx, config);
      if (typeof result === 'function') {
        fiber.registerDisposer(result);
      }
    }

    this.plugins.set(pluginDef, fiber);
    return fiber;
  }

  /**
   * Event listener returning revertible disposer
   */
  public on(event: string, handler: EventHandler): Disposer {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    const set = this.events.get(event)!;
    set.add(handler);

    const disposer = () => {
      set.delete(handler);
      if (set.size === 0) {
        this.events.delete(event);
      }
    };

    this.fiber.registerDisposer(disposer);
    return disposer;
  }

  /**
   * Emit event across context hierarchy
   */
  public async emit(event: string, ...args: any[]): Promise<void> {
    const localSet = this.events.get(event);
    if (localSet) {
      for (const handler of Array.from(localSet)) {
        await handler(...args);
      }
    }
    for (const child of this.childContexts) {
      await child.emit(event, ...args);
    }
  }

  /**
   * Waterfall pipeline: pipes value through handlers
   */
  public async waterfall<T = any>(event: string, value: T, ...args: any[]): Promise<T> {
    let current = value;
    const localSet = this.events.get(event);
    if (localSet) {
      for (const handler of Array.from(localSet)) {
        current = await handler(current, ...args);
      }
    }
    return current;
  }

  /**
   * Unload context and all its fibers/effects
   */
  public async _unload(): Promise<void> {
    await this.fiber._unload();
    for (const child of Array.from(this.childContexts)) {
      await child._unload();
    }
    this.services.clear();
    this.events.clear();
  }
}

// ============================================================================
// Legacy PluginLedger Compatibility Facade
// ============================================================================

export enum PluginState {
  Registered = 'REGISTERED',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Failed = 'FAILED',
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  dependencies: string[];
  requiredCoeffects: string[];
}

export interface PluginContext {
  pluginId: string;
  coeffects: ReadonlyMap<string, unknown>;
  registerEffect(
    name: string,
    apply: () => Promise<void> | void,
    revert: () => Promise<void> | void,
  ): Promise<void>;
  hasCoeffect(name: string): boolean;
  getCoeffect<T>(name: string): T | undefined;
}

export interface PluginDefinition {
  meta: PluginMetadata;
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(ctx: PluginContext): Promise<void> | void;
}

export interface PluginLedgerEntry {
  meta: PluginMetadata;
  state: PluginState;
  activeEffectsCount: number;
  lastActivatedAt?: number;
}

export class PluginLedger {
  private rootContext = new LynxFitaContext();
  private pluginFibers = new Map<string, Fiber>();
  private definitions = new Map<string, PluginDefinition>();
  private states = new Map<string, PluginState>();
  private coeffectsMap = new Map<string, unknown>();

  public setCoeffect(name: string, value: unknown): void {
    this.coeffectsMap.set(name, value);
    this.rootContext[name] = value;
  }

  public getCoeffect<T>(name: string): T | undefined {
    return this.coeffectsMap.get(name) as T | undefined;
  }

  public registerPlugin(plugin: PluginDefinition): void {
    this.definitions.set(plugin.meta.id, plugin);
    this.states.set(plugin.meta.id, PluginState.Registered);
  }

  public async activatePlugin(id: string): Promise<boolean> {
    const plugin = this.definitions.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found in CORDIS ledger`);

    for (const dep of plugin.meta.dependencies || []) {
      if (this.states.get(dep) !== PluginState.Active) {
        throw new Error(`Cannot activate ${id}: dependency ${dep} is not active`);
      }
    }

    for (const coef of plugin.meta.requiredCoeffects || []) {
      if (!this.coeffectsMap.has(coef)) {
        this.states.set(id, PluginState.Suspended);
        return false;
      }
    }

    const childCtx = this.rootContext.isolate(id);
    const pCtx: PluginContext = {
      pluginId: id,
      coeffects: this.coeffectsMap,
      hasCoeffect: (name) => this.coeffectsMap.has(name),
      getCoeffect: (name) => this.coeffectsMap.get(name) as any,
      registerEffect: async (_name, apply, revert) => {
        await apply();
        childCtx.fiber.registerDisposer(revert);
      },
    };

    try {
      await plugin.activate(pCtx);
      this.pluginFibers.set(id, childCtx.fiber);
      this.states.set(id, PluginState.Active);
      return true;
    } catch (e) {
      await childCtx.fiber._unload();
      this.states.set(id, PluginState.Failed);
      throw e;
    }
  }

  public async deactivatePlugin(id: string): Promise<boolean> {
    const fiber = this.pluginFibers.get(id);
    if (!fiber) return false;
    await fiber._unload();
    this.pluginFibers.delete(id);
    this.states.set(id, PluginState.Registered);
    return true;
  }

  public getLedgerStatus(): PluginLedgerEntry[] {
    const entries: PluginLedgerEntry[] = [];
    for (const [id, def] of this.definitions.entries()) {
      const fiber = this.pluginFibers.get(id);
      entries.push({
        meta: def.meta,
        state: this.states.get(id) || PluginState.Registered,
        activeEffectsCount: fiber ? fiber.disposers.length : 0,
      });
    }
    return entries;
  }
}
