#!/bin/bash

# Vercel Environment Variables Setup Script
# Run this script after getting your Firebase configuration

echo "🚀 Setting up Vercel Environment Variables for Ring Project"
echo "=========================================================="

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "npm i -g vercel"
    exit 1
fi

echo "📋 This script will help you set up environment variables in Vercel"
echo "⚠️  Make sure you have your Firebase configuration ready!"
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ Found .env.local file"
    read -p "Do you want to auto-import values from .env.local? (Y/n): " auto_import
    echo ""
else
    auto_import="n"
fi

# Function to set environment variable with update support
set_env_var() {
    local var_name=$1
    local var_description=$2
    local is_sensitive=${3:-true}
    local environments=("production" "preview" "development")
    
    echo "Setting up: $var_name"
    echo "Description: $var_description"
    
    # Check if variable already exists
    if vercel env ls 2>/dev/null | grep -q "$var_name"; then
        echo "⚠️  Variable $var_name already exists"
        read -p "Do you want to update it? (y/N): " update_choice
        if [[ ! $update_choice =~ ^[Yy]$ ]]; then
            echo "⏭️  Skipping $var_name"
            echo ""
            return
        fi
        
        # Remove existing variable from all environments
        for env in "${environments[@]}"; do
            echo "🗑️  Removing existing $var_name from $env..."
            vercel env rm "$var_name" "$env" --yes 2>/dev/null || true
        done
    fi
    
    read -p "Enter value for $var_name: " var_value
    
    if [ -n "$var_value" ]; then
        local success_count=0
        
        for env in "${environments[@]}"; do
            echo "📝 Setting $var_name for $env environment..."
            if vercel env add "$var_name" "$env" <<< "$var_value" 2>/dev/null; then
                ((success_count++))
            else
                echo "❌ Failed to set $var_name for $env"
            fi
        done
        
        if [ $success_count -eq 3 ]; then
            echo "✅ $var_name set successfully for all environments"
        else
            echo "⚠️  $var_name set for $success_count/3 environments"
        fi
    else
        echo "⚠️  Skipping $var_name (empty value)"
    fi
    echo ""
}

