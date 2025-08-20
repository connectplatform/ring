# 🚀 Ring Platform Setup Guide

## Quick Start Checklist

This guide will help you set up Ring Platform with all its features, including automatic Web3 wallet creation for users.

## Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project (free tier is sufficient)
- Google Cloud Console access (for OAuth)

## Step 1: Environment Configuration

### 1.1 Create Environment File

```bash
cp env.local.template .env.local
```

### 1.2 Generate Required Keys

#### Auth Secret (REQUIRED)
```bash
npx auth secret
```
Copy the generated secret to `AUTH_SECRET` in `.env.local`

#### Wallet Encryption Key (REQUIRED for wallet features)
```bash
openssl rand -hex 32
```
Copy the generated key to `WALLET_ENCRYPTION_KEY` in `.env.local`

## Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create Project"
3. Name it (e.g., "ring-platform")
4. Disable Google Analytics (optional)

### 2.2 Enable Required Services

In Firebase Console, enable:
- **Authentication** → Sign-in methods → Enable Google provider
- **Firestore Database** → Create database → Start in test mode
- **Storage** → Get started → Start in test mode

### 2.3 Get Firebase Admin SDK Credentials

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the downloaded JSON file
4. Copy values to `.env.local`:
   ```
   AUTH_FIREBASE_PROJECT_ID=your-project-id
   AUTH_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   AUTH_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_CLIENT_ID=your-client-id
   ```

### 2.4 Get Firebase Client SDK Config

1. Go to Project Settings → General
2. Under "Your apps", click "Add app" → Web
3. Register app with a nickname
4. Copy the config values to `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

### 2.5 Enable Push Notifications (Optional)

1. In Project Settings → Cloud Messaging
2. Generate Web Push certificate
3. Copy "Key pair" to `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

## Step 3: Google OAuth Setup

### 3.1 Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create new)
3. APIs & Services → OAuth consent screen
4. Configure for "External" users
5. Fill required fields (app name, support email, etc.)

### 3.2 Create OAuth Credentials

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Application type: Web application
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)
4. Copy credentials to `.env.local`:
   ```
   AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=your-client-secret
   ```

## Step 4: Initialize Firebase Data

### 4.1 Deploy Firestore Security Rules

```bash
npm run firebase:deploy:rules
```

### 4.2 Create Initial Collections

Run the initialization script:
```bash
npm run init:db
```

Or manually create these collections in Firestore:
- `users`
- `entities`
- `opportunities`
- `messages`
- `notifications`

### 4.3 Seed Sample Opportunities (Optional)

Seed a couple of opportunities to verify the UI end-to-end:

```bash
cd ring
npm run seed:opportunities
```

This script requires the Firebase Admin credentials in `.env.local` (`AUTH_FIREBASE_PROJECT_ID`, `AUTH_FIREBASE_CLIENT_EMAIL`, `AUTH_FIREBASE_PRIVATE_KEY`).

## Step 5: Test Your Setup

### 5.1 Start Development Server

```bash
npm run dev
```

### 5.2 Verify Core Features

1. **Authentication**: 
   - Navigate to http://localhost:3000
   - Click "Sign In" → "Sign in with Google"
   - Complete OAuth flow

2. **Wallet Creation**:
   - After signing in, go to Profile
   - Check if wallet address is displayed
   - If not, check server logs for errors

3. **Opportunities**:
   - Navigate to Opportunities page
   - Should show intro screen for non-logged users
   - After login, should display opportunities list

## Troubleshooting

### Common Issues

#### "Wallet encryption key is not set"
- Ensure `WALLET_ENCRYPTION_KEY` is set in `.env.local`
- Generate key: `openssl rand -hex 32`
- Restart dev server after adding

#### "FETCH_FAILED" on Opportunities page
- Check Firebase Admin SDK credentials in `.env.local`
- Verify Firestore is enabled in Firebase Console
- Check if `opportunities` collection exists

#### "User wallet not found"
- This is normal for new users
- The wallet is created on first access
- Check server logs for creation errors

#### Google Sign-in not working
- Verify OAuth credentials in `.env.local`
- Check redirect URIs in Google Cloud Console
- Ensure Firebase Authentication has Google provider enabled

### Environment Variables Reference

Required for basic functionality:
- `AUTH_SECRET` - Auth.js session encryption
- `AUTH_FIREBASE_*` - Firebase Admin SDK
- `NEXT_PUBLIC_FIREBASE_*` - Firebase Client SDK
- `AUTH_GOOGLE_*` - Google OAuth

Required for wallet features:
- `WALLET_ENCRYPTION_KEY` - Wallet private key encryption
- `POLYGON_RPC_URL` - Blockchain connectivity

## Production Deployment

### Additional Steps for Production

1. **Update URLs**:
   - `NEXTAUTH_URL` → Your production URL
   - `NEXT_PUBLIC_API_URL` → Your production API URL

2. **Secure Firebase**:
   - Deploy production security rules
   - Enable App Check
   - Set up backup policies

3. **Environment Security**:
   - Use secrets management (Vercel, AWS Secrets Manager, etc.)
   - Never commit `.env.local` or `.env.production`
   - Rotate `WALLET_ENCRYPTION_KEY` periodically

4. **Monitoring**:
   - Set up error tracking (Sentry)
   - Enable Firebase Performance Monitoring
   - Configure alerts for wallet creation failures

## Support

For issues or questions:
- Check `/docs` folder for detailed documentation
- Review AI-CONTEXT files for implementation details
- Open an issue on GitHub

## Next Steps

After successful setup:
1. Explore the admin panel at `/admin`
2. Create your first entity at `/entities/add`
3. Post an opportunity at `/opportunities/add`
4. Test messaging features
5. Customize branding in `/whitelabel/config.json`
