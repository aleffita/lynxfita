import type { BundleManifest } from './bundle_packager.js';

export interface ModuleFederationManifest {
  scope: string;
  name: string;
  remotes: Record<string, string>;
  shared: Record<string, { singleton: boolean; requiredVersion: string }>;
  bundles: BundleManifest[];
  generatedAt: string;
}

export class FederationManifestGenerator {
  public static generateFederationConfig(
    appName: string,
    remotes: Record<string, string> = {},
    bundles: BundleManifest[] = []
  ): ModuleFederationManifest {
    return {
      scope: `@lynxfita/${appName}`,
      name: appName,
      remotes,
      shared: {
        '@lynxfita/core': { singleton: true, requiredVersion: '^0.1.0' },
        '@lynxfita/wasi-runtime': { singleton: true, requiredVersion: '^0.1.0' }
      },
      bundles,
      generatedAt: new Date().toISOString()
    };
  }
}
