/**
 * Super-App Scheme Router Cordis Service
 * Supports URL scheme routing (lynxfita://miniapp/<id>?page=...) and stack navigation.
 */

import { Service, type LynxFitaContext } from './cordis.js';

export interface RouteEntry {
  url: string;
  scheme: string;
  miniappId: string;
  page: string;
  params: Record<string, string>;
  timestamp: number;
}

export class RouterService extends Service {
  public static provide = 'router';
  public static inject = [];

  private history: RouteEntry[] = [];
  private activeRoute: RouteEntry;

  constructor(ctx: LynxFitaContext, initialUrl = 'lynxfita://home') {
    super(ctx, 'router');
    this.activeRoute = this.parseUrl(initialUrl);
    this.history.push(this.activeRoute);
  }

  public parseUrl(url: string): RouteEntry {
    try {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(':', '');
      const miniappId = parsed.hostname || parsed.pathname.replace(/^\/+/, '').split('/')[0] || 'home';
      const page = parsed.searchParams.get('page') || 'index';
      const params: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => {
        params[k] = v;
      });

      return {
        url,
        scheme,
        miniappId,
        page,
        params,
        timestamp: Date.now()
      };
    } catch {
      // Fallback manual parser for non-standard URI schemes
      const match = url.match(/^([a-zA-Z0-9_-]+):\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?/);
      const scheme = match ? match[1]! : 'lynxfita';
      const host = match ? match[2]! : 'home';
      const path = match ? (match[3] || '') : '';
      const query = match ? (match[4] || '') : '';

      const miniappId = host === 'miniapp' ? path.split('/')[0] || 'home' : host;
      const params: Record<string, string> = {};
      if (query) {
        for (const part of query.split('&')) {
          const [k, v] = part.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      }

      return {
        url,
        scheme,
        miniappId,
        page: params['page'] || 'index',
        params,
        timestamp: Date.now()
      };
    }
  }

  public navigate(url: string): RouteEntry {
    const route = this.parseUrl(url);
    this.history.push(route);
    this.activeRoute = route;
    this.ctx.emit('router:navigate', route);
    return route;
  }

  public back(): RouteEntry | undefined {
    if (this.history.length <= 1) {
      return undefined;
    }
    const previous = this.history.pop()!;
    this.activeRoute = this.history[this.history.length - 1]!;
    this.ctx.emit('router:back', { from: previous, to: this.activeRoute });
    return this.activeRoute;
  }

  public getCurrentRoute(): RouteEntry {
    return this.activeRoute;
  }

  public getHistory(): readonly RouteEntry[] {
    return this.history;
  }
}
