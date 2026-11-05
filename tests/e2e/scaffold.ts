/**
 * Hermetic E2E Test Scaffold for LynxFita Explorer and Mini-Apps
 * Modeled on DeepSeek-Harness web test scaffold and support architecture.
 *
 * Provides:
 * - Ephemeral port server startup (port 0)
 * - Platform Chromium / Chrome resolution
 * - Headless Playwright browser context with video recording
 * - LIFO teardown with hard timeout guard
 * - Video / GIF artifact generation via ffmpeg
 */

import { existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { startExplorerServer } from '@lynxfita/explorer';

export interface E2EScaffoldOptions {
  recordVideo?: boolean;
  videoDir?: string;
  viewport?: { width: number; height: number };
}

export interface E2EScaffold {
  port: number;
  baseUrl: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
  getVideoPath: () => Promise<string | null>;
}

/**
 * Resolves the Chromium/Chrome executable path across Windows, macOS, and Linux.
 * Checks environment overrides first (CHROME_PATH, CHROMIUM_PATH, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH),
 * then system installation paths, returning undefined if none exist to allow Playwright's bundled binary.
 */
export function resolveChromiumExecutable(): string | undefined {
  const envCandidates = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ];
  for (const candidate of envCandidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  const candidates: string[] = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    // Linux / BSD
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Resolves the ffmpeg executable from FFMPEG_PATH, Playwright cache, or system PATH.
 */
export function resolveFfmpegExecutable(): string {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  // Prefer system ffmpeg on PATH (which has full libx264 and filter support)
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    // Fall through to search local ms-playwright or candidate directories
  }

  // Check Playwright's bundled ffmpeg if present
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const pwDir = join(localAppData, 'ms-playwright');
    if (existsSync(pwDir)) {
      try {
        const entries = readdirSync(pwDir);
        for (const entry of entries) {
          if (entry.startsWith('ffmpeg-')) {
            const candidate = join(pwDir, entry, 'ffmpeg-win64.exe');
            if (existsSync(candidate)) return candidate;
          }
        }
      } catch {
        // Ignored
      }
    }
  }

  return 'ffmpeg';
}

/**
 * Boots the Explorer HTTP server on port 0 and launches a headless Chromium instance.
 */
export async function launchE2EScaffold(options: E2EScaffoldOptions = {}): Promise<E2EScaffold> {
  const server = await startExplorerServer(0);
  const port = server.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const executablePath = resolveChromiumExecutable();
  const launchOptions: { headless: boolean; executablePath?: string; args?: string[] } = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  let browser: Browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (err: any) {
    await server.close().catch(() => {});
    throw new Error(
      `Failed to launch Chromium browser (executablePath: ${executablePath || 'Playwright default'}). ` +
      `Ensure Chrome/Chromium is installed or run 'pnpm exec playwright-core install chromium'. Cause: ${err?.message || err}`
    );
  }

  const videoDir = options.videoDir || resolve(process.cwd(), 'test-results', 'videos');
  if (options.recordVideo !== false) {
    mkdirSync(videoDir, { recursive: true });
  }

  const viewport = options.viewport || { width: 1280, height: 820 };
  const contextOptions: {
    viewport: { width: number; height: number };
    recordVideo?: { dir: string; size: { width: number; height: number } };
  } = {
    viewport
  };
  if (options.recordVideo !== false) {
    contextOptions.recordVideo = {
      dir: videoDir,
      size: viewport
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const videoHandle = page.video();

  let closed = false;
  let savedVideoPath: string | null = null;

  const close = async () => {
    if (closed) return;
    closed = true;

    // Hard timeout guard for LIFO teardown (5000ms max)
    const teardownTimer = setTimeout(() => {
      console.warn('Scaffold teardown timed out after 5000ms');
    }, 5000);

    try {
      // Clean LIFO teardown: context.close() flushes Playwright's recorded video
      await context.close().catch(e => console.warn('Error closing context:', e));

      // After context is closed, videoHandle.path() resolves immediately in headless mode
      if (videoHandle) {
        try {
          savedVideoPath = await videoHandle.path();
        } catch {
          savedVideoPath = null;
        }
      }

      await browser.close().catch(e => console.warn('Error closing browser:', e));
      await server.close().catch(e => console.warn('Error closing server:', e));
    } finally {
      clearTimeout(teardownTimer);
    }
  };

  const getVideoPath = async (): Promise<string | null> => {
    if (closed) {
      return savedVideoPath && existsSync(savedVideoPath) ? savedVideoPath : null;
    }
    if (savedVideoPath && existsSync(savedVideoPath)) {
      return savedVideoPath;
    }
    if (videoHandle) {
      try {
        const p = await videoHandle.path();
        if (p && existsSync(p)) return p;
      } catch {
        // Ignored
      }
    }
    return null;
  };

  return {
    port,
    baseUrl,
    browser,
    context,
    page,
    close,
    getVideoPath
  };
}

/**
 * Converts a recorded WebM video into an MP4 video and a palette-optimized GIF.
 */
export function convertVideoToArtifacts(webmPath: string, mp4Path: string, gifPath: string): boolean {
  if (!existsSync(webmPath)) {
    return false;
  }
  try {
    const stat = statSync(webmPath);
    if (stat.size < 500) {
      console.warn(`WebM video ${webmPath} too small (${stat.size} bytes), skipping conversion`);
      return false;
    }

    const mp4Dir = dirname(mp4Path);
    if (!existsSync(mp4Dir)) {
      mkdirSync(mp4Dir, { recursive: true });
    }
    const gifDir = dirname(gifPath);
    if (!existsSync(gifDir)) {
      mkdirSync(gifDir, { recursive: true });
    }

    const ffmpegBin = resolveFfmpegExecutable();

    // 1. Convert to MP4 (H.264, yuv420p)
    execFileSync(ffmpegBin, [
      '-nostdin',
      '-y',
      '-i', webmPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', 'faststart',
      mp4Path
    ], { stdio: 'pipe' });

    // 2. Convert to palette-optimized GIF
    execFileSync(ffmpegBin, [
      '-nostdin',
      '-y',
      '-i', webmPath,
      '-filter_complex', '[0:v] fps=10,scale=1200:-1:flags=lanczos,split [a][b];[a] palettegen=max_colors=128 [p];[b][p] paletteuse=dither=bayer:bayer_scale=3',
      gifPath
    ], { stdio: 'pipe' });

    return true;
  } catch (err) {
    console.warn('ffmpeg artifact generation failed:', err);
    return false;
  }
}
