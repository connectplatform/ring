# 🚀 Ring Platform Installation Guide

Complete installation and setup guide for Ring Platform - the open-source white-label professional networking platform.

---

## 📋 **Prerequisites**

### System Requirements
- **Node.js** v20.0.0 or later (v22+ recommended)
- **npm** v10.0.0 or later  
- **Git** (latest version)
- **OpenSSL** (for key generation)
- **Terminal** with Unicode support (for best experience)

### Optional Services (Configure After Installation)
- **Firebase Project** - For database and authentication
- **PostgreSQL** - For production Kubernetes deployments
- **OAuth Providers** - Google, Apple (optional)
- **WayForPay Account** - For payment processing

---

## 🎯 **Installation Options**

Ring Platform offers multiple installation approaches depending on your needs:

### 🌟 **Option 1: One-Command Installation (Recommended)**

The fastest way to get started with Ring Platform:

```bash
git clone https://github.com/connectplatform/ring.git && cd ring && ./install.sh
```

This single command will:
1. Clone the repository
2. Run the interactive installer
3. Configure your Ring clone
4. Generate all required configuration files
5. Install dependencies
6. Prepare your development environment

**Installer Features:**
- 🎨 Beautiful ASCII art welcome screen
- 🔍 Automatic system requirements check
- 📝 Interactive clone configuration (name, branding, domain)
- 🔐 Automatic secret key generation (AUTH_SECRET, WALLET_ENCRYPTION_KEY)
- 📁 Creates `ring-config.json` for clone customization
- 📁 Creates `.env.local` with secure defaults
- 📦 Installs all npm dependencies
- 🚀 Option to start dev server immediately

### **Installation Script Options**

```bash
./install.sh                      # Interactive installation (recommended)
./install.sh --quick              # Quick setup with sensible defaults
./install.sh --clone-name myapp   # Pre-set your clone name
./install.sh --verbose            # Show detailed output
./install.sh --help               # Show all options
```

---

### ⚡ **Option 2: Firebase Service Account Import**

Perfect when you already have Firebase service account credentials:

```bash
# Clone and install dependencies
git clone https://github.com/connectplatform/ring.git
cd ring
npm install

# Import Firebase credentials from JSON file
./scripts/import-firebase-service-account.sh your-service-account.json

# Start development server
npm run dev
```

**Features:**
- 🔍 Validates Firebase service account JSON files
- 📝 Updates `.env.local` with extracted credentials
- 🌐 Imports to Vercel production environment
- 🚀 Optional automatic deployment
- 🔒 Security warnings and best practices

---

### 🛠️ **Option 3: Manual Setup**

For developers who prefer manual configuration:

```bash
# Clone and install dependencies
git clone https://github.com/connectplatform/ring.git
cd ring
npm install

# Setup environment (choose one):
npm run setup:env    # Interactive setup with safety checks
npm run setup:new    # Force new environment setup

# Configure Firebase manually (see Firebase Setup section)
# Configure OAuth providers (see OAuth Setup section)

# Start development server
npm run dev
```

---

## 🔥 **Firebase Setup**

### Automatic Setup (Recommended)
Use the universal setup script or Firebase import script for automatic configuration.

### Manual Setup

1. **Create Firebase Project**
   ```bash
   # Visit Firebase Console
   https://console.firebase.google.com
   
   # Create new project or use existing
   # Enable Firestore Database
   # Enable Authentication
   ```

2. **Configure Authentication Providers**
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google (optional)
   - Enable Apple (optional)

3. **Generate Service Account**
   - Go to Project Settings > Service accounts
   - Generate new private key
   - Download JSON file

4. **Import Service Account**
   ```bash
   ./scripts/import-firebase-service-account.sh downloaded-service-account.json
   ```

### Environment Variables
The following Firebase variables are required:

```bash
# Firebase Admin SDK (Server-side)
AUTH_FIREBASE_PROJECT_ID="your-project-id"
AUTH_FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
AUTH_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (Client-side)
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"
```

### Optional: Seed Sample Opportunities

After your Firebase Admin credentials are set in `.env.local`, you can seed demo opportunities for quick validation:

```bash
cd ring
npm run seed:opportunities
```

---

## 🔐 **OAuth Provider Setup**

### Google OAuth
1. **Google Cloud Console**
   ```bash
   https://console.cloud.google.com/apis/credentials
   ```

2. **Create OAuth 2.0 Client**
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://your-domain.com/api/auth/callback/google` (production)
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://your-domain.com`

3. **Environment Variables**
   ```bash
   AUTH_GOOGLE_ID="your-google-client-id"
   AUTH_GOOGLE_SECRET="your-google-client-secret"
   ```

4. **Restrict the Firebase Web API Key (Prevent 403 on Installations)**
   - In Google Cloud Console → APIs & Services → Credentials → select your Web API key (the one from Firebase Web config)
   - Application restrictions: HTTP referrers (web sites)
   - Add:
     - `http://localhost:3000/*`
     - `http://127.0.0.1:3000/*` (optional)
     - `https://your-domain.com/*`
   - Save.

