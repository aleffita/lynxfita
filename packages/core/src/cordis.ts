/**
 * CORDIS: Spatiotemporal Composability Framework for Plugins
 * Based on arXiv:2608.25512 (A Programming Paradigm for Spatiotemporal Composability)
 * - Temporal Composability: Revertible effects with runtime-managed inverses
 * - Spatial Composability: Reactive coeffects dynamically driving component activation
 */

export interface RevertibleEffect {
  name: string;
  appliedAt: number;
  revert: () => Promise<void> | void;
}

export type CoeffectMap = Map<string, unknown>;

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
  registerEffect(name: string, apply: () => Promise<void> | void, revert: () => Promise<void> | void): Promise<void>;
  hasCoeffect(name: string): boolean;
  getCoeffect<T>(name: string): T | undefined;
}

export interface PluginDefinition {
  meta: PluginMetadata;
  activate(ctx: PluginContext): Promise<void> | void;
  deactivate?(ctx: PluginContext): Promise<void> | void;
}

export enum PluginState {
  Registered = 'REGISTERED',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Failed = 'FAILED'
}

export interface PluginLedgerEntry {
  meta: PluginMetadata;
  state: PluginState;
  activeEffectsCount: number;
  lastActivatedAt?: number;
}

export class PluginLedger {
  private plugins = new Map<string, PluginDefinition>();
  private pluginStates = new Map<string, PluginState>();
  private effectStacks = new Map<string, RevertibleEffect[]>();
  private coeffects: CoeffectMap = new Map();
  private activationHistory: string[] = [];

  constructor() {}

  public setCoeffect(name: string, value: unknown): void {
    this.coeffects.set(name, value);
    // Reactively evaluate pending plugins whose coeffects might now be satisfied
    this.reconcileCoeffects();
  }

  public getCoeffect<T>(name: string): T | undefined {
    return this.coeffects.get(name) as T | undefined;
  }

  public registerPlugin(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.meta.id)) {
      throw new Error(`Plugin ${plugin.meta.id} is already registered in CORDIS ledger`);
    }
    this.plugins.set(plugin.meta.id, plugin);
    this.pluginStates.set(plugin.meta.id, PluginState.Registered);
    this.effectStacks.set(plugin.meta.id, []);
  }

  public async activatePlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new Error(`Plugin ${id} not found in CORDIS ledger`);
    }

    // 1. Verify dependencies are active
    for (const depId of plugin.meta.dependencies) {
      if (this.pluginStates.get(depId) !== PluginState.Active) {
        throw new Error(`Cannot activate ${id}: dependency ${depId} is not active`);
      }
    }

    // 2. Verify spatial coeffects are satisfied
    for (const coef of plugin.meta.requiredCoeffects) {
      if (!this.coeffects.has(coef)) {
        this.pluginStates.set(id, PluginState.Suspended);
        return false;
      }
    }

    // 3. Create Plugin Context with revertible effect tracker
    const effectStack = this.effectStacks.get(id) || [];
    const ctx: PluginContext = {
      pluginId: id,
      coeffects: this.coeffects,
      hasCoeffect: (name: string) => this.coeffects.has(name),
      getCoeffect: <T>(name: string) => this.coeffects.get(name) as T | undefined,
      registerEffect: async (name, apply, revert) => {
        await apply();
        effectStack.push({
          name,
          appliedAt: Date.now(),
          revert
        });
      }
    };

    try {
      await plugin.activate(ctx);
      this.pluginStates.set(id, PluginState.Active);
      this.activationHistory.push(id);
      return true;
    } catch (err) {
      this.pluginStates.set(id, PluginState.Failed);
      // Clean rollback of any partial effects registered before failure
      await this.rollbackEffects(id);
      throw err;
    }
  }

  public async deactivatePlugin(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin || this.pluginStates.get(id) !== PluginState.Active) {
      return false;
    }

    // 1. Deactivate any dependent plugins first
    for (const [otherId, otherPlugin] of this.plugins.entries()) {
      if (otherPlugin.meta.dependencies.includes(id) && this.pluginStates.get(otherId) === PluginState.Active) {
        await this.deactivatePlugin(otherId);
      }
    }

    // 2. Call plugin optional deactivate hook
    if (plugin.deactivate) {
      const ctx: PluginContext = {
        pluginId: id,
        coeffects: this.coeffects,
        hasCoeffect: (name) => this.coeffects.has(name),
        getCoeffect: <T>(name: string) => this.coeffects.get(name) as T | undefined,
        registerEffect: async () => { throw new Error('Cannot register effects during deactivation'); }
      };
      await plugin.deactivate(ctx);
    }

    // 3. Rollback all revertible effects in LIFO order (Temporal Inversion)
    await this.rollbackEffects(id);

    this.pluginStates.set(id, PluginState.Registered);
    return true;
  }

  public async hotReloadPlugin(id: string, newDefinition: PluginDefinition): Promise<boolean> {
    const wasActive = this.pluginStates.get(id) === PluginState.Active;
    if (wasActive) {
      await this.deactivatePlugin(id);
    }
    this.plugins.set(id, newDefinition);
    if (wasActive) {
      return await this.activatePlugin(id);
    }
    return true;
  }

  public getLedgerStatus(): PluginLedgerEntry[] {
    const entries: PluginLedgerEntry[] = [];
    for (const [id, plugin] of this.plugins.entries()) {
      entries.push({
        meta: plugin.meta,
        state: this.pluginStates.get(id) || PluginState.Registered,
        activeEffectsCount: (this.effectStacks.get(id) || []).length
      });
    }
    return entries;
  }

  private async rollbackEffects(id: string): Promise<void> {
    const stack = this.effectStacks.get(id) || [];
    while (stack.length > 0) {
      const effect = stack.pop();
      if (effect) {
        try {
          await effect.revert();
        } catch (e) {
          console.error(`[CORDIS] Warning: error reverting effect ${effect.name} for plugin ${id}:`, e);
        }
      }
    }
  }

  private reconcileCoeffects(): void {
    for (const [id, plugin] of this.plugins.entries()) {
      const state = this.pluginStates.get(id);
      if (state === PluginState.Suspended) {
        const canActivate = plugin.meta.requiredCoeffects.every(c => this.coeffects.has(c));
        if (canActivate) {
          this.activatePlugin(id).catch(() => {});
        }
      }
    }
  }
}
