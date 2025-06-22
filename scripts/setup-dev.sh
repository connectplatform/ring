#!/bin/bash

# =============================================================================
# 🎯 RING PLATFORM - Development Environment Setup Script
# =============================================================================
# Beautiful Linux-style installation script with oh-my-zsh aesthetics
# Version: 1.0.0 - Development Environment Focus
# =============================================================================

# Color definitions for beautiful output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Unicode symbols for beautiful formatting
ROCKET="🚀"
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
FIRE="🔥"
GEAR="⚙️"
SPARKLES="✨"
PACKAGE="📦"
KEY="🔑"
GLOBE="🌐"
COMPUTER="💻"
FOLDER="📁"

# Script metadata
SCRIPT_NAME="Ring Platform Dev Setup"
SCRIPT_VERSION="1.0.0"
PROJECT_NAME="Ring Platform"

# =============================================================================
# Utility Functions
# =============================================================================

print_banner() {
    echo -e "${PURPLE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo "║    ${ROCKET} ${WHITE}RING PLATFORM - DEVELOPMENT ENVIRONMENT SETUP${PURPLE}${BOLD}                    ║"
    echo "║                                                                              ║"
    echo "║    ${WHITE}Version: ${SCRIPT_VERSION} ${DIM}| Focus: Development Environment${PURPLE}${BOLD}                      ║"
    echo "║    ${WHITE}Next.js 15 + Firebase + Auth.js v5 + TailwindCSS${PURPLE}${BOLD}                    ║"
    echo "║                                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo
}

print_step() {
    local step_num=$1
    local step_name=$2
    echo -e "${CYAN}${BOLD}[$step_num/8] ${GEAR} $step_name${RESET}"
    echo -e "${DIM}────────────────────────────────────────────────────────────────────────────${RESET}"
    echo
}

print_success() {
    echo -e "${GREEN}${BOLD}${CHECK} $1${RESET}"
}

print_error() {
    echo -e "${RED}${BOLD}${CROSS} $1${RESET}"
}

print_warning() {
    echo -e "${YELLOW}${BOLD}${WARNING} $1${RESET}"
}

print_info() {
    echo -e "${BLUE}${BOLD}${INFO} $1${RESET}"
}

