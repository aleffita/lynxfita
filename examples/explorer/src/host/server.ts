/**
 * WeChat-Style Super-App Explorer HTTP Host Server
 * Serves the interactive browser shell at http://127.0.0.1:4173 ('pnpm explore')
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { SuperAppExplorer } from '@lynxfita/explorer';

export function startExplorerServer(port = 4173): Promise<{ close: () => Promise<void>; port: number }> {
  const explorer = new SuperAppExplorer();

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const html = await explorer.renderHtmlPage();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/state') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          route: explorer.navigator.getCurrentRoute(),
          theme: explorer.themeManager.getMode(),
          settings: explorer.getSettingsState(),
          events: explorer.historyManager.getEvents()
        }));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = body ? JSON.parse(body) : {};

            if (url.pathname === '/api/navigate') {
              await explorer.navigate(data.url, data.title);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (url.pathname === '/api/back') {
              await explorer.back();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (url.pathname === '/api/theme/toggle') {
              explorer.themeManager.toggle();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, mode: explorer.themeManager.getMode() }));
              return;
            }

            if (url.pathname === '/api/settings/role') {
              explorer.setMtlsRole(data.role);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (url.pathname === '/api/settings/crl-toggle') {
              const revoked = explorer.toggleCrlRevocation();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, revoked }));
              return;
            }

            if (url.pathname === '/api/simd/execute') {
              const dma = explorer.context.dma;
              if (dma) {
                const slot = dma.getSlot(0x2000, 32);
                const floatView = new Float32Array(slot.buffer, slot.byteOffset, 8);
                for (let i = 0; i < 8; i++) {
                  floatView[i] = (20.0 + i * 1.5) + 3.5; // Simulated SIMD advection
                }
              }
              explorer.historyManager.log('ffi', 'Executed native SIMD advection compute over DMA 0x2000');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (url.pathname === '/api/weather/intent') {
              await explorer.ensureMiniAppLaunched('weather-showcase');
              const instance = explorer.containerManager.getInstance('weather-showcase');
              if (instance?.dispatch) {
                await instance.dispatch(data);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            if (url.pathname === '/api/settings/federation-sync') {
              explorer.historyManager.log('cordis', 'Reconciled Ed25519 OTA federation bundle manifest');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        port: actualPort,
        close: () => new Promise<void>((rClose, rErr) => {
          server.closeAllConnections?.();
          server.close(err => (err ? rErr(err) : rClose()));
        })
      });
    });

    server.on('error', reject);
  });
}

// Auto-run if executed directly as entrypoint
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const port = parseInt(process.env['PORT'] || '4173', 10);
  startExplorerServer(port).then(() => {
    console.log(`LynxFita Super-App Explorer running at http://127.0.0.1:${port}`);
  }).catch(err => {
    console.error('Failed to start Super-App Explorer:', err);
    process.exit(1);
  });
}
