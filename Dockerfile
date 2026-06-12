# syntax=docker/dockerfile:1
# Ring Platform - Production Docker Image
# Multi-stage build for Next.js 16 + React 19 professional networking platform
#
# 📋 REQUIRED ENVIRONMENT VARIABLES FOR PRODUCTION:
#
# 🔐 CRITICAL (Auth.js will fail without these):
#   - AUTH_SECRET: Auth.js session encryption key
#   - AUTH_GOOGLE_ID: Google OAuth client ID (server-side)
#   - AUTH_GOOGLE_SECRET: Google OAuth client secret (server-side)
#   - WALLET_ENCRYPTION_KEY: 32-char hex key for wallet private key encryption
#   - POLYGON_RPC_URL: Polygon blockchain RPC endpoint
#
# 🔥 OPTIONAL (for Firebase operations):
#   - AUTH_FIREBASE_PROJECT_ID, AUTH_FIREBASE_CLIENT_EMAIL, AUTH_FIREBASE_PRIVATE_KEY
#
# 💰 OPTIONAL (for payments):
#   - WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY, WAYFORPAY_DOMAIN
#
# 🤖 OPTIONAL (for AI features):
#   - OPENAI_API_KEY or ANTHROPIC_API_KEY, LLM_PROVIDER
#
# ☁️ OPTIONAL (for file storage):
#   - BLOB_READ_WRITE_TOKEN
#
# 🗄️ OPTIONAL (advanced DB tuning):
#   - DB_POOL_SIZE, DB_TIMEOUT, DB_SSL, DB_METRICS_ENABLED, etc.
#
# 🚀 BUILD COMMAND EXAMPLE (No sensitive secrets at build time):
# docker build \
#   --platform linux/amd64 \
#   --build-arg AUTH_SECRET="your-auth-secret" \
#   --build-arg NEXT_PUBLIC_AUTH_GOOGLE_ID="your-client-id" \
#   --build-arg POLYGON_RPC_URL="https://polygon-rpc.com" \
#   --build-arg DB_HOST="postgres.ring-platform-org.svc.cluster.local" \
#   --build-arg DB_PORT="5432" \
#   --build-arg DB_NAME="ring_platform" \
#   --build-arg DB_USER="ring_user" \
#   --build-arg NEXT_PUBLIC_APP_URL="https://ring-platform.org" \
#   --build-arg NEXT_PUBLIC_API_URL="https://ring-platform.org" \
#   -t ghcr.io/connectplatform/ring:v0.9.18-ring-platform.org-amd64 .
#
# 🔐 CRITICAL: Sensitive secrets (AUTH_GOOGLE_SECRET, AUTH_FIREBASE_PRIVATE_KEY, etc.)
# are injected at RUNTIME via Kubernetes secrets, not build time!
#
# Example Kubernetes secret injection:
# kubectl create secret generic ring-secrets \
#   --from-literal=AUTH_GOOGLE_ID="your-google-client-id" \
#   --from-literal=AUTH_GOOGLE_SECRET="your-google-secret" \
#   --from-literal=AUTH_APPLE_ID="com.sonoratek.ring-auth" \
#   --from-literal=AUTH_APPLE_SECRET="your-apple-secret" \
#   --from-literal=AUTH_FIREBASE_PROJECT_ID="ring-main" \
#   --from-literal=AUTH_FIREBASE_CLIENT_EMAIL="firebase@ring-main.iam.gserviceaccount.com" \
#   --from-literal=AUTH_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." \
#   --from-literal=DB_PASSWORD="your-postgres-password" \
#   --from-literal=WAYFORPAY_SECRET_KEY="your-wayforpay-secret" \
#   --from-literal=BLOB_READ_WRITE_TOKEN="vercel_blob_token" \
#   --from-literal=OPENAI_API_KEY="sk-your-openai-key" \
#   --from-literal=ANTHROPIC_API_KEY="sk-ant-your-anthropic-key" \
#   --from-literal=WALLET_ENCRYPTION_KEY="your-32-char-hex-key" \
#   --from-literal=AUTH_DEBUG="false"

# -----------------------------------------------------------------------------
# Dependencies (separate stage: real node_modules in an image layer + /root/.npm
# BuildKit cache for faster reinstalls when lockfile unchanged). Native deps need
# the same build toolchain as the compile stage.
# -----------------------------------------------------------------------------
FROM node:25-alpine AS deps
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    git
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 15000 && \
    npm config set fetch-retry-maxtimeout 180000 && \
    npm config set maxsockets 5 && \
    npm ci --include=dev --legacy-peer-deps

# Build Stage
# Why Docker builds are often slower than local `npm run build`:
# - Cold start: no persistent node_modules or .next cache; each build reinstalls unless cache mounts help.
# - Layer invalidation: any change after `COPY . .` invalidates later layers.
# - Network/IO: registry pulls + container FS (often slower than host SSD, especially on Docker Desktop).
# - This Dockerfile uses a `deps` stage + `/root/.npm` cache and `.next/cache` mount to mitigate.
FROM node:25-alpine AS builder

