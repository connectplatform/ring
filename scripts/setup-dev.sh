#!/bin/bash

# =============================================================================
# 🎯 RING PLATFORM - Environment Setup Script
# =============================================================================
# Version: 1.0.0 - Development & Production Environment Setup
# 
# Usage:
#   ./setup-dev.sh         # Development environment setup
#   ./setup-dev.sh dev     # Development environment setup (explicit)
#   ./setup-dev.sh prod    # Production deployment setup
#
# =============================================================================

# Color definitions
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

# Emoji symbols
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
SETUP_MODE="${1:-dev}"  # Default to dev mode

# =============================================================================
# Utility Functions
# =============================================================================

print_motd() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "████████████████████████████████████████████████████████████████"
    echo "██                                                            ██"
    echo "██               ██████╗ ██╗███╗   ██╗ ██████╗                ██"
    echo "██               ██╔══██╗██║████╗  ██║██╔════╝                ██"
    echo "██               ██████╔╝██║██╔██╗ ██║██║  ███╗               ██"
    echo "██               ██╔══██╗██║██║╚██╗██║██║   ██║               ██"
    echo "██               ██║  ██║██║██║ ╚████║╚██████╔╝               ██"
    echo "██               ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝                ██"
    echo "██                                                            ██"
    echo -e "██                    ${YELLOW}${BOLD}♦ WELCOME TO RING ♦${CYAN}${BOLD}                     ██"
    echo "██                                                            ██"
    echo -e "██  ${WHITE}Ring is an AI-assisted collaborative platform designed${CYAN}${BOLD}    ██"
    echo -e "██  ${WHITE}to benefit humanity through intelligent cooperation and${CYAN}${BOLD}   ██"
    echo -e "██  ${WHITE}shared innovation.${CYAN}${BOLD}                                        ██"
    echo "██                                                            ██"
    echo -e "██  ${GREEN}${BOLD}Join our legion of light by contributing your modules or${CYAN}${BOLD}  ██"
    echo -e "██  ${GREEN}${BOLD}deploying Ring in production environments for everyone's${CYAN}${BOLD}  ██"
    echo -e "██  ${GREEN}${BOLD}benefit.${CYAN}${BOLD}                                                  ██"
    echo "██                                                            ██"
    # Adjust spacing based on environment name length to preserve right boundary
    if [[ "$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')" == "PROD" ]]; then
        echo -e "██  ${PURPLE}${BOLD}▶ Environment: ${YELLOW}$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')${CYAN}${BOLD}                                       ██"
    else
        echo -e "██  ${PURPLE}${BOLD}▶ Environment: ${YELLOW}$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')${CYAN}${BOLD}                                        ██"
    fi
    echo -e "██  ${PURPLE}${BOLD}▶ Script Version: ${SCRIPT_VERSION}${CYAN}${BOLD}                                   ██"
    echo "██                                                            ██"
    echo "████████████████████████████████████████████████████████████████"
    echo -e "${RESET}"
    echo
    echo -e "${YELLOW}${BOLD}Press any key to continue...${RESET}"
    read -n 1 -s
    echo
}

print_step() {
    local step_num=$1
    local step_name=$2
    echo -e "${CYAN}${BOLD}[$step_num/8] ⚙️ $step_name${RESET}"
    echo -e "${DIM}────────────────────────────────────────────────────────────────────────────${RESET}"
    echo
}

print_success() {
    echo -e "${GREEN}${BOLD}✅ $1${RESET}"
}

print_error() {
    echo -e "${RED}${BOLD}❌ $1${RESET}"
}

print_warning() {
    echo -e "${YELLOW}${BOLD}⚠️ $1${RESET}"
}

print_info() {
    echo -e "${BLUE}${BOLD}ℹ️ $1${RESET}"
}

print_link() {
    local description=$1
    local url=$2
    echo -e "${BLUE}${BOLD}🌐 $description${RESET}"
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
    read -p "$(echo -e "${YELLOW}${BOLD}${message} ${DIM}(Y/n):${RESET} ")" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_error "Setup cancelled by user"
        exit 1
    fi
    echo
}

