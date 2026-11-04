# Multi-stage Dockerfile for LynxFita Runtime & Explorer CLI
FROM node:22-bookworm AS builder

# Install C++20 build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake ninja-build build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate

WORKDIR /workspace

# Copy monorepo sources
COPY . .

# Install dependencies and build workspace
RUN pnpm install --frozen-lockfile=false \
    && node scripts/setup-workspace.mjs \
    && pnpm --filter "@lynxfita/core" run build \
    && pnpm --filter "@lynxfita/codegen" run build \
    && pnpm --filter "@lynxfita/builder" run build \
    && pnpm --filter "@lynxfita/wasi-runtime" run build \
    && pnpm --filter "@lynxfita/updater" run build \
    && pnpm --filter "@lynxfita/cli" run build \
    && cmake -B build/native -S src/native -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build/native

# Production runtime container
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY --from=builder /workspace/build/native/lynxfita_explorer /usr/local/bin/lynxfita_explorer
COPY --from=builder /workspace/packages /app/packages
COPY --from=builder /workspace/examples /app/examples
COPY --from=builder /workspace/package.json /app/package.json
COPY --from=builder /workspace/node_modules /app/node_modules

LABEL org.opencontainers.image.source="https://github.com/aleffita/lynxfita"
LABEL org.opencontainers.image.description="LynxFita: Next-Gen Desktop & Embedded Runtime for LynxJS"

ENTRYPOINT ["lynxfita_explorer"]
CMD ["--demo"]
