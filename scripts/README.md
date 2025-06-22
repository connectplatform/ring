# 🛠️ Ring Platform Setup Scripts

This directory contains various setup and configuration scripts for the Ring Platform project.

## 📋 Available Scripts

### 🚀 `setup.sh` - Universal Environment Setup
**Primary setup script for both development and production environments**

```bash
# Located in Ring project root directory
./setup.sh         # Development environment setup (default)
./setup.sh dev     # Development environment setup (explicit)
./setup.sh prod    # Production deployment setup
```

**Features:**
- 🎨 Beautiful 80s-style MOTD with retro ASCII art
- ✨ Oh-my-zsh style interface with colors and emojis
- 🔄 Dual-mode operation: Development & Production
- 🔍 Automatic OS detection (macOS/Linux)
- 📦 Auto-installs required packages (Node.js, Firebase CLI, Vercel CLI)
- 🚀 Production deployment to Vercel or Ubuntu servers
- 🔑 Interactive environment variable configuration with guided links
- 💻 IDE detection and configuration (Cursor/VS Code)
- 🔥 Firebase project setup guidance
- 🔐 OAuth provider setup (Google, Apple)
- 🌐 Automatic AUTH_SECRET generation
- 📂 Project dependency installation
- 🖥️ SSH-based Ubuntu server deployment with PM2
- 🎯 Smart prompts with sensible defaults (Y/n for continuation)

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

### Development Setup
For new developers setting up the Ring Platform:

```bash
# Clone the repository
git clone <repository-url>
cd ring

# Run the comprehensive development setup
./setup.sh
```

### Production Deployment
For deploying to production:

```bash
# Navigate to your Ring project
cd ring

# Run production deployment
./setup.sh prod
```

The script will guide you through the entire setup process with a beautiful 80s-style interface and smart interactive prompts.

## 🔧 Environment Setup Priority

1. **Universal Setup**: Use `./setup.sh` for complete development or production setup
2. **Manual Vercel**: Use `setup-vercel-env.sh` for manual Vercel environment configuration
3. **Quick Environment**: Use `setup-env.js` for quick environment file management

## 📚 Related Documentation

- [Environment Variables Template](../env.local.template) - Complete variable reference
- [VS Code Configuration](../.vscode/) - IDE settings and extensions
- [Firebase Setup Guide](https://console.firebase.google.com)
- [Vercel Deployment Guide](https://vercel.com/docs)

## 🆘 Troubleshooting

**Script fails to run:**
```bash
chmod +x ./setup.sh
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