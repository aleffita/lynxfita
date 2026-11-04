export interface DirectJsiDispatcher {
  (module: string, method: string, params: unknown): unknown;
}

export interface PipeResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

declare global {
  var __lynxfita_jsi_dispatcher: DirectJsiDispatcher | undefined;
  var NativeModules: Record<string, any> | undefined;
}

export class BridgeInterceptor {
  private directHandlers = new Map<string, (params: unknown) => unknown>();
  private directCount = 0;
  private legacyCount = 0;

  constructor() {
    this.installGlobalHook();
  }

  public register(module: string, method: string, handler: (params: unknown) => unknown): void {
    const key = `${module}::${method}`;
    this.directHandlers.set(key, handler);
  }

  public has(module: string, method: string): boolean {
    return this.directHandlers.has(`${module}::${method}`);
  }

  public dispatch(module: string, method: string, params: unknown): PipeResponse {
    const key = `${module}::${method}`;
    const handler = this.directHandlers.get(key);

    if (handler) {
      this.directCount++;
      try {
        const result = handler(params);
        return {
          code: 0,
          data: result,
          msg: 'ok (direct JSI zero-copy)'
        };
      } catch (err: any) {
        return {
          code: -1,
          data: null,
          msg: `JSI execution error: ${err?.message || String(err)}`
        };
      }
    }

    // Fallback path to NativeModules legacy bridge
    this.legacyCount++;
    if (typeof globalThis.NativeModules !== 'undefined' && globalThis.NativeModules[module]) {
      const legacyMod = globalThis.NativeModules[module];
      if (typeof legacyMod[method] === 'function') {
        try {
          const ret = legacyMod[method](params);
          return {
            code: 0,
            data: ret,
            msg: 'ok (legacy json bridge fallback invocation)'
          };
        } catch (err: any) {
          return {
            code: -1,
            data: null,
            msg: `Legacy bridge execution error: ${err?.message || String(err)}`
          };
        }
      }
      return {
        code: -404,
        data: null,
        msg: `Legacy method not found: ${key}`
      };
    }

    return {
      code: -404,
      data: null,
      msg: `Method not found: ${key}`
    };
  }

  public getStats() {
    const total = this.directCount + this.legacyCount;
    return {
      directCount: this.directCount,
      legacyCount: this.legacyCount,
      bypassRatio: total > 0 ? this.directCount / total : 0
    };
  }

  private installGlobalHook(): void {
    globalThis.__lynxfita_jsi_dispatcher = (module: string, method: string, params: unknown) => {
      const res = this.dispatch(module, method, params);
      if (res.code !== 0) {
        throw new Error(res.msg);
      }
      return res.data;
    };
  }
}
