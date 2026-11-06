/**
 * A2UI (Agent-to-UI) v0.9 Protocol Specification Types
 * Aligned with Google / ByteDance Lynx GenUI standard.
 * Declarative, flat-graph, catalog-constrained agent UI protocol.
 */

export type A2UiVersion = 'v0.9';

export interface A2UiCreateSurfaceMessage {
  readonly version: A2UiVersion;
  readonly type: 'createSurface';
  readonly surfaceId: string;
  readonly catalogId: string;
}

export interface A2UiUpdateDataModelMessage {
  readonly version: A2UiVersion;
  readonly type: 'updateDataModel';
  readonly surfaceId: string;
  readonly path?: string;
  readonly data: Record<string, unknown>;
}

export interface A2UiComponent {
  readonly id: string;
  readonly type: string;
  readonly props?: Record<string, unknown>;
  readonly bindings?: Record<string, string>;
  readonly children?: readonly string[];
  readonly actions?: Record<string, { action: string; payload?: Record<string, unknown> }>;
}

export interface A2UiUpdateComponentsMessage {
  readonly version: A2UiVersion;
  readonly type: 'updateComponents';
  readonly surfaceId: string;
  readonly components: readonly A2UiComponent[];
}

export type A2UiMessage =
  | A2UiCreateSurfaceMessage
  | A2UiUpdateDataModelMessage
  | A2UiUpdateComponentsMessage;

export interface A2UiUserAction {
  readonly surfaceId: string;
  readonly componentId: string;
  readonly action: string;
  readonly payload?: Record<string, unknown>;
}

export interface A2UiCatalogEntry {
  readonly type: string;
  readonly description: string;
  readonly properties: Record<string, {
    readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    readonly description?: string;
    readonly required?: boolean;
    readonly enum?: readonly string[];
  }>;
  readonly actions?: readonly string[];
}

export interface A2UiCatalog {
  readonly catalogId: string;
  readonly version: string;
  readonly components: Record<string, A2UiCatalogEntry>;
}