prompt_destructive() {
    local message=${1:-"Proceed with this action?"}
    echo
    read -p "$(echo -e "${YELLOW}${BOLD}${message} ${DIM}(y/N):${RESET} ")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

select_deployment_provider() {
    echo -e "${BLUE}${BOLD}🚀 Production Deployment Options${RESET}"
    echo
    echo -e "${DIM}Select your preferred hosting provider:${RESET}"
    echo -e "  ${CYAN}1.${RESET} Vercel (Recommended - Zero config deployment)"
    echo -e "  ${CYAN}2.${RESET} Ubuntu Server (SSH deployment)"
    echo -e "  ${CYAN}3.${RESET} Cancel and return to development setup"
    echo
    
    while true; do
        read -p "$(echo -e "${YELLOW}${BOLD}Choose deployment option ${DIM}(1-3):${RESET} ")" -n 1 -r
        echo
        case $REPLY in
            1)
                DEPLOYMENT_PROVIDER="vercel"
                break
                ;;
            2)
                DEPLOYMENT_PROVIDER="ubuntu"
                break
                ;;
            3)
                print_info "Switching to development setup..."
                SETUP_MODE="dev"
                return
                ;;
            *)
                print_error "Invalid option. Please select 1, 2, or 3."
                ;;
        esac
    done
    
    echo
    print_success "Selected: $DEPLOYMENT_PROVIDER deployment"
}

# =============================================================================
# Production Deployment Functions
# =============================================================================

deploy_to_vercel() {
    print_step 1 "Vercel Production Deployment"
    
    print_info "Preparing Vercel deployment..."
    
    # Check if already logged in to Vercel
    if ! vercel whoami >/dev/null 2>&1; then
        print_info "Logging into Vercel..."
        vercel login
    else
        print_success "Already logged into Vercel: $(vercel whoami)"
    fi
    
    # Build the project
    print_info "Building project for production..."
    npm run build
    
    # Deploy to Vercel
    print_info "Deploying to Vercel..."
    vercel --prod
    
    print_success "Deployment completed! Check your Vercel dashboard for the live URL."
}

