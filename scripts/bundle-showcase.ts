/**
 * Standalone Desktop Bundle Generator for LynxFita Weather Showcase
 * Inlines declarative Lynx view components, store, and MVI architecture
 * into a single self-contained script ready for compilation with Meta Hermes compiler (hermesc).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'examples/weather-showcase/dist');
const coreDistDir = resolve(rootDir, 'packages/core/dist');

function cleanModule(code: string): string {
  return code
    .replace(/import\s+type\s+.*?;/g, '')
    .replace(/import\s+.*?;/g, '')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+class\s+/g, 'class ')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+\{.*?\};/g, '');
}

const dma = cleanModule(readFileSync(resolve(coreDistDir, 'dma.js'), 'utf8'));
const model = cleanModule(readFileSync(resolve(distDir, 'model.js'), 'utf8'));
const service = cleanModule(readFileSync(resolve(distDir, 'weather_service.js'), 'utf8'));
const icons = cleanModule(readFileSync(resolve(distDir, 'icons_map.js'), 'utf8'));
const theme = cleanModule(readFileSync(resolve(distDir, 'theme.js'), 'utf8'));
const intents = cleanModule(readFileSync(resolve(distDir, 'intents.js'), 'utf8'));
const store = cleanModule(readFileSync(resolve(distDir, 'store.js'), 'utf8'));
const app = cleanModule(readFileSync(resolve(distDir, 'WeatherApp.js'), 'utf8'));

const bundleContent = `// LynxFita Weather Showcase - Standalone Desktop Bytecode Bundle
(function() {
  var Service = class Service { constructor(ctx, name) { this.ctx = ctx; this.name = name; } };

${dma}

${model}

${service}

${icons}

${theme}

${intents}

${store}

${app}

  var s = new WeatherStore();
  var state = s.getState();
  var city = state.location.city;
  var country = state.location.country;
  var temp = Math.round(state.current.temperature);
  var cond = state.current.condition;

  if (typeof print === 'function') {
    print('[LynxFita Weather Desktop] Meta Hermes Bytecode Initialized');
    print('[LynxFita Weather Desktop] Location: ' + city + ', ' + country);
    print('[LynxFita Weather Desktop] Current Weather: ' + temp + 'C, ' + cond);
  }

  var vdom = WeatherApp(state);
  if (typeof print === 'function') {
    print('[LynxFita Weather Desktop] Rendered Declarative Lynx Component: <' + vdom.type + ' className="' + vdom.props.className + '">');
  }

  var dmaTelemetry = s.getDmaTelemetry();
  if (typeof print === 'function') {
    print('[LynxFita Weather Desktop] DMA Lane Telemetry at 0x2000: Temp=' + dmaTelemetry[0] + 'C, Humidity=' + dmaTelemetry[1] + '%, Pressure=' + dmaTelemetry[2] + 'hPa, Wind=' + dmaTelemetry[3] + 'km/h');
  }
})();
`;

const outPath = resolve(distDir, 'weather_bundle.js');
writeFileSync(outPath, bundleContent, 'utf8');
console.log(`[bundle-showcase] Generated standalone desktop script: ${outPath} (${bundleContent.length} bytes)`);
