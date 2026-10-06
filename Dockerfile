# ==============================================================================
# Kea DHCP Web UI - Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build Frontend and Backend
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build server and client
RUN pnpm run build

# Stage 2: Lean Production Runtime
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy root & server dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built production artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/index.js ./server/index.js
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/data ./server/data

# Configuration & Environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/index.js"]
