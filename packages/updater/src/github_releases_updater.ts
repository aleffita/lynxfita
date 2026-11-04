import { createHash } from 'node:crypto';

export interface ReleaseAsset {
  name: string;
  url: string;
  sha256: string;
  sizeBytes: number;
}

export interface ReleaseInfo {
  version: string;
  tagName: string;
  publishedAt: string;
  assets: ReleaseAsset[];
  notes: string;
}

export class GitHubReleasesUpdater {
  private repoOwner: string;
  private repoName: string;
  private currentVersion: string;

  constructor(repoOwner = 'aleffita', repoName = 'lynxfita', currentVersion = '0.1.0') {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.currentVersion = currentVersion;
  }

  public checkForUpdates(latestReleaseMock?: ReleaseInfo): { hasUpdate: boolean; release?: ReleaseInfo } {
    const release = latestReleaseMock || {
      version: '1.0.0',
      tagName: 'v1.0.0',
      publishedAt: new Date().toISOString(),
      assets: [
        {
          name: 'lynxfita-windows-x64-v1.0.0.zip',
          url: `https://github.com/${this.repoOwner}/${this.repoName}/releases/download/v1.0.0/lynxfita-windows-x64-v1.0.0.zip`,
          sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          sizeBytes: 15420000
        }
      ],
      notes: 'v1.0.0 GA: Cell EIB DMA stationary buffers, CORDIS composability, zero-GIL coroutines & Protobuf bridge'
    };

    const hasUpdate = release.version !== this.currentVersion;
    return { hasUpdate, release };
  }

  public verifyDownloadedAsset(assetData: Uint8Array, expectedSha256: string): boolean {
    if (!expectedSha256 || expectedSha256.length !== 64) {
      return false;
    }
    const actual = createHash('sha256').update(assetData).digest('hex');
    return actual.toLowerCase() === expectedSha256.toLowerCase();
  }
}