deploy_to_ubuntu() {
    print_step 1 "Ubuntu Server Deployment"
    
    print_info "Setting up Ubuntu server deployment..."
    
    # Get server details
    echo -e "${YELLOW}${BOLD}Ubuntu Server Configuration:${RESET}"
    read -p "$(echo -e "${CYAN}Server IP/Domain: ${RESET}")" SERVER_HOST
    read -p "$(echo -e "${CYAN}SSH Username: ${RESET}")" SSH_USER
    read -p "$(echo -e "${CYAN}SSH Port (default 22): ${RESET}")" SSH_PORT
    SSH_PORT=${SSH_PORT:-22}
    
    # Test SSH connection
    print_info "Testing SSH connection..."
    if ssh -p "$SSH_PORT" -o ConnectTimeout=10 "$SSH_USER@$SERVER_HOST" "echo 'Connection successful'" >/dev/null 2>&1; then
        print_success "SSH connection established"
    else
        print_error "Failed to connect to server. Please check your credentials."
        return 1
    fi
    
    # Build the project
    print_info "Building project for production..."
    npm run build
    
    # Create deployment script
    cat > deploy-to-ubuntu.sh << EOF
#!/bin/bash
set -e

echo "🚀 Deploying Ring Platform to Ubuntu Server..."

# Upload build files
rsync -avz --delete -e "ssh -p $SSH_PORT" .next/ $SSH_USER@$SERVER_HOST:~/ring-platform/.next/
rsync -avz -e "ssh -p $SSH_PORT" package.json $SSH_USER@$SERVER_HOST:~/ring-platform/
rsync -avz -e "ssh -p $SSH_PORT" public/ $SSH_USER@$SERVER_HOST:~/ring-platform/public/

# Install dependencies and restart on server
ssh -p $SSH_PORT $SSH_USER@$SERVER_HOST << 'ENDSSH'
cd ~/ring-platform
npm ci --only=production
pm2 restart ring-platform || pm2 start npm --name "ring-platform" -- start
ENDSSH

echo "✅ Deployment completed!"
EOF
    
    chmod +x deploy-to-ubuntu.sh
    
    print_info "Executing deployment..."
    ./deploy-to-ubuntu.sh
    
    print_success "Ubuntu deployment completed!"
    print_info "Your Ring Platform should be running on your Ubuntu server"
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
        brew install node npm firebase-cli vercel-cli
        
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
    
    echo -e "🔥${BOLD} Firebase Project Setup${RESET}"
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
    
    echo -e "🔑${BOLD} OAuth Provider Setup${RESET}"
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
        if ! prompt_destructive "Overwrite existing .env.local?"; then
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
                echo -e "  ✅ $(basename "$file")"
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
    
    echo -e "${BLUE}${BOLD}📋 Available Commands:${RESET}"
    echo -e "${DIM}   • ${CYAN}npm run dev${RESET}        - Start development server"
    echo -e "${DIM}   • ${CYAN}npm run build${RESET}      - Build for production"
    echo -e "${DIM}   • ${CYAN}npm run start${RESET}      - Start production server"
    echo -e "${DIM}   • ${CYAN}npm run lint${RESET}       - Run ESLint"
    echo -e "${DIM}   • ${CYAN}npm run type-check${RESET} - Run TypeScript check"
    echo
    
    print_info "Starting Next.js development server..."
    echo
    echo -e "${GREEN}${BOLD}✨ Development server starting...${RESET}"
    echo -e "${GREEN}${BOLD}🎉 If server starts successfully = Installation complete!${RESET}"
    echo -e "${DIM}   Press Ctrl+C to stop server, then start developing! Happy coding! 🚀${RESET}"
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
    echo "╔═══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo -e "║    ✨ ${WHITE}RING PLATFORM DEVELOPMENT ENVIRONMENT READY!${GREEN}${BOLD}             ║"
    echo "║                                                                              ║"
    echo -e "║    ${WHITE}Your development server is running at:${GREEN}${BOLD}                                ║"
    echo -e "║    ${CYAN}http://localhost:3000${GREEN}${BOLD}                                                 ║"
    echo "║                                                                              ║"
    echo -e "║    ${WHITE}Next steps:${GREEN}${BOLD}                                                           ║"
    echo -e "║    ${DIM}• Configure remaining environment variables in .env.local${GREEN}${BOLD}            ║"
    echo -e "║    ${DIM}• Test authentication with your OAuth providers${GREEN}${BOLD}                     ║"
    echo -e "║    ${DIM}• Review Firebase security rules${GREEN}${BOLD}                                     ║"
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
    # Validate setup mode
    if [[ "$SETUP_MODE" != "dev" && "$SETUP_MODE" != "prod" ]]; then
        echo -e "${RED}${BOLD}❌ Invalid setup mode: $SETUP_MODE${RESET}"
        echo -e "${DIM}Usage: $0 [dev|prod]${RESET}"
        exit 1
    fi
    
    # Show MOTD
    print_motd
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "env.local.template" ]]; then
        print_error "Please run this script from the Ring project root directory"
        exit 1
    fi
    
    # Handle production mode
    if [[ "$SETUP_MODE" == "prod" ]]; then
        select_deployment_provider
        
        case $DEPLOYMENT_PROVIDER in
            "vercel")
                deploy_to_vercel
                ;;
            "ubuntu")
                deploy_to_ubuntu
                ;;
            *)
                print_info "Continuing with development setup..."
                SETUP_MODE="dev"
                ;;
        esac
        
        if [[ "$SETUP_MODE" == "prod" ]]; then
            print_success "Production deployment completed!"
            exit 0
        fi
    fi
    
    # Development mode setup
    
    echo -e "${YELLOW}${BOLD}Welcome to the Ring Platform development environment setup!${RESET}"
    echo -e "${DIM}This script will guide you through setting up everything needed for development.${RESET}"
    echo
    
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