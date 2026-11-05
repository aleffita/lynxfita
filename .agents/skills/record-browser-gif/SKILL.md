---
name: record-browser-gif
description: Record real interactive browser sessions of LynxFita Explorer and Weather Showcase into deterministic MP4 and palette-optimized GIF artifacts using headless Chrome DevTools Protocol and FFmpeg 7.1.1.
---

# Record Browser GIF & MP4 Skill (LynxFita)

Never commit synthetic AI-generated SVG/PNG mockups to represent application UI. Every visual demonstration of `LynxFita Explorer` and `weather-showcase` MUST be recorded from a live running server booted from the current branch commit using real headless Chromium/Chrome and encoded with FFmpeg.

## Mandatory Workflow

1. **Stage Clean Build & Boot Real Server**:
   - Build the workspace (`pnpm build`) and start the real Explorer + mTLS Authority & Federation Dev Server (`pnpm explore` or Playwright E2E scaffold).
2. **Drive Deterministic User Storyboard in Chrome**:
   - Frame 1..N: Render `LynxFita Explorer` Homepage + `Weather Showcase` MVI in Dark Theme (`#000000` background, `#f9d65d` accent) with active Canvas/WebGPU atmospheric particles and live DMA `0x2000` telemetry.
   - Frame N..M: Toggle Light Theme (`#ffffff` / `#383838` / `#f9d65d`) and switch city forecast (`+3h`, `+6h`, `+12h`).
   - Frame M..K: Switch mTLS client certificate from `viewer` to `top-patron`, execute real `node:tls` handshake against the Authority Server, compile the remote `canary` bundle via Runtime AOT (`ctx.compiler`), and mount the federated Cordis Fiber.
   - Frame K..End: Revoke the client certificate on the Authority Server, trigger live CRL invalidation, and observe Cordis `Fiber._unload()` LIFO rollback to the embedded installation bundle.
3. **Encode MP4 & Palette-Optimized GIF with FFmpeg**:
   ```powershell
   ffmpeg -y -framerate 12 -i frames/frame_%03d.png -vf "fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" docs/assets/lynxfita-explorer-demo.gif
   ```
   ```powershell
   ffmpeg -y -framerate 12 -i frames/frame_%03d.png -c:v libx264 -pix_fmt yuv420p -movflags +faststart docs/assets/lynxfita-explorer-demo.mp4
   ```
4. **Verify**: Confirm both `docs/assets/lynxfita-explorer-demo.gif` and `docs/assets/lynxfita-explorer-demo.mp4` exist, are non-empty, and accurately depict every phase of the storyboard.
