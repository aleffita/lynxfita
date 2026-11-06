/**
 * Cordis GenUI Service
 * Mounts A2UI surface manager onto LynxFitaContext ('ctx.genui').
 * Provides lifecycle management for dynamic agent surfaces and user action routing.
 */

import { Service, type LynxFitaContext } from '@lynxfita/core';
import { A2UiSurfaceRenderer } from './renderer.js';
import type { A2UiMessage, A2UiCatalog, A2UiUserAction } from './types.js';
import { LynxFitaCockpitCatalog } from './catalog.js';

export class GenUiService extends Service {
  public static provide = 'genui';
  public static inject = [];

  private surfaces: Map<string, A2UiSurfaceRenderer> = new Map();

  constructor(ctx: LynxFitaContext) {
    super(ctx, 'genui');
  }

  /**
   * Get or create an A2UI surface renderer.
   */
  public getOrCreateSurface(surfaceId: string, catalog: A2UiCatalog = LynxFitaCockpitCatalog): A2UiSurfaceRenderer {
    let surface = this.surfaces.get(surfaceId);
    if (!surface) {
      surface = new A2UiSurfaceRenderer(surfaceId, catalog);
      // Route actions to Cordis event bus
      surface.onAction((action: A2UiUserAction) => {
        this.ctx.emit('genui:action', action);
      });
      this.surfaces.set(surfaceId, surface);
    }
    return surface;
  }

  /**
   * Apply a stream of A2UI messages to target surface.
   */
  public applyMessages(messages: readonly A2UiMessage[]): void {
    for (const msg of messages) {
      const surface = this.getOrCreateSurface(msg.surfaceId);
      surface.applyMessage(msg);
    }
  }

  /**
   * Render target surface to HTML.
   */
  public renderSurfaceHtml(surfaceId: string, rootId = 'root'): string {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      return `<div class="a2ui-empty-surface" style="color: #6c7086; padding: 16px;">Surface '${surfaceId}' not found.</div>`;
    }
    return surface.renderHtml(rootId);
  }

  /**
   * Remove surface and dispose its resources.
   */
  public disposeSurface(surfaceId: string): void {
    this.surfaces.delete(surfaceId);
  }
}
