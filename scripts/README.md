# 🛠️ Ring Platform Setup Scripts

This directory contains various setup and configuration scripts for the Ring Platform project.

## 📋 Available Scripts

### 🚀 `setup-dev.sh` - Development Environment Setup
**Primary development environment setup script**

```bash
./scripts/setup-dev.sh
```

**Features:**
- ✨ Beautiful oh-my-zsh style interface with colors and Unicode symbols
- 🔍 Automatic OS detection (macOS/Linux)
- 📦 Auto-installs required packages (Node.js, Firebase CLI, Vercel CLI)
- 🔑 Interactive environment variable configuration with guided links
- 💻 IDE detection and configuration (Cursor/VS Code)
- 🔥 Firebase project setup guidance
- 🔐 OAuth provider setup (Google, Apple)
- 🌐 Automatic AUTH_SECRET generation
- 📂 Project dependency installation
- 🚀 Development server startup

**Prerequisites:**
- Git installed
- macOS (with Homebrew) or Ubuntu/Debian Linux
- Terminal with Unicode support

**Step-by-step process:**
1. System requirements check
2. Package installation via Homebrew/apt
3. Project dependencies installation
4. Firebase configuration setup
5. OAuth providers configuration
6. Environment variables setup
7. IDE configuration
8. Development server startup

---

### 🌐 `setup-vercel-env.sh` - Production Environment Variables
**Vercel deployment environment setup**

```bash
./scripts/setup-vercel-env.sh
```

**Features:**
- 🔄 Update existing environment variables
- 📋 Auto-import from `.env.local` file
- 🛡️ Error handling and validation
- 🌍 Multi-environment setup (production, preview, development)
- 🔗 Special handling for production URLs

---

### ⚙️ `setup-env.js` - Environment File Management
**Node.js script for environment file management**

```bash
node scripts/setup-env.js [--force]
```

**Features:**
- 📄 Create `.env.local` from template
- 🔍 Check existing environment files
- 📝 Open in default editor
- 🔧 Interactive environment setup

---

### 🔥 `inject-firebase-config.js` - Firebase Service Worker Setup
**Firebase configuration injection for service workers**

```bash
node scripts/inject-firebase-config.js
```

**Features:**
- 🔧 Inject Firebase config into service worker
- ⚠️ Missing environment variable detection
- 🔄 Automatic configuration replacement
- ✅ Validation and error handling

## 🎯 Quick Start

For new developers setting up the Ring Platform:

```bash
# Clone the repository
git clone <repository-url>
cd ring

# Run the comprehensive development setup
./scripts/setup-dev.sh
```

The script will guide you through the entire setup process with beautiful, interactive prompts.

## 🔧 Environment Setup Priority

1. **Development**: Use `setup-dev.sh` for complete local development setup
2. **Production**: Use `setup-vercel-env.sh` for Vercel deployment configuration
3. **Manual**: Use `setup-env.js` for quick environment file management

## 📚 Related Documentation

- [Environment Variables Template](../env.local.template) - Complete variable reference
- [VS Code Configuration](../.vscode/) - IDE settings and extensions
- [Firebase Setup Guide](https://console.firebase.google.com)
- [Vercel Deployment Guide](https://vercel.com/docs)

## 🆘 Troubleshooting

**Script fails to run:**
```bash
chmod +x scripts/setup-dev.sh
```

**Missing dependencies:**
- Ensure Git is installed
- Check if you have proper permissions for package installation
- Verify internet connection for downloading packages

**Environment variable issues:**
- Check Firebase project configuration
- Verify OAuth provider setup
- Ensure all required services are configured

## 🔮 Future Scripts

- `setup-prod.sh` - Production deployment automation
- `setup-docker.sh` - Docker containerization setup
- `setup-testing.sh` - Testing environment configuration
- `backup-config.sh` - Configuration backup and restore 