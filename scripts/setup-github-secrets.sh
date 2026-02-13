#!/bin/bash
# ============================================================================
# Ring Platform (ring-platform.org) - GitHub Secrets & Variables Setup Script
# ============================================================================
# Usage: ./scripts/setup-github-secrets.sh
# 
# This script sets up all required GitHub Secrets and Variables for the
# docker-publish.yml workflow to build and publish Docker images.
#
# Project: ring-platform.org (NOT ring.ck.ua - that's a different project)
# Repository: connectplatform/ring
# Domain: https://ring-platform.org
# ============================================================================

REPO="connectplatform/ring"

echo "🔐 Setting up GitHub Secrets & Variables for Ring Platform (ring-platform.org)"
echo "Repository: $REPO"
echo "=============================================================================="

# ============================================================================
# 🔐 SECRETS (Encrypted, never visible in logs)
# ============================================================================

echo ""
echo "🔐 Configuring GitHub Secrets..."
echo "--------------------------------"

# --- Authentication Secrets ---
# AUTH_SECRET for Auth.js session encryption
gh secret set AUTH_SECRET --repo $REPO --body "s5dzmaQkiKWkfIBsDpRxaPrv/X93TIyy0M5Ofk/+8z0="

# Google OAuth Server-side Credentials
# Note: AUTH_GOOGLE_ID uses the same value as NEXT_PUBLIC_AUTH_GOOGLE_ID
gh secret set AUTH_GOOGLE_ID --repo $REPO --body "919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com"
# IMPORTANT: AUTH_GOOGLE_SECRET must be set manually - it's not in build_args for security
echo "⚠️  AUTH_GOOGLE_SECRET: Set manually via GitHub UI or:"
echo "    gh secret set AUTH_GOOGLE_SECRET --repo $REPO --body 'YOUR_GOOGLE_CLIENT_SECRET'"

# --- Firebase Admin SDK (Server-side) ---
gh secret set AUTH_FIREBASE_PROJECT_ID --repo $REPO --body "ring-main"
gh secret set AUTH_FIREBASE_CLIENT_EMAIL --repo $REPO --body "firebase-adminsdk-fbsvc@ring-main.iam.gserviceaccount.com"
# IMPORTANT: AUTH_FIREBASE_PRIVATE_KEY must be set manually
echo "⚠️  AUTH_FIREBASE_PRIVATE_KEY: Set manually (multiline). Use:"
echo "    gh secret set AUTH_FIREBASE_PRIVATE_KEY --repo $REPO < firebase-private-key.pem"

# --- Database Password (Runtime injection) ---
echo "⚠️  DB_PASSWORD: Set manually via GitHub UI or:"
echo "    gh secret set DB_PASSWORD --repo $REPO --body 'YOUR_DB_PASSWORD'"

# --- Payment Gateway (if used) ---
# gh secret set WAYFORPAY_SECRET_KEY --repo $REPO --body "YOUR_WAYFORPAY_SECRET"

# --- File Storage (if used) ---
# gh secret set BLOB_READ_WRITE_TOKEN --repo $REPO --body "YOUR_VERCEL_BLOB_TOKEN"

# --- AI/LLM API Keys (if used) ---
# gh secret set OPENAI_API_KEY --repo $REPO --body "sk-YOUR_OPENAI_KEY"
# gh secret set ANTHROPIC_API_KEY --repo $REPO --body "sk-ant-YOUR_ANTHROPIC_KEY"

# --- Web3/Blockchain (if used) ---
# gh secret set WALLET_ENCRYPTION_KEY --repo $REPO --body "YOUR_32_CHAR_HEX_KEY"

echo ""
echo "✅ Core secrets configured (some require manual setup - see warnings above)"

# ============================================================================
# 📋 VARIABLES (Non-sensitive, visible in logs - safe for build args)
# ============================================================================

echo ""
echo "📋 Configuring GitHub Variables..."
echo "-----------------------------------"

# --- Application URLs (ring-platform.org domain) ---
gh variable set NEXT_PUBLIC_APP_URL --repo $REPO --body "https://ring-platform.org"
gh variable set NEXT_PUBLIC_API_URL --repo $REPO --body "https://ring-platform.org"
gh variable set NEXTAUTH_URL --repo $REPO --body "https://ring-platform.org"

# --- Google OAuth Client-side ID (public, safe to expose) ---
gh variable set NEXT_PUBLIC_AUTH_GOOGLE_ID --repo $REPO --body "919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com"
gh variable set NEXT_PUBLIC_GOOGLE_CLIENT_ID --repo $REPO --body "919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com"

# --- Firebase Client SDK (public, safe to expose) ---
gh variable set NEXT_PUBLIC_FIREBASE_PROJECT_ID --repo $REPO --body "ring-main"
gh variable set NEXT_PUBLIC_FIREBASE_API_KEY --repo $REPO --body "AIzaSyCWd2YVU7mN0FkMMO9ZDuIv6MlnunH7VX8"
gh variable set NEXT_PUBLIC_FIREBASE_APP_ID --repo $REPO --body "1:919637187324:web:af95cb1c3d96f2bc0bd579"
gh variable set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN --repo $REPO --body "ring-main.firebaseapp.com"
gh variable set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --repo $REPO --body "919637187324"
gh variable set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET --repo $REPO --body "ring-main.appspot.com"
gh variable set NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID --repo $REPO --body "G-WVDVCRX12R"
gh variable set NEXT_PUBLIC_FIREBASE_VAPID_KEY --repo $REPO --body "BKQ4OAwA-1wPgnqLXuvbf-RE-QetqqAJX-EENcmViZ97dhygWE6K7GFyNkB_fkQo_suVk06nbkDBnypsFaajSjw"

# --- Database Configuration (non-sensitive) ---
gh variable set DB_BACKEND_MODE --repo $REPO --body "k8s-postgres-fcm"
gh variable set DB_HOST --repo $REPO --body "postgres.ring-platform-org.svc.cluster.local"
gh variable set DB_PORT --repo $REPO --body "5432"
gh variable set DB_NAME --repo $REPO --body "ring_platform"
gh variable set DB_USER --repo $REPO --body "ring_user"
gh variable set DB_POOL_SIZE --repo $REPO --body "20"
gh variable set DB_SSL --repo $REPO --body "false"

# --- AI/LLM Configuration ---
gh variable set LLM_PROVIDER --repo $REPO --body "openai"

# --- Web3 Configuration ---
gh variable set POLYGON_RPC_URL --repo $REPO --body "https://polygon-rpc.com"

echo ""
echo "✅ Variables configured!"
echo ""
echo "=============================================================================="
echo "🎉 GitHub Secrets & Variables setup complete for ring-platform.org!"
echo "=============================================================================="
echo ""
echo "📊 Verify configuration:"
echo "   gh secret list --repo $REPO"
echo "   gh variable list --repo $REPO"
echo ""
echo "⚠️  MANUAL SETUP REQUIRED for these secrets:"
echo "   1. AUTH_GOOGLE_SECRET - Google OAuth client secret"
echo "   2. AUTH_FIREBASE_PRIVATE_KEY - Firebase Admin SDK private key"
echo "   3. DB_PASSWORD - PostgreSQL database password"
echo ""
echo "🔗 Set via GitHub UI: https://github.com/$REPO/settings/secrets/actions"