LABEL maintainer="Ring Platform Team <insight@ring-platform.org>"
LABEL version="1.47"
LABEL description="Ring Platform - Professional Networking with Web3 Integration"

# Build arguments
ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_URL=https://ring-platform.org
ARG NEXT_PUBLIC_API_URL=https://ring-platform.org
ARG NEXTAUTH_URL=https://ring-platform.org

# =============================================================================
# 🔐 AUTHENTICATION CONFIGURATION (CRITICAL)
# =============================================================================

# Auth.js Core Configuration
ARG AUTH_SECRET
# ARG AUTH_DEBUG=false  # Optional: can be set at build time or runtime

# Google OAuth (Server-side) - Will be injected at runtime
# ARG AUTH_GOOGLE_ID
# ARG AUTH_GOOGLE_SECRET

# Apple OAuth (Server-side) - Will be injected at runtime
# ARG AUTH_APPLE_ID
# ARG AUTH_APPLE_SECRET

# Firebase Admin SDK (Server-side operations) - Will be injected at runtime
# ARG AUTH_FIREBASE_PROJECT_ID
# ARG AUTH_FIREBASE_CLIENT_EMAIL
# ARG AUTH_FIREBASE_PRIVATE_KEY

# Google OAuth Client-side
ARG NEXT_PUBLIC_AUTH_GOOGLE_ID
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# WalletConnect / Reown (client bundle; public project id)
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# =============================================================================
# 🔥 FIREBASE CONFIGURATION
# =============================================================================

# Firebase Client SDK (public, safe to bake into build)
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY

# =============================================================================
# 🗄️ DATABASE CONFIGURATION
# =============================================================================

# Backend Mode Configuration (REQUIRED for Ring Platform v1.45+)
# Valid values: k8s-postgres-fcm, firebase-full, supabase-fcm
ARG DB_BACKEND_MODE=k8s-postgres-fcm

# PostgreSQL Configuration (for k8s-postgres-fcm and supabase-fcm modes)
ARG DB_HOST
ARG DB_PORT=5432
ARG DB_NAME=ring_platform
ARG DB_USER=ring_user
# ARG DB_PASSWORD  # Runtime injection via K8s secrets

# Database Advanced Configuration
ARG DB_POOL_SIZE=20
ARG DB_TIMEOUT=30000
ARG DB_RETRIES=3
ARG DB_SSL=false
ARG DB_SYNC_ENABLED=false
ARG DB_SYNC_BACKENDS=postgresql
ARG DB_SYNC_INTERVAL=300000
ARG DB_SYNC_BATCH_SIZE=100
ARG DB_METRICS_ENABLED=false
ARG DB_TRACING_ENABLED=false

# =============================================================================
# 💰 PAYMENT & COMMERCE
# =============================================================================

# WayForPay Payment Gateway
ARG WAYFORPAY_MERCHANT_ACCOUNT
# ARG WAYFORPAY_SECRET_KEY  # Runtime injection via K8s secrets
ARG WAYFORPAY_DOMAIN

# =============================================================================
# ☁️ FILE STORAGE
# =============================================================================

# Vercel Blob Storage
# ARG BLOB_READ_WRITE_TOKEN  # Runtime injection via K8s secrets

# =============================================================================
# 🤖 AI/LLM CONFIGURATION
# =============================================================================

# AI Configuration
ARG LLM_PROVIDER=openai
# ARG OPENAI_API_KEY  # Runtime injection via K8s secrets
# ARG ANTHROPIC_API_KEY  # Runtime injection via K8s secrets

# =============================================================================
# ⛓️ WEB3 & BLOCKCHAIN
# =============================================================================

# Web3 Configuration
ARG POLYGON_RPC_URL=https://polygon-rpc.com
# ARG WALLET_ENCRYPTION_KEY  # Runtime injection via K8s secrets

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
# Node forbids `--no-webstorage` in NODE_OPTIONS (process exits). Deprecation noise only here.
ENV NODE_OPTIONS="--no-deprecation"

# =============================================================================
# 🔐 AUTHENTICATION ENVIRONMENT VARIABLES (CRITICAL)
# =============================================================================

# Auth.js Core Configuration
ENV AUTH_SECRET=${AUTH_SECRET}
# ENV AUTH_DEBUG=${AUTH_DEBUG}  # Optional: can be set at runtime

# 🔐 CRITICAL SECRETS - INJECTED AT RUNTIME VIA KUBERNETES SECRETS
# Google OAuth (Server-side) - Runtime injection via K8s secrets
# ENV AUTH_GOOGLE_ID=${AUTH_GOOGLE_ID}
# ENV AUTH_GOOGLE_SECRET=${AUTH_GOOGLE_SECRET}

# Apple OAuth (Server-side) - Runtime injection via K8s secrets
# ENV AUTH_APPLE_ID=${AUTH_APPLE_ID}
# ENV AUTH_APPLE_SECRET=${AUTH_APPLE_SECRET}

