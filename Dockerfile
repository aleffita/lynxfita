# syntax=docker/dockerfile:1
FROM node:22-alpine AS base

LABEL org.opencontainers.image.title="LynxFita"
LABEL org.opencontainers.image.description="Next-Generation High-Performance Desktop & Embedded Runtime for LynxJS"
LABEL org.opencontainers.image.source="https://github.com/aleffita/lynxfita"
LABEL org.opencontainers.image.url="https://github.com/aleffita/lynxfita"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.authors="Alef Oliveira (Alefita) <me@aleffita.dev>"

WORKDIR /workspace

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy repository manifests
COPY package.json pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY packages ./packages
COPY examples ./examples
COPY scripts ./scripts

# Install pnpm and build TypeScript workspaces
RUN npm install -g pnpm@12.5.1 && \
    pnpm install --frozen-lockfile=false && \
    pnpm --filter "@lynxfita/core" run build && \
    pnpm --filter "./packages/*" run build && \
    pnpm --filter "./examples/*" run build

# Link CLI executable
RUN npm link ./packages/cli

ENTRYPOINT ["lynxfita"]
CMD ["doctor"]
