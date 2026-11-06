/**
 * A2UI v0.9 Runtime & Surface Renderer
 * Incrementally consumes A2UI messages, validates against active Catalog,
 * resolves reactive data model bindings, and generates declarative Lynx AST and HTML.
 */

import type {
  A2UiMessage,
  A2UiComponent,
  A2UiCatalog,
  A2UiUserAction,
} from './types.js';
import { LynxFitaCockpitCatalog } from './catalog.js';

export interface ResolvedA2UiNode {
  readonly id: string;
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly ResolvedA2UiNode[];
  readonly actions?: Record<string, { action: string; payload?: Record<string, unknown> }>;
}

export type A2UiActionHandler = (action: A2UiUserAction) => Promise<void> | void;

export class A2UiSurfaceRenderer {
  public readonly surfaceId: string;
  public readonly catalog: A2UiCatalog;

  private dataModel: Record<string, unknown> = {};
  private components: Map<string, A2UiComponent> = new Map();
  private actionHandlers: Set<A2UiActionHandler> = new Set();
  private rootId = 'root';

  constructor(surfaceId: string, catalog: A2UiCatalog = LynxFitaCockpitCatalog) {
    this.surfaceId = surfaceId;
    this.catalog = catalog;
  }

  public getDataModel(): Readonly<Record<string, unknown>> {
    return this.dataModel;
  }

  public getComponent(id: string): A2UiComponent | undefined {
    return this.components.get(id);
  }

  public onAction(handler: A2UiActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => this.actionHandlers.delete(handler);
  }

  /**
   * Incrementally apply a stream of A2UI messages.
   */
  public applyMessage(msg: A2UiMessage): void {
    if (msg.version !== 'v0.9') {
      throw new Error(`Unsupported A2UI message version: ${(msg as { version?: string }).version} (expected v0.9)`);
    }

    if (msg.surfaceId !== this.surfaceId) {
      return;
    }

    switch (msg.type) {
      case 'createSurface': {
        this.dataModel = {};
        this.components.clear();
        break;
      }
      case 'updateDataModel': {
        if (msg.path) {
          this.setNestedValue(this.dataModel, msg.path, msg.data);
        } else {
          this.dataModel = { ...this.dataModel, ...msg.data };
        }
        break;
      }
      case 'updateComponents': {
        for (const comp of msg.components) {
          this.validateComponentAgainstCatalog(comp);
          this.components.set(comp.id, comp);
        }
        break;
      }
    }
  }

  /**
   * Dispatch an interactive user action back to registered listeners.
   */
  public async dispatchAction(componentId: string, actionKey = 'onPress', extraPayload?: Record<string, unknown>): Promise<void> {
    const comp = this.components.get(componentId);
    if (!comp || !comp.actions || !comp.actions[actionKey]) {
      return;
    }

    const def = comp.actions[actionKey];
    const userAction: A2UiUserAction = {
      surfaceId: this.surfaceId,
      componentId,
      action: def.action,
      payload: { ...def.payload, ...extraPayload },
    };

    for (const handler of this.actionHandlers) {
      await handler(userAction);
    }
  }

  /**
   * Resolve component tree with data model bindings.
   */
  public resolveTree(nodeId: string = this.rootId): ResolvedA2UiNode | null {
    const comp = this.components.get(nodeId);
    if (!comp) {
      return null;
    }

    const resolvedProps: Record<string, unknown> = { ...(comp.props || {}) };

    if (comp.bindings) {
      for (const [propKey, modelPath] of Object.entries(comp.bindings)) {
        const val = this.getNestedValue(this.dataModel, modelPath);
        if (val !== undefined) {
          resolvedProps[propKey] = val;
        }
      }
    }

    const children: ResolvedA2UiNode[] = [];
    if (comp.children) {
      for (const childId of comp.children) {
        const childNode = this.resolveTree(childId);
        if (childNode) {
          children.push(childNode);
        }
      }
    }

    return {
      id: comp.id,
      type: comp.type,
      props: resolvedProps,
      children,
      actions: comp.actions,
    };
  }

  /**
   * Render resolved component tree to HTML for Super-App Explorer web view.
   */
  public renderHtml(nodeId: string = this.rootId): string {
    const tree = this.resolveTree(nodeId);
    if (!tree) {
      return '<div class="a2ui-empty-surface" style="color: #6c7086; font-style: italic; padding: 16px;">[A2UI Surface: No components mounted]</div>';
    }
    return this.renderNodeHtml(tree);
  }

