/**
 * Super-App Navigation Manager
 * Stack-based routing supporting lynxfita:// URI schemes.
 */

export interface NavigationRoute {
  scheme: string;
  host: string;
  path: string;
  url: string;
  query: Record<string, string>;
  title: string;
}

export type NavigationListener = (route: NavigationRoute, previousRoute?: NavigationRoute) => void;

export class SuperAppNavigator {
  private stack: NavigationRoute[] = [];
  private listeners = new Set<NavigationListener>();

  constructor(initialUrl = 'lynxfita://home') {
    this.navigate(initialUrl, 'Home');
  }

  public parseUrl(url: string, title?: string): NavigationRoute {
    try {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(':', '');
      const host = parsed.hostname || parsed.pathname.replace(/^\/+/, '').split('/')[0] || 'home';
      const path = parsed.pathname;
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => { query[k] = v; });

      const autoTitle = title || (host === 'miniapp' ? path.replace(/^\/+/, '') : host);
      return { scheme, host, path, url, query, title: autoTitle };
    } catch {
      const match = url.match(/^([a-zA-Z0-9_-]+):\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([^#]*))?/);
      const scheme = match ? match[1]! : 'lynxfita';
      const host = match ? match[2]! : 'home';
      const path = match ? (match[3] ? `/${match[3]}` : '') : '';
      const queryStr = match ? (match[4] || '') : '';
      const query: Record<string, string> = {};
      if (queryStr) {
        for (const pair of queryStr.split('&')) {
          const [k, v] = pair.split('=');
          if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
      }
      return {
        scheme,
        host,
        path,
        url,
        query,
        title: title || (host === 'miniapp' ? path.replace(/^\/+/, '') : host)
      };
    }
  }

  public navigate(url: string, title?: string): NavigationRoute {
    const prev = this.getCurrentRoute();
    const route = this.parseUrl(url, title);
    this.stack.push(route);
    this.notify(route, prev);
    return route;
  }

  public back(): NavigationRoute | undefined {
    if (this.stack.length <= 1) {
      return undefined;
    }
    const popped = this.stack.pop()!;
    const current = this.getCurrentRoute()!;
    this.notify(current, popped);
    return current;
  }

  public getCurrentRoute(): NavigationRoute | undefined {
    return this.stack[this.stack.length - 1];
  }

  public getStack(): readonly NavigationRoute[] {
    return this.stack;
  }

  public canGoBack(): boolean {
    return this.stack.length > 1;
  }

  public addListener(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(route: NavigationRoute, prev?: NavigationRoute): void {
    for (const listener of this.listeners) {
      listener(route, prev);
    }
  }
}
