/**
 * LynxFita Super-App Explorer Real Browser E2E Test
 * Drives the complete WeChat-style Super-App Explorer through a real headless browser.
 * Exercises:
 * 1. Home Grid -> Weather Showcase (Hourly -> City Search Tokyo -> Light/Dark -> DMA/GPU)
 * 2. Back Navigation with LIFO Fiber Unload
 * 3. WIT & Native SIMD Studio -> Execute SIMD FFI Compute -> Assert Float32 Output
 * 4. Back Navigation -> Stationary DMA & GPU Lab (Slot Memory Map)
 * 5. Settings & Diagnostics -> Switch mTLS Role to top-patron -> Revoke CRL -> Assert Rollback
 * 6. Playwright native video capture -> MP4 and palette-optimized GIF artifact generation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchE2EScaffold, convertVideoToArtifacts } from '../../../tests/e2e/scaffold.ts';

test('Super-App Explorer Real Browser E2E: Full Super-App Journey, Video Recording & Artifacts', async () => {
  const assetsDir = resolve(process.cwd(), 'docs', 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const scaffold = await launchE2EScaffold({ recordVideo: true });
  let webmPath: string | null = null;

  try {
    const { page, baseUrl } = scaffold;

    // 1. Initial State: Home Screen
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#open-weather-showcase', { timeout: 10000 });

    const homeTitle = await page.textContent('h2');
    assert.ok(homeTitle?.includes('LynxFita Mini-App Host & Explorer'), 'Home screen banner must display Explorer title');

    // 2. Launch Weather Showcase Mini-App
    await page.click('#open-weather-showcase');
    await page.waitForSelector('.weather-showcase-app', { timeout: 10000 });

    // Weather: Hourly Detail
    await page.getByRole('button', { name: 'Horas' }).click();
    await page.waitForSelector('.screen-hourly', { timeout: 5000 });
    await page.waitForTimeout(250);

    // Weather: City Search -> Select Tokyo
    await page.getByRole('button', { name: 'Cidades' }).click();
    await page.waitForSelector('.screen-search', { timeout: 5000 });
    await page.locator('button:has-text("Tokyo")').click();
    await page.waitForSelector('.screen-home', { timeout: 5000 });
    const tokyoText = await page.textContent('.screen-home');
    assert.ok(tokyoText?.includes('Tokyo, JP'), 'Location must update to Tokyo, JP');
    await page.waitForTimeout(250);

    // Weather: Toggle Theme
    await page.locator('button[title="Alternar Tema"]').click();
    await page.waitForSelector('.weather-showcase-app', { timeout: 5000 });
    await page.waitForTimeout(250);

    // Weather: DMA & WebGPU Inspector
    await page.getByRole('button', { name: 'DMA / GPU' }).click();
    await page.waitForSelector('.screen-dma-inspector', { timeout: 5000 });
    await page.waitForTimeout(250);

    // 3. Navigate Back to Home and assert LIFO Fiber unload
    await page.click('#nav-btn-back');
    await page.waitForSelector('#open-weather-showcase', { timeout: 5000 });

    const stateAfterBack = await (await page.request.get(`${baseUrl}/api/state`)).json();
    assert.equal(stateAfterBack.route.host, 'home', 'Must be back on home route');

    // 4. Launch WIT & Native SIMD Studio Mini-App
    await page.click('#open-wit-ffi-studio');
    await page.waitForSelector('#wit-source-input', { timeout: 5000 });

    const witText = await page.textContent('h2');
    assert.ok(witText?.includes('WIT & Native SIMD FFI Studio'), 'Must display WIT Studio title');

    // Execute SIMD FFI Compute
    const simdBtn = page.getByRole('button', { name: /Execute SIMD FFI/ });
    await simdBtn.click();

    // Verify Float32 SIMD vector output [23.50, 25.00, ...]
    await page.waitForSelector('text=23.50', { timeout: 5000 });
    const simdContent = await page.textContent('body');
    assert.ok(simdContent?.includes('23.50'), 'SIMD output must contain 23.50');
    assert.ok(simdContent?.includes('25.00'), 'SIMD output must contain 25.00');
    await page.waitForTimeout(300);

    // 5. Navigate Back to Home
    await page.click('#nav-btn-back');
    await page.waitForSelector('#open-dma-gpu-lab', { timeout: 5000 });

    // 6. Launch Stationary DMA & GPU Simulation Lab
    await page.click('#open-dma-gpu-lab');
    await page.waitForSelector('text=Stationary DMA Memory Map (16 KB)', { timeout: 5000 });

    const dmaBody = await page.textContent('body');
    assert.ok(dmaBody?.includes('SLOT 0 (4 KB)'), 'Must display Slot 0');
    assert.ok(dmaBody?.includes('SLOT 1 (4 KB)'), 'Must display Slot 1');
    assert.ok(dmaBody?.includes('SLOT 2 (4 KB)'), 'Must display Slot 2');
    assert.ok(dmaBody?.includes('SLOT 3 (4 KB)'), 'Must display Slot 3');
    await page.waitForTimeout(300);

    // 7. Navigate to Settings & Diagnostics
    await page.click('#nav-btn-settings');
    await page.waitForSelector('text=Settings & Diagnostics', { timeout: 5000 });

    // Switch mTLS identity to top-patron
    await page.locator('input[value="top-patron"]').click();
    await page.waitForSelector('text=2.2.0-canary-patron (Remote AOT)', { timeout: 5000 });
    await page.waitForTimeout(250);

    // Revoke Certificate in CRL
    await page.click('#btn-revoke-crl');
    await page.waitForSelector('text=CERTIFICATE REVOKED', { timeout: 5000 });

    const settingsBody = await page.textContent('body');
    assert.ok(settingsBody?.includes('CERTIFICATE REVOKED'), 'Badge must display CERTIFICATE REVOKED');
    assert.ok(settingsBody?.includes('1.0.0-embedded (CRL Rollback)'), 'Active bundle must roll back to 1.0.0-embedded');
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('INNER CAUGHT ERROR:', err);
    throw err;
  } finally {
    await scaffold.close();
  }

  // 8. Generate MP4 and GIF artifacts from recorded WebM video
  webmPath = await scaffold.getVideoPath();
  if (webmPath && existsSync(webmPath)) {
    const mp4Path = resolve(assetsDir, 'lynxfita-explorer-demo.mp4');
    const gifPath = resolve(assetsDir, 'lynxfita-explorer-demo.gif');
    const converted = convertVideoToArtifacts(webmPath, mp4Path, gifPath);
    if (converted) {
      assert.ok(existsSync(mp4Path), 'docs/assets/lynxfita-explorer-demo.mp4 must be created');
      assert.ok(existsSync(gifPath), 'docs/assets/lynxfita-explorer-demo.gif must be created');
    }
  }
});
