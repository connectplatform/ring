#!/bin/bash

# Ring Platform CLI Installation Script

echo "🚀 Installing Ring Platform CLI..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install the CLI globally
echo "📦 Installing CLI globally..."
npm link

if [ $? -eq 0 ]; then
    echo "✅ Ring Platform CLI installed successfully!"
    echo ""
    echo "Usage:"
    echo "  ring --prod           # Deploy to production"
    echo "  ring config --list    # Show configuration"
    echo "  ring status           # Check deployment status"
    echo "  ring --help           # Show all commands"
    echo ""
    echo "Configuration is stored in: ~/.ring-platform/config.json"
else
    echo "❌ Failed to install CLI"
    exit 1
fi