# Function to set environment variable from local .env file
set_env_from_local() {
    local var_name=$1
    local description=$2
    local is_sensitive=${3:-true}
    
    # Try to get value from .env.local
    local var_value=""
    if [ -f ".env.local" ]; then
        var_value=$(grep "^$var_name=" .env.local | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
    fi
    
    echo "Setting up: $var_name"
    echo "Description: $description"
    
    if [ -n "$var_value" ]; then
        echo "✅ Found value in .env.local"
        read -p "Use this value? (Y/n): " use_local
        if [[ ! $use_local =~ ^[Nn]$ ]]; then
            # Use the local value
            local environments=("production" "preview" "development")
            local success_count=0
            
            # Remove existing if present
            for env in "${environments[@]}"; do
                vercel env rm "$var_name" "$env" --yes 2>/dev/null || true
            done
            
            for env in "${environments[@]}"; do
                if vercel env add "$var_name" "$env" <<< "$var_value" 2>/dev/null; then
                    ((success_count++))
                fi
            done
            
            if [ $success_count -eq 3 ]; then
                echo "✅ $var_name set successfully for all environments"
            else
                echo "⚠️  $var_name set for $success_count/3 environments"
            fi
            echo ""
            return
        fi
    fi
    
    # Fall back to manual input
    set_env_var "$var_name" "$description" "$is_sensitive"
}

# Required environment variables
echo "🔥 Firebase Client Configuration"
echo "Get these from: https://console.firebase.google.com → Project Settings → General → Web apps"
echo ""

# Choose function based on auto_import preference
if [[ $auto_import =~ ^[Yy]$ ]] || [[ -z $auto_import ]]; then
    set_env_from_local "NEXT_PUBLIC_FIREBASE_API_KEY" "Firebase API Key from web app config" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "Firebase Auth Domain (project-id.firebaseapp.com)" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "Firebase Project ID" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "Firebase Storage Bucket (project-id.appspot.com)" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "Firebase Messaging Sender ID" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_APP_ID" "Firebase App ID" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" "Firebase Measurement ID (G-XXXXXXXXXX)" false
    set_env_from_local "NEXT_PUBLIC_FIREBASE_VAPID_KEY" "Firebase VAPID Key for Push Notifications" true

    echo "🔐 Firebase Admin Configuration"
    echo "Get these from: Firebase Console → Project Settings → Service Accounts → Generate new private key"
    echo ""

    set_env_from_local "AUTH_FIREBASE_PROJECT_ID" "Firebase Project ID (same as above)" true
    set_env_from_local "AUTH_FIREBASE_CLIENT_EMAIL" "Service Account Email" true
    set_env_from_local "AUTH_FIREBASE_PRIVATE_KEY" "Service Account Private Key (keep \\n as literal)" true

    echo "🔑 NextAuth Configuration"
    echo ""

    # Special handling for NEXTAUTH_URL - don't use localhost for production
    echo "Setting up: NEXTAUTH_URL"
    echo "Description: Production URL (https://your-app.vercel.app)"
    echo "⚠️  Note: Will not use localhost value from .env.local for production"
    read -p "Enter your production URL (https://your-app.vercel.app): " nextauth_url
    
    if [ -n "$nextauth_url" ]; then
        local environments=("production" "preview" "development")
        local success_count=0
        
        # Remove existing if present
        for env in "${environments[@]}"; do
            vercel env rm "NEXTAUTH_URL" "$env" --yes 2>/dev/null || true
        done
        
        for env in "${environments[@]}"; do
            if vercel env add "NEXTAUTH_URL" "$env" <<< "$nextauth_url" 2>/dev/null; then
                ((success_count++))
            fi
        done
        
        if [ $success_count -eq 3 ]; then
            echo "✅ NEXTAUTH_URL set successfully for all environments"
        else
            echo "⚠️  NEXTAUTH_URL set for $success_count/3 environments"
        fi
    else
        echo "⚠️  Skipping NEXTAUTH_URL (empty value)"
    fi
    echo ""
    set_env_from_local "AUTH_SECRET" "Auth.js v5 Secret (generate with: openssl rand -base64 32)" true
else
    set_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" "Firebase API Key from web app config" false
    set_env_var "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "Firebase Auth Domain (project-id.firebaseapp.com)" false
    set_env_var "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "Firebase Project ID" false
    set_env_var "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "Firebase Storage Bucket (project-id.appspot.com)" false
    set_env_var "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "Firebase Messaging Sender ID" false
    set_env_var "NEXT_PUBLIC_FIREBASE_APP_ID" "Firebase App ID" false
    set_env_var "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" "Firebase Measurement ID (G-XXXXXXXXXX)" false
    set_env_var "NEXT_PUBLIC_FIREBASE_VAPID_KEY" "Firebase VAPID Key for Push Notifications" true

    echo "🔐 Firebase Admin Configuration"
    echo "Get these from: Firebase Console → Project Settings → Service Accounts → Generate new private key"
    echo ""

    set_env_var "AUTH_FIREBASE_PROJECT_ID" "Firebase Project ID (same as above)" true
    set_env_var "AUTH_FIREBASE_CLIENT_EMAIL" "Service Account Email" true
    set_env_var "AUTH_FIREBASE_PRIVATE_KEY" "Service Account Private Key (keep \\n as literal)" true

    echo "🔑 NextAuth Configuration"
    echo ""

    set_env_var "NEXTAUTH_URL" "Production URL (https://your-app.vercel.app)" false
    set_env_var "AUTH_SECRET" "Auth.js v5 Secret (generate with: openssl rand -base64 32)" true
fi

echo "🎉 Environment variables setup completed!"
echo "🚀 Ready to deploy with: vercel --prod"
echo ""
echo "📝 Note: If you need to update any variables later, use:"
echo "   vercel env rm VARIABLE_NAME"
echo "   vercel env add VARIABLE_NAME" 