print_link() {
    local description=$1
    local url=$2
    echo -e "${BLUE}${BOLD}${GLOBE} $description${RESET}"
    echo -e "${DIM}   Ctrl+Click to open: ${CYAN}$url${RESET}"
    echo
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

detect_ide() {
    if command -v cursor >/dev/null 2>&1; then
        echo "cursor"
    elif command -v code >/dev/null 2>&1; then
        echo "vscode"
    else
        echo "none"
    fi
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

prompt_continue() {
    local message=${1:-"Continue with the setup?"}
    echo
    read -p "$(echo -e "${YELLOW}${BOLD}${message} ${DIM}(y/N):${RESET} ")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Setup cancelled by user"
        exit 1
    fi
    echo
}

# =============================================================================
# Step 1: System Requirements Check
# =============================================================================

step_1_system_check() {
    print_step 1 "System Requirements Check"
    
    local os=$(detect_os)
    local ide=$(detect_ide)
    
    print_info "Detected OS: $os"
    print_info "Detected IDE: $ide"
    
    # Check Node.js
    if check_command node; then
        local node_version=$(node --version)
        print_success "Node.js found: $node_version"
    else
        print_error "Node.js not found - will install via package manager"
    fi
    
    # Check Git
    if check_command git; then
        print_success "Git found: $(git --version)"
    else
        print_error "Git not found - please install Git first"
        exit 1
    fi
    
    echo
    prompt_continue "System check completed. Continue with package installation?"
}

# =============================================================================
# Step 2: Install Required Packages
# =============================================================================

step_2_install_packages() {
    print_step 2 "Installing Required Packages"
    
    local os=$(detect_os)
    
    if [[ "$os" == "macos" ]]; then
        # macOS with Homebrew
        if ! check_command brew; then
            print_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        print_info "Installing packages via Homebrew..."
        brew install node npm firebase-cli vercel
        
    elif [[ "$os" == "linux" ]]; then
        # Linux with apt
        print_info "Installing packages via apt..."
        sudo apt update
        sudo apt install -y curl software-properties-common
        
        # Install Node.js via NodeSource
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        
        # Install Firebase CLI
        npm install -g firebase-tools
        
        # Install Vercel CLI
        npm install -g vercel
        
    else
        print_error "Unsupported operating system: $os"
        print_info "Please install Node.js, npm, firebase-cli, and vercel manually"
        exit 1
    fi
    
    print_success "All required packages installed!"
    echo
}

# =============================================================================
# Step 3: Project Dependencies
# =============================================================================

step_3_project_dependencies() {
    print_step 3 "Installing Project Dependencies"
    
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    print_info "Installing npm dependencies..."
    npm install
    
    print_success "Project dependencies installed!"
    echo
}

# =============================================================================
# Step 4: Firebase Configuration
# =============================================================================

step_4_firebase_setup() {
    print_step 4 "Firebase Configuration Setup"
    
    echo -e "${FIRE}${BOLD} Firebase Project Setup${RESET}"
    echo
    
    print_link "1. Go to Firebase Console" "https://console.firebase.google.com"
    print_link "2. Create a new project (or select existing)" "https://console.firebase.google.com"
    print_link "3. Enable Authentication" "https://console.firebase.google.com/project/_/authentication"
    print_link "4. Enable Firestore Database" "https://console.firebase.google.com/project/_/firestore"
    print_link "5. Get Web App Config" "https://console.firebase.google.com/project/_/settings/general"
    
    echo -e "${YELLOW}${BOLD}Required Information:${RESET}"
    echo -e "${DIM}You'll need to collect the following from Firebase Console:${RESET}"
    echo -e "  • API Key"
    echo -e "  • Auth Domain"
    echo -e "  • Project ID"
    echo -e "  • Storage Bucket"
    echo -e "  • Messaging Sender ID"
    echo -e "  • App ID"
    echo -e "  • Measurement ID"
    echo
    
    prompt_continue "Have you created your Firebase project and collected the configuration?"
}

# =============================================================================
# Step 5: OAuth Providers Setup
# =============================================================================

step_5_oauth_setup() {
    print_step 5 "OAuth Providers Configuration"
    
    echo -e "${KEY}${BOLD} OAuth Provider Setup${RESET}"
    echo
    
    print_link "Google OAuth Console" "https://console.developers.google.com/apis/credentials"
    echo -e "${DIM}   • Create OAuth 2.0 Client ID${RESET}"
    echo -e "${DIM}   • Set authorized redirect URI: http://localhost:3000/api/auth/callback/google${RESET}"
    echo
    
    print_link "Apple Developer Portal" "https://developer.apple.com/account/resources/identifiers/list/serviceId"
    echo -e "${DIM}   • Create Services ID for Sign in with Apple${RESET}"
    echo -e "${DIM}   • Configure return URLs${RESET}"
    echo
    
    prompt_continue "Have you set up your OAuth providers?"
}

# =============================================================================
# Step 6: Environment Variables Setup
# =============================================================================

step_6_env_setup() {
    print_step 6 "Environment Variables Configuration"
    
    local template_file="env.local.template"
    local env_file=".env.local"
    
    if [[ ! -f "$template_file" ]]; then
        print_error "env.local.template not found!"
        exit 1
    fi
    
    # Check if .env.local exists
    if [[ -f "$env_file" ]]; then
        print_warning ".env.local already exists!"
        read -p "$(echo -e "${YELLOW}Overwrite existing .env.local? ${DIM}(y/N):${RESET} ")" -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env.local"
            return
        fi
    fi
    
    # Copy template to .env.local
    cp "$template_file" "$env_file"
    print_success "Created .env.local from template"
    
    # Generate AUTH_SECRET
    print_info "Generating AUTH_SECRET..."
    local auth_secret=$(openssl rand -base64 32)
    
    # Replace AUTH_SECRET in .env.local
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/AUTH_SECRET=\"\"/AUTH_SECRET=\"$auth_secret\"/" "$env_file"
    else
        sed -i "s/AUTH_SECRET=\"\"/AUTH_SECRET=\"$auth_secret\"/" "$env_file"
    fi
    
    print_success "Generated and set AUTH_SECRET"
    
    # Open .env.local in IDE
    local ide=$(detect_ide)
    if [[ "$ide" != "none" ]]; then
        print_info "Opening .env.local in $ide for manual configuration..."
        if [[ "$ide" == "cursor" ]]; then
            cursor "$env_file"
        else
            code "$env_file"
        fi
    else
        print_warning "No IDE detected. Please edit .env.local manually"
    fi
    
    echo
    print_warning "Please update all the placeholder values in .env.local with your actual configuration"
    prompt_continue "Have you updated all the environment variables?"
}

# =============================================================================
# Step 7: IDE Configuration
# =============================================================================

step_7_ide_config() {
    print_step 7 "IDE Configuration Setup"
    
    local ide=$(detect_ide)
    
    if [[ "$ide" == "none" ]]; then
        print_warning "No IDE detected (Cursor or VS Code)"
        print_info "Skipping IDE configuration..."
        return
    fi
    
    print_info "Detected IDE: $ide"
    
    # Check if .vscode directory exists
    if [[ -d ".vscode" ]]; then
        print_success ".vscode configuration found"
        
        if [[ "$ide" == "cursor" ]]; then
            print_info "Cursor will automatically use VS Code configuration"
        fi
        
        # List available configurations
        echo -e "${DIM}Available configurations:${RESET}"
        for file in .vscode/*; do
            if [[ -f "$file" ]]; then
                echo -e "  ${CHECK} $(basename "$file")"
            fi
        done
    else
        print_warning ".vscode configuration not found"
        print_info "Creating basic .vscode configuration..."
        
        mkdir -p .vscode
        
        # Create basic settings.json
        cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "git.enableSmartCommit": true,
  "git.autofetch": true
}
EOF
        print_success "Created basic .vscode/settings.json"
    fi
    
    print_success "IDE configuration completed!"
    echo
}

# =============================================================================
# Step 8: Start Development Server
# =============================================================================

step_8_start_server() {
    print_step 8 "Starting Development Server"
    
    print_info "Running final setup checks..."
    
    # Check if .env.local has been configured
    if grep -q "your_api_key" .env.local 2>/dev/null; then
        print_warning "Environment variables still contain placeholder values"
        print_info "The server will start, but some features may not work until configured"
    fi
    
    print_info "Starting Next.js development server..."
    echo
    echo -e "${GREEN}${BOLD}${SPARKLES} Development server starting...${RESET}"
    echo -e "${DIM}Press Ctrl+C to stop the server${RESET}"
    echo
    
    # Start the development server
    npm run dev
}

# =============================================================================
# Success Message
# =============================================================================

print_success_message() {
    echo
    echo -e "${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo "║    ${SPARKLES} ${WHITE}RING PLATFORM DEVELOPMENT ENVIRONMENT READY!${GREEN}${BOLD}                    ║"
    echo "║                                                                              ║"
    echo "║    ${WHITE}Your development server is running at:${GREEN}${BOLD}                                ║"
    echo "║    ${CYAN}http://localhost:3000${GREEN}${BOLD}                                                 ║"
    echo "║                                                                              ║"
    echo "║    ${WHITE}Next steps:${GREEN}${BOLD}                                                           ║"
    echo "║    ${DIM}• Configure remaining environment variables in .env.local${GREEN}${BOLD}            ║"
    echo "║    ${DIM}• Test authentication with your OAuth providers${GREEN}${BOLD}                     ║"
    echo "║    ${DIM}• Review Firebase security rules${GREEN}${BOLD}                                     ║"
    echo "║                                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
}

# =============================================================================
# Error Handling
# =============================================================================

handle_error() {
    echo
    print_error "Setup failed at step: $1"
    echo -e "${DIM}Check the error messages above for details${RESET}"
    echo -e "${DIM}You can re-run this script to continue setup${RESET}"
    exit 1
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Clear screen and show banner
    clear
    print_banner
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "env.local.template" ]]; then
        print_error "Please run this script from the Ring project root directory"
        exit 1
    fi
    
    # Welcome message
    echo -e "${YELLOW}${BOLD}Welcome to the Ring Platform development environment setup!${RESET}"
    echo -e "${DIM}This script will guide you through setting up everything needed for development.${RESET}"
    echo
    prompt_continue "Ready to begin setup?"
    
    # Execute setup steps
    trap 'handle_error "System Check"' ERR
    step_1_system_check
    
    trap 'handle_error "Package Installation"' ERR
    step_2_install_packages
    
    trap 'handle_error "Project Dependencies"' ERR
    step_3_project_dependencies
    
    trap 'handle_error "Firebase Setup"' ERR
    step_4_firebase_setup
    
    trap 'handle_error "OAuth Setup"' ERR
    step_5_oauth_setup
    
    trap 'handle_error "Environment Variables"' ERR
    step_6_env_setup
    
    trap 'handle_error "IDE Configuration"' ERR
    step_7_ide_config
    
    # Final success message
    print_success_message
    
    # Start the development server
    echo
    prompt_continue "Start the development server now?"
    
    trap 'handle_error "Development Server"' ERR
    step_8_start_server
}

# Run main function
main "$@" 