# Ring Platform - Production Docker Image
# Multi-stage build for Next.js 15 + React 19 professional networking platform

# Build Stage
FROM node:22-alpine AS builder

LABEL maintainer="Ring Platform Team <team@ring.platform>"
LABEL version="0.9.7"
LABEL description="Ring Platform - Professional Networking with Web3 Integration"

# Build arguments
ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install system dependencies and pnpm for better performance
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    git \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

# Create app directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN if [ -f pnpm-lock.yaml ]; then \
        pnpm install --frozen-lockfile --production=false; \
    else \
        npm ci --include=dev --legacy-peer-deps; \
    fi

# Copy source code
COPY . .

# Copy environment template and create build-time env
COPY env.local.template .env.local.template

# Build the application
RUN npm run prebuild && \
    npm run build

# Runtime Stage
FROM node:22-alpine AS runtime

LABEL maintainer="Ring Platform Team <team@ring.platform>"
LABEL version="0.9.7"
LABEL description="Ring Platform Runtime - Professional Networking Platform"

# Runtime environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install runtime dependencies
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    curl \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Create app directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy package files for dependency installation
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json* ./




# Copy lib directory for auth and utilities
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Copy environment template
COPY --from=builder --chown=nextjs:nodejs /app/env.local.template ./env.local.template

# Install production dependencies with legacy peer deps to handle socket.io
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Create necessary directories
RUN mkdir -p /app/log /app/tmp && \
    chown -R nextjs:nodejs /app/log /app/tmp

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application with Next.js standalone server (supports WebSocket via API routes)
CMD ["node", "server.js"]