5. **Enable Required Google APIs**
   - In Google Cloud Console → APIs & Services → Library, enable:
     - Firebase Installations API
     - Firebase Cloud Messaging API
     - Identity Toolkit API (Firebase Auth)

6. **Firebase Console Checks**
   - Authentication → Sign-in method → enable Google; add `localhost` and your domain under Authorized domains
   - Project Settings → Cloud Messaging → generate Web Push certificate (VAPID) and set `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

7. **Map Firebase Web SDK Config to `.env.local`**
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
   NEXTAUTH_URL=http://localhost:3000
   ```

### Apple OAuth
1. **Apple Developer Console**
   ```bash
   https://developer.apple.com/account/resources/identifiers/list/serviceId
   ```

2. **Create Service ID**
   - Configure Sign in with Apple
   - Add return URLs

3. **Environment Variables**
   ```bash
   AUTH_APPLE_ID="your-apple-service-id"
   AUTH_APPLE_SECRET="your-apple-private-key"
   ```

---

## 🌐 **Production Deployment**

### Vercel Deployment (Recommended)

#### Option 1: Universal Setup Script
```bash
./setup.sh prod
```

#### Option 2: Manual Vercel Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables
./scripts/setup-vercel-env.sh
```

### Ubuntu Server Deployment
The universal setup script also supports SSH-based Ubuntu deployment:

```bash
./setup.sh prod
# Choose "Ubuntu Server" when prompted
# Provide SSH credentials
# Script handles file transfer and PM2 setup
```

---

## 📁 **Project Structure**

After installation, your project structure will be:

```
ring/
├── app/                     # Next.js 15 App Router
├── components/              # React components
├── lib/                     # Utilities and configurations
├── scripts/                 # Setup and utility scripts
│   ├── setup.sh            # Universal setup script
│   ├── import-firebase-service-account.sh
│   ├── setup-vercel-env.sh
│   └── setup-env.js
├── .env.local              # Environment variables (created during setup)
├── package.json
└── README.md
```

---

## 🔧 **Development Commands**

```bash
# Development
npm run dev          # Start development server
npm run debug        # Start with Node.js debugger

# Production  
npm run build        # Create production build
npm start           # Start production server

# Environment
npm run setup:env    # Interactive environment setup
npm run setup:new    # Force new environment setup

# Code Quality
npm run lint         # Run ESLint
npm run clean        # Clean build artifacts
npm test            # Run test suite
```

---

## 🚨 **Troubleshooting**

### Common Issues

#### Script Permission Denied
```bash
chmod +x ./setup.sh
chmod +x ./scripts/*.sh
```

#### Firebase Service Account Import Fails
```bash
# Ensure JSON file is valid Firebase service account
jq '.type' your-service-account.json
# Should return: "service_account"

# Check file permissions
ls -la your-service-account.json
```

#### Environment Variables Not Loading
```bash
# Check .env.local exists and has correct format
cat .env.local

# Restart development server
npm run dev
```

#### Build Fails in Production
```bash
# Check all environment variables are set in Vercel
vercel env ls

# Ensure Firebase credentials are properly formatted
# Check for trailing newlines or quote issues
```

### Getting Help

1. **Check Documentation**
   - [Ring Platform Docs](https://docs.ring.ck.ua)
   - [Interactive Notebooks](https://docs.ring.ck.ua/notebooks/)

2. **Script Debugging**
   ```bash
   # Run scripts with verbose output
   bash -x ./setup.sh
   bash -x ./scripts/import-firebase-service-account.sh your-file.json
   ```

3. **Environment Validation**
   ```bash
   # Check Node.js version
   node --version  # Should be v22.9.0+
   
   # Check npm version  
   npm --version   # Should be v10.8.3+
   
   # Validate Firebase configuration
   npm run setup:env
   ```

---

## ✅ **Post-Installation Verification**

After successful installation, verify everything works:

1. **Development Server**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Should see Ring Platform homepage
   ```

2. **Authentication**
   - Test Google Sign-in (if configured)
   - Test email authentication
   - Check user profile creation

3. **Firebase Integration**
   - Create a test entity
   - Post a news item
   - Test real-time updates

4. **Production Build**
   ```bash
   npm run build
   # Should complete without errors
   # Build time: ~15 seconds
   ```

---

## 🎯 **Next Steps**

After installation:

1. **Explore Documentation**
   - Visit [Interactive Notebooks](https://docs.ring.ck.ua/notebooks/)
   - Try API testing notebooks
   - Review architecture documentation

2. **Customize Configuration**
   - Update branding and styling
   - Configure additional OAuth providers
   - Set up custom domain

3. **Deploy to Production**
   - Use `./setup.sh prod` for Vercel deployment
   - Configure custom domain
   - Set up monitoring and analytics

---

*Ring Platform Installation Guide - Complete setup in minutes with beautiful automation*

**Support**: For installation issues, check our [troubleshooting guide](./troubleshooting.md) or [interactive documentation](https://docs.ring.ck.ua/notebooks/). 