# Firebase Admin SDK (Server-side operations) - Runtime injection via K8s secrets
# ENV AUTH_FIREBASE_PROJECT_ID=${AUTH_FIREBASE_PROJECT_ID}
# ENV AUTH_FIREBASE_CLIENT_EMAIL=${AUTH_FIREBASE_CLIENT_EMAIL}
# ENV AUTH_FIREBASE_PRIVATE_KEY=${AUTH_FIREBASE_PRIVATE_KEY}

# Google OAuth Client-side
ENV NEXT_PUBLIC_AUTH_GOOGLE_ID=${NEXT_PUBLIC_AUTH_GOOGLE_ID}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}

# =============================================================================
# 🔥 FIREBASE ENVIRONMENT VARIABLES
# =============================================================================

# Firebase Client SDK Environment Variables (for client-side Firebase usage)
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}
ENV NEXT_PUBLIC_FIREBASE_VAPID_KEY=${NEXT_PUBLIC_FIREBASE_VAPID_KEY}

# =============================================================================
# 🗄️ DATABASE ENVIRONMENT VARIABLES
# =============================================================================

# Backend Mode Configuration (REQUIRED for Ring Platform v1.45+)
ENV DB_BACKEND_MODE=${DB_BACKEND_MODE}

# PostgreSQL Configuration (for k8s-postgres-fcm and supabase-fcm modes)
ENV DB_HOST=${DB_HOST}
ENV DB_PORT=${DB_PORT}
ENV DB_NAME=${DB_NAME}
ENV DB_USER=${DB_USER}
# ENV DB_PASSWORD=${DB_PASSWORD}  # Runtime injection via K8s secrets

# Database Advanced Configuration Environment Variables
ENV DB_POOL_SIZE=${DB_POOL_SIZE}
ENV DB_TIMEOUT=${DB_TIMEOUT}
ENV DB_RETRIES=${DB_RETRIES}
ENV DB_SSL=${DB_SSL}
ENV DB_SYNC_ENABLED=${DB_SYNC_ENABLED}
ENV DB_SYNC_BACKENDS=${DB_SYNC_BACKENDS}
ENV DB_SYNC_INTERVAL=${DB_SYNC_INTERVAL}
ENV DB_SYNC_BATCH_SIZE=${DB_SYNC_BATCH_SIZE}
ENV DB_METRICS_ENABLED=${DB_METRICS_ENABLED}
ENV DB_TRACING_ENABLED=${DB_TRACING_ENABLED}

# =============================================================================
# 💰 PAYMENT & COMMERCE ENVIRONMENT VARIABLES
# =============================================================================

# WayForPay Payment Gateway
ENV WAYFORPAY_MERCHANT_ACCOUNT=${WAYFORPAY_MERCHANT_ACCOUNT}
# ENV WAYFORPAY_SECRET_KEY=${WAYFORPAY_SECRET_KEY}  # Runtime injection via K8s secrets
ENV WAYFORPAY_DOMAIN=${WAYFORPAY_DOMAIN}

# =============================================================================
# ☁️ FILE STORAGE ENVIRONMENT VARIABLES
# =============================================================================

# Vercel Blob Storage
# ENV BLOB_READ_WRITE_TOKEN=${BLOB_READ_WRITE_TOKEN}  # Runtime injection via K8s secrets

# =============================================================================
# 🤖 AI/LLM ENVIRONMENT VARIABLES
# =============================================================================

# AI Configuration
ENV LLM_PROVIDER=${LLM_PROVIDER}
# ENV OPENAI_API_KEY=${OPENAI_API_KEY}  # Runtime injection via K8s secrets
# ENV ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}  # Runtime injection via K8s secrets

# =============================================================================
# ⛓️ WEB3 & BLOCKCHAIN ENVIRONMENT VARIABLES
# =============================================================================

# Web3 Configuration
ENV POLYGON_RPC_URL=${POLYGON_RPC_URL}
# ENV WALLET_ENCRYPTION_KEY=${WALLET_ENCRYPTION_KEY}  # Runtime injection via K8s secrets

# Install system dependencies required for native npm modules (align with ring-connect-software / ring-zemna-ai)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    git

# Create app directory
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (.dockerignore excludes host node_modules)
COPY . .

# Copy environment template and create build-time env
COPY env.local.template env.local.template

# Build the application (reuse .next/cache across builds when BuildKit cache mount is enabled)
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Runtime Stage
FROM node:25-alpine AS runtime

LABEL maintainer="Ring Platform Team <team@ring-platform.org>"
LABEL version="1.47"
LABEL description="Ring Platform Runtime - AI-powered Platform with Web3 Integration"

# Runtime environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--no-deprecation"

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
# Standalone output already includes traced node_modules — no second npm install (avoids double install and Docker npm ci failures)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy lib directory for auth and utilities
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# next-intl request config + routing (required at runtime; same pattern as ring-connect-software / ring-zemna-ai)
COPY --from=builder --chown=nextjs:nodejs /app/i18n ./i18n

# Copy docs directory for MDX documentation
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs

# Copy environment template
COPY --from=builder --chown=nextjs:nodejs /app/env.local.template ./env.local.template

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