  private renderNodeHtml(node: ResolvedA2UiNode): string {
    const p = node.props;
    const childrenHtml = node.children.map(c => this.renderNodeHtml(c)).join('');

    switch (node.type) {
      case 'Container': {
        const dir = p.direction === 'row' ? 'row' : 'column';
        const gap = typeof p.gap === 'number' ? p.gap : 12;
        const pad = typeof p.padding === 'number' ? p.padding : 0;
        return `<div class="a2ui-container" id="a2ui-${node.id}" style="display: flex; flex-direction: ${dir}; gap: ${gap}px; padding: ${pad}px;">${childrenHtml}</div>`;
      }
      case 'Card': {
        const title = String(p.title || '');
        const subtitle = p.subtitle ? `<div style="color: #a6adc8; font-size: 12px; margin-top: 2px;">${escapeHtml(String(p.subtitle))}</div>` : '';
        const accent = p.accentColor ? `border-left: 3px solid ${p.accentColor};` : '';
        return `
          <div class="a2ui-card" id="a2ui-${node.id}" style="background: #181825; border: 1px solid #313244; border-radius: 8px; padding: 16px; margin-bottom: 12px; ${accent}">
            <div style="font-weight: 700; color: #cdd6f4; font-size: 15px;">${escapeHtml(title)}</div>
            ${subtitle}
            <div style="margin-top: 12px;">${childrenHtml}</div>
          </div>
        `;
      }
      case 'Metric': {
        const label = escapeHtml(String(p.label || ''));
        const val = escapeHtml(String(p.value || ''));
        const unit = p.unit ? `<span style="font-size: 12px; color: #a6adc8; margin-left: 4px;">${escapeHtml(String(p.unit))}</span>` : '';
        const color = p.color ? String(p.color) : '#89b4fa';
        return `
          <div class="a2ui-metric" id="a2ui-${node.id}" style="background: #11111b; border: 1px solid #313244; border-radius: 6px; padding: 12px; flex: 1;">
            <div style="font-size: 11px; text-transform: uppercase; color: #6c7086; font-weight: 600;">${label}</div>
            <div style="font-size: 22px; font-weight: 800; color: ${color}; margin-top: 4px;">${val}${unit}</div>
          </div>
        `;
      }
      case 'Button': {
        const label = escapeHtml(String(p.label || 'Action'));
        const variant = String(p.variant || 'primary');
        const bg = variant === 'primary' ? '#89b4fa' : variant === 'danger' ? '#f38ba8' : '#313244';
        const fg = variant === 'primary' || variant === 'danger' ? '#11111b' : '#cdd6f4';
        const actionAttr = node.actions?.onPress ? `data-a2ui-action="${node.id}"` : '';
        return `
          <button class="a2ui-button" id="a2ui-${node.id}" ${actionAttr} style="background: ${bg}; color: ${fg}; border: none; border-radius: 6px; padding: 8px 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;">
            ${label}
          </button>
        `;
      }
      case 'StatusBadge': {
        const text = escapeHtml(String(p.text || ''));
        const variant = String(p.variant || 'info');
        const bg = variant === 'success' ? '#a6e3a122' : variant === 'warning' ? '#f9e2af22' : variant === 'error' ? '#f38ba822' : '#89b4fa22';
        const fg = variant === 'success' ? '#a6e3a1' : variant === 'warning' ? '#f9e2af' : variant === 'error' ? '#f38ba8' : '#89b4fa';
        return `
          <span class="a2ui-badge" id="a2ui-${node.id}" style="display: inline-flex; align-items: center; background: ${bg}; color: ${fg}; border: 1px solid ${fg}44; border-radius: 12px; padding: 3px 10px; font-size: 11px; font-weight: 600;">
            ${text}
          </span>
        `;
      }
      case 'MemorySlotView': {
        const hex = escapeHtml(String(p.offsetHex || '0x0000'));
        const bytes = Number(p.lengthBytes || 0);
        const desc = p.description ? `<div style="color: #6c7086; font-size: 11px;">${escapeHtml(String(p.description))}</div>` : '';
        return `
          <div class="a2ui-memslot" id="a2ui-${node.id}" style="background: #11111b; border: 1px dashed #45475a; border-radius: 6px; padding: 10px; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; color: #a6e3a1; font-weight: 700;">
              <span>Slot ${hex}</span>
              <span>${bytes} Bytes</span>
            </div>
            ${desc}
          </div>
        `;
      }
      case 'DagNode': {
        const nodeIdStr = escapeHtml(String(p.nodeId || ''));
        const author = escapeHtml(String(p.author || ''));
        const round = Number(p.round || 0);
        const consensus = p.isConsensus ? '<span style="color: #a6e3a1;">[Consensus]</span>' : '<span style="color: #f9e2af;">[Pending]</span>';
        return `
          <div class="a2ui-dagnode" id="a2ui-${node.id}" style="background: #181825; border: 1px solid #313244; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
            <div style="font-weight: 700; color: #cdd6f4;">${nodeIdStr} ${consensus}</div>
            <div style="color: #a6adc8; font-size: 11px;">Round ${round} &bull; Author: ${author}</div>
          </div>
        `;
      }
      case 'CodeBlock': {
        const code = escapeHtml(String(p.code || ''));
        return `
          <pre class="a2ui-code" id="a2ui-${node.id}" style="background: #11111b; color: #cdd6f4; border: 1px solid #313244; border-radius: 6px; padding: 10px; font-size: 11px; overflow-x: auto;"><code>${code}</code></pre>
        `;
      }
      default:
        return `<div class="a2ui-unknown" style="color: #f38ba8;">[Unknown Component: ${escapeHtml(node.type)}]</div>`;
    }
  }

  private validateComponentAgainstCatalog(comp: A2UiComponent): void {
    const entry = this.catalog.components[comp.type];
    if (!entry) {
      throw new Error(`Component type '${comp.type}' (id: ${comp.id}) is not defined in active A2UI Catalog '${this.catalog.catalogId}'`);
    }

    if (entry.properties) {
      for (const [propName, propDef] of Object.entries(entry.properties)) {
        if (propDef.required) {
          const hasProp = comp.props && comp.props[propName] !== undefined;
          const hasBinding = comp.bindings && comp.bindings[propName] !== undefined;
          if (!hasProp && !hasBinding) {
            throw new Error(`Required property '${propName}' missing for component '${comp.id}' of type '${comp.type}'`);
          }
        }
      }
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let curr: unknown = obj;
    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in (curr as Record<string, unknown>)) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return curr;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, val: unknown): void {
    const parts = path.split('.');
    let curr: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!(p in curr) || typeof curr[p] !== 'object' || curr[p] === null) {
        curr[p] = {};
      }
      curr = curr[p] as Record<string, unknown>;
    }
    curr[parts[parts.length - 1]] = val;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
