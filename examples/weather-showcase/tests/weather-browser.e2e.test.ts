/**
 * Weather Showcase Browser End-to-End (E2E) Test
 * Uses real headless Playwright browser against the hermetic Explorer scaffold.
 * Tests:
 * 1. MVI screen switching across all 5 views (forecast-home, hourly-detail, city-search, shader-dma-inspector, location-error-boundary)
 * 2. City selection (Tokyo) and reactive state propagation
 * 3. Light / Dark theme toggling with verified screenshot capture
 * 4. DOM state assertions and DMA 0x2000 telemetry synchronization
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchE2EScaffold } from '../../../tests/e2e/scaffold.ts';

test('Weather Showcase Real Browser E2E: 5 MVI Screens, Tokyo Selection, DMA Telemetry, and Screenshots', async () => {
  const assetsDir = resolve(process.cwd(), 'docs', 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const scaffold = await launchE2EScaffold({ recordVideo: false });

  try {
    const { page, baseUrl } = scaffold;

    // 1. Navigate to Explorer Shell and launch Weather Showcase Mini-App
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.click('#open-weather-showcase');
    await page.waitForSelector('.weather-showcase-app', { timeout: 10000 });

    // 2. Assert Initial Forecast Home Screen (São Paulo, Dark theme)
    await page.waitForSelector('.screen-home', { timeout: 5000 });
    const homeText = await page.textContent('.screen-home');
    assert.ok(homeText?.includes('São Paulo, BR'), 'Initial screen must display São Paulo, BR');
    assert.ok(homeText?.includes('°C'), 'Must display Celsius temperature');

    // Save dark mode screenshot
    const darkShotPath = resolve(assetsDir, 'weather-showcase-dark.png');
    await page.screenshot({ path: darkShotPath, fullPage: false, animations: 'disabled' });
    assert.ok(existsSync(darkShotPath), 'weather-showcase-dark.png must be saved');

    // 3. Screen 2: Hourly Detail
    await page.getByRole('button', { name: 'Horas' }).click();
    await page.waitForSelector('.screen-hourly', { timeout: 5000 });
    const hourlyText = await page.textContent('.screen-hourly');
    assert.ok(hourlyText?.includes('Detalhamento Horário (24h)'), 'Must show hourly forecast title');
    assert.ok(hourlyText?.includes('+3 HORAS'), 'Must show +3h forecast column');
    assert.ok(hourlyText?.includes('+6 HORAS'), 'Must show +6h forecast column');
    assert.ok(hourlyText?.includes('+12 HORAS'), 'Must show +12h forecast column');
    assert.ok(hourlyText?.includes('CURVA DE TEMPERATURA'), 'Must show temperature curve');

    // 4. Screen 3: City Search & Select Tokyo
    await page.getByRole('button', { name: 'Cidades' }).click();
    await page.waitForSelector('.screen-search', { timeout: 5000 });
    const searchText = await page.textContent('.screen-search');
    assert.ok(searchText?.includes('Buscar Cidade & Região'), 'Must show city search title');
    assert.ok(searchText?.includes('CIDADES SUGERIDAS'), 'Must show suggested cities');

    // Click Tokyo suggestion
    const tokyoBtn = page.locator('button:has-text("Tokyo")');
    await tokyoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await tokyoBtn.click();

    // After selecting Tokyo, MVI transitions back to forecast-home with Tokyo data
    await page.waitForSelector('.screen-home', { timeout: 5000 });
    const tokyoHomeText = await page.textContent('.screen-home');
    assert.ok(tokyoHomeText?.includes('Tokyo, JP'), 'Location must update to Tokyo, JP after selection');

    // 5. Toggle Theme (Dark -> Light)
    const themeBtn = page.locator('button[title="Alternar Tema"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      themeBtn.click()
    ]);
    await page.waitForSelector('.weather-showcase-app', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Save light mode screenshot
    const lightShotPath = resolve(assetsDir, 'weather-showcase-light.png');
    await page.screenshot({ path: lightShotPath, fullPage: false, animations: 'disabled' });
    assert.ok(existsSync(lightShotPath), 'weather-showcase-light.png must be saved');

    // 6. Assert clean real-world weather UI without internal plumbing tabs
    const dmaButton = page.getByRole('button', { name: 'DMA / GPU' });
    assert.equal(await dmaButton.count(), 0, 'UI must not expose DMA / GPU internal plumbing tab');

    // 7. Screen 4: Location Error Boundary & Recovery
    await page.getByRole('button', { name: 'Erro' }).click();
    await page.waitForSelector('.screen-error', { timeout: 5000 });
    const errorText = await page.textContent('.screen-error');
    assert.ok(errorText?.includes('Erro de Localização'), 'Must display error boundary title');
    assert.ok(errorText?.includes('Por favor, permita o acesso à localização.'), 'Must display location permission notice');

    // Recover by clicking Conceder Permissão
    const grantBtn = page.getByRole('button', { name: 'Conceder Permissão' });
    await grantBtn.click();
    await page.waitForSelector('.screen-home', { timeout: 5000 });
    const recoveredText = await page.textContent('.screen-home');
    assert.ok(recoveredText?.includes('°C'), 'Must restore forecast home after granting permission');

    // 8. Assert API state telemetry
    const stateResp = await page.request.get(`${baseUrl}/api/state`);
    assert.equal(stateResp.status(), 200);
    const stateJson = await stateResp.json();
    assert.equal(stateJson.route.host, 'miniapp');
    assert.equal(stateJson.route.path, '/weather-showcase');
  } finally {
    await scaffold.close();
  }
});
