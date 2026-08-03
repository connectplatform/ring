#!/bin/bash

# =============================================================================
# 🎯 RING PLATFORM - Open Source Installation Script
# =============================================================================
# Version: 2.2.0 - White-Label Clone Installation with Full Setup + setup-db
# 
# Usage:
#   git clone https://github.com/connectplatform/ring.git && cd ring && ./install.sh
#   ./install.sh                    # Interactive development setup
#   ./install.sh dev                # Development setup (explicit)
#   ./install.sh prod               # Production deployment
#   ./install.sh setup-db           # Create DB + apply data/schema.sql (flattened SSOT)
#   ./install.sh --quick            # Quick setup with defaults
#   ./install.sh --clone-name NAME  # Set clone name directly
#   ./install.sh --help             # Show help
#
# =============================================================================

set -e

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_VERSION="2.2.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="Ring Platform"
SETUP_MODE="${1:-dev}"

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

# Default values
CLONE_NAME=""
QUICK_MODE=false
VERBOSE=false
DISPLAY_NAME=""
CONTACT_EMAIL=""
PRODUCTION_DOMAIN=""
LOCAL_PORT="3000"
SYNC_K8S=false
DB_NAME=""
DB_USER="ring_user"
CREATE_DB_ROLE=false

# =============================================================================
# Utility Functions
# =============================================================================

print_80s_motd() {
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
    echo -e "██  ${GREEN}${BOLD}Join our legiox of light by contributing your modules or${CYAN}${BOLD}  ██"
    echo -e "██  ${GREEN}${BOLD}deploying Ring in production environments for everyone's${CYAN}${BOLD}  ██"
    echo -e "██  ${GREEN}${BOLD}benefit.${CYAN}${BOLD}                                                  ██"
    echo "██                                                            ██"
    echo -e "██  ${PURPLE}${BOLD}▶ Sonoratek LLC / Ringdom — Ring Platform${CYAN}${BOLD}                     ██"
    echo -e "██  ${PURPLE}${BOLD}▶ Script Version: ${SCRIPT_VERSION}${CYAN}${BOLD}                                   ██"
    # Adjust spacing based on environment name length
    if [[ "$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')" == "PROD" ]]; then
        echo -e "██  ${PURPLE}${BOLD}▶ Environment: ${YELLOW}$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')${CYAN}${BOLD}                                       ██"
    else
        echo -e "██  ${PURPLE}${BOLD}▶ Environment: ${YELLOW}$(echo $SETUP_MODE | tr '[:lower:]' '[:upper:]')${CYAN}${BOLD}                                        ██"
    fi
    echo "██                                                            ██"
    echo "████████████████████████████████████████████████████████████████"
    echo -e "${RESET}"
    echo
    if [[ "$QUICK_MODE" == false ]]; then
        echo -e "${YELLOW}${BOLD}Press any key to continue...${RESET}"
        read -n 1 -s
    fi
    echo
}

print_step() {
    local step_num=$1
    local total=$2
    local step_name=$3
    echo
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${CYAN}${BOLD}  [$step_num/$total] ⚙️  $step_name${RESET}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo
}

print_success() { echo -e "${GREEN}${BOLD}✅ $1${RESET}"; }
print_error() { echo -e "${RED}${BOLD}❌ $1${RESET}"; }
print_warning() { echo -e "${YELLOW}${BOLD}⚠️  $1${RESET}"; }
print_info() { echo -e "${BLUE}${BOLD}ℹ️  $1${RESET}"; }
print_action() { echo -e "${PURPLE}${BOLD}▶ $1${RESET}"; }

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
    if [[ "$QUICK_MODE" == true ]]; then
        return 0
    fi
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
    if [[ "$QUICK_MODE" == true ]]; then
        return 0
    fi
    echo
    read -p "$(echo -e "${YELLOW}${BOLD}${message} ${DIM}(y/N):${RESET} ")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

prompt_input() {
    local prompt=$1
    local default=$2
    local result
    
    if [[ "$QUICK_MODE" == true ]] && [[ -n "$default" ]]; then
        echo "$default"
        return
    fi
    
    if [[ -n "$default" ]]; then
        read -p "$(echo -e "${YELLOW}$prompt ${DIM}[$default]:${RESET} ")" result
        echo "${result:-$default}"
    else
        read -p "$(echo -e "${YELLOW}$prompt:${RESET} ")" result
        echo "$result"
    fi
}

show_help() {
    echo "Ring Platform Installation Script v${SCRIPT_VERSION}"
    echo
    echo "Usage: ./install.sh [MODE] [OPTIONS]"
    echo
    echo "Modes:"
    echo "  dev                  Development environment setup (default)"
    echo "  prod                 Production deployment"
    echo "  sync-urls            Align local + k8s origin URL env vars (no full reinstall)"
    echo "  setup-db             Create Postgres DB + apply data/schema.sql"
    echo
    echo "Options:"
    echo "  --quick              Quick setup with sensible defaults"
    echo "  --clone-name NAME    Set the clone name (e.g., greenfood, wellness)"
    echo "  --db-name NAME       Database name for setup-db (default: ring_<clone>)"
    echo "  --db-user USER       DB role for setup-db (default: ring_user)"
    echo "  --create-role        Create/reset DB role password during setup-db"
    echo "  --port PORT          Local listen port for sync-urls / env setup (default: 3000)"
    echo "  --domain HOST        Production public host for sync-urls (e.g. n9life.com)"
    echo "  --k8s                Also patch infrastructure/*/secrets.local.yaml origin keys"
    echo "  --verbose            Show detailed output"
    echo "  --help, -h           Show this help message"
    echo
    echo "Examples:"
    echo "  ./install.sh                           # Interactive dev setup"
    echo "  ./install.sh prod                      # Production deployment"
    echo "  ./install.sh --quick                   # Quick dev setup"
    echo "  ./install.sh sync-urls --port 3000      # Fix NEXT_PUBLIC_API_URL / AUTH_URL drift"
    echo "  ./install.sh sync-urls --domain n9life.com --k8s"
    echo "  ./install.sh setup-db --clone-name ring-n9life-com --db-name ring_n9life_com --create-role"
    echo
    echo "Documentation: https://ring-platform.org/docs"
    echo "Templates Guide: ./TEMPLATES.md"
    echo "DB SSOT: data/schema.sql"
    exit 0
}

# =============================================================================
# Parse Arguments
# =============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            dev|DEV)
                SETUP_MODE="dev"
                shift
                ;;
            prod|PROD)
                SETUP_MODE="prod"
                shift
                ;;
            sync-urls|SYNC-URLS)
                SETUP_MODE="sync-urls"
                shift
                ;;
            setup-db|SETUP-DB)
                SETUP_MODE="setup-db"
                shift
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --clone-name)
                CLONE_NAME="$2"
                shift 2
                ;;
            --db-name)
                DB_NAME="$2"
                shift 2
                ;;
            --db-user)
                DB_USER="$2"
                shift 2
                ;;
            --create-role)
                CREATE_DB_ROLE=true
                shift
                ;;
            --port)
                LOCAL_PORT="$2"
                shift 2
                ;;
            --domain)
                PRODUCTION_DOMAIN="$2"
                shift 2
                ;;
            --k8s)
                SYNC_K8S=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                # Check if it's a mode that wasn't caught
                if [[ "$1" != -* ]]; then
                    SETUP_MODE="$1"
                else
                    print_error "Unknown option: $1"
                    show_help
                fi
                shift
                ;;
        esac
    done
}

# =============================================================================
# Production Deployment Functions
# =============================================================================

select_deployment_provider() {
    echo -e "${BLUE}${BOLD}🚀 Production Deployment Options${RESET}"
    echo
    echo -e "${DIM}Select your preferred hosting provider:${RESET}"
    echo -e "  ${CYAN}1.${RESET} Vercel (Recommended - Zero config deployment)"
    echo -e "  ${CYAN}2.${RESET} Ubuntu Server (SSH deployment)"
    echo -e "  ${CYAN}3.${RESET} Kubernetes (K8s cluster deployment)"
    echo -e "  ${CYAN}4.${RESET} Cancel and return to development setup"
    echo
    
    while true; do
        read -p "$(echo -e "${YELLOW}${BOLD}Choose deployment option ${DIM}(1-4):${RESET} ")" -n 1 -r
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
                DEPLOYMENT_PROVIDER="k8s"
                break
                ;;
            4)
                print_info "Switching to development setup..."
                SETUP_MODE="dev"
                return
                ;;
            *)
                print_error "Invalid option. Please select 1, 2, 3, or 4."
                ;;
        esac
    done
    
    echo
    print_success "Selected: $DEPLOYMENT_PROVIDER deployment"
}

deploy_to_vercel() {
    print_step 1 3 "Vercel Production Deployment"
    
    print_info "Preparing Vercel deployment..."
    
    # Check Vercel CLI
    if ! check_command vercel; then
        print_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
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
    print_step 1 3 "Ubuntu Server Deployment"
    
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
rsync -avz -e "ssh -p $SSH_PORT" ring-config.json $SSH_USER@$SERVER_HOST:~/ring-platform/ 2>/dev/null || true

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

deploy_to_k8s() {
    print_step 1 3 "Kubernetes Deployment"
    
    print_info "Preparing Kubernetes deployment..."
    
    # Check kubectl
    if ! check_command kubectl; then
        print_error "kubectl not found. Please install kubectl first."
        print_link "Install kubectl" "https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    # Check for k8s manifests
    if [[ -d "k8s" ]]; then
        print_success "Found k8s/ directory with manifests"
        
        echo -e "${DIM}Available manifests:${RESET}"
        for file in k8s/*.yaml; do
            if [[ -f "$file" ]]; then
                echo -e "  📄 $(basename "$file")"
            fi
        done
        echo
        
        if prompt_destructive "Apply Kubernetes manifests?"; then
            print_info "Applying Kubernetes manifests..."
            kubectl apply -f k8s/
            print_success "Kubernetes manifests applied!"
        fi
    else
        print_warning "No k8s/ directory found"
        print_info "See documentation for Kubernetes deployment setup"
    fi
}

# =============================================================================
# Step 1: System Requirements Check
# =============================================================================

step_1_system_check() {
    print_step 1 10 "System Requirements Check"
    
    local os=$(detect_os)
    local ide=$(detect_ide)
    local has_errors=false
    
    print_info "Detected OS: $os"
    print_info "Detected IDE: $ide"
    echo
    
    # Check Node.js
    if check_command node; then
        local node_version=$(node --version | sed 's/v//')
        local node_major=$(echo "$node_version" | cut -d. -f1)
        if [[ "$node_major" -ge 20 ]]; then
            print_success "Node.js v$node_version (required: 20+)"
        else
            print_error "Node.js v$node_version is too old (required: 20+)"
            has_errors=true
        fi
    else
        print_error "Node.js not found"
        has_errors=true
    fi
    
    # Check npm
    if check_command npm; then
        print_success "npm $(npm --version)"
    else
        print_error "npm not found"
        has_errors=true
    fi
    
    # Check Git
    if check_command git; then
        print_success "Git $(git --version | cut -d' ' -f3)"
    else
        print_error "Git not found - please install Git first"
        has_errors=true
    fi
    
    # Check OpenSSL (for key generation)
    if check_command openssl; then
        print_success "OpenSSL available (for secure key generation)"
    else
        print_warning "OpenSSL not found - will use alternative key generation"
    fi
    
    # Check jq (optional but helpful)
    if check_command jq; then
        print_success "jq available (JSON processing)"
    else
        print_info "jq not found - some features will be limited"
    fi
    
    if [[ "$has_errors" == true ]]; then
        echo
        print_error "Please install missing requirements and run again."
        exit 1
    fi
    
    prompt_continue "System check completed. Continue with setup?"
}

# =============================================================================
# Step 2: Install Required Packages
# =============================================================================

step_2_install_packages() {
    print_step 2 10 "Installing Required Packages"
    
    local os=$(detect_os)
    
    if [[ "$os" == "macos" ]]; then
        # macOS with Homebrew
        if ! check_command brew; then
            print_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        print_info "Checking packages via Homebrew..."
        
        # Check and install missing packages
        local packages_to_install=""
        
        if ! check_command firebase; then
            packages_to_install="$packages_to_install firebase-cli"
        fi
        
        if ! check_command vercel; then
            packages_to_install="$packages_to_install vercel-cli"
        fi
        
        if [[ -n "$packages_to_install" ]]; then
            print_info "Installing: $packages_to_install"
            brew install $packages_to_install || npm install -g firebase-tools vercel
        else
            print_success "All packages already installed"
        fi
        
    elif [[ "$os" == "linux" ]]; then
        print_info "Checking global npm packages..."
        
        # Install Firebase CLI if needed
        if ! check_command firebase; then
            print_info "Installing Firebase CLI..."
            npm install -g firebase-tools
        fi
        
        # Install Vercel CLI if needed
        if ! check_command vercel; then
            print_info "Installing Vercel CLI..."
            npm install -g vercel
        fi
        
    else
        print_warning "Unsupported OS: $os"
        print_info "Please install firebase-tools and vercel manually if needed"
    fi
    
    print_success "Package check completed!"
    echo
}

# =============================================================================
# Step 3: Clone Configuration (NEW)
# =============================================================================

step_3_clone_config() {
    print_step 3 10 "Clone Configuration"
    
    echo -e "${WHITE}${BOLD}🏷️  Configure Your Ring Clone${RESET}"
    echo -e "${DIM}Each Ring clone has a unique name and branding.${RESET}"
    echo
    
    # Get clone name
    if [[ -z "$CLONE_NAME" ]]; then
        echo -e "${DIM}Examples: greenfood, wellness, marketplace, mycompany${RESET}"
        CLONE_NAME=$(prompt_input "Enter clone name" "my-ring-platform")
    fi
    
    # Sanitize clone name
    CLONE_NAME=$(echo "$CLONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
    
    print_info "Clone name: ${CYAN}${CLONE_NAME}${RESET}"
    
    # Get additional details
    if [[ "$QUICK_MODE" == false ]]; then
        echo
        DISPLAY_NAME=$(prompt_input "Display name (shown in UI)" "${CLONE_NAME^} Platform")
        CONTACT_EMAIL=$(prompt_input "Contact email" "admin@${CLONE_NAME}.com")
        PRODUCTION_DOMAIN=$(prompt_input "Production domain" "localhost:3000")
    else
        DISPLAY_NAME="${CLONE_NAME^} Platform"
        CONTACT_EMAIL="admin@${CLONE_NAME}.com"
        PRODUCTION_DOMAIN="localhost:3000"
    fi
    
    print_success "Clone configuration saved!"
}

# =============================================================================
# Step 4: Create ring-config.json (NEW)
# =============================================================================

step_4_ring_config() {
    print_step 4 10 "Creating Clone Configuration File"
    
    local config_template="ring-config.template.json"
    local config_file="ring-config.json"
    
    if [[ ! -f "$config_template" ]]; then
        print_warning "ring-config.template.json not found, creating minimal config..."
        create_minimal_ring_config
        return
    fi
    
    if [[ -f "$config_file" ]]; then
        if ! prompt_destructive "ring-config.json exists. Overwrite?"; then
            print_info "Keeping existing ring-config.json"
            return
        fi
        # Backup existing
        mv "$config_file" "${config_file}.backup.$(date +%s)"
    fi
    
    print_action "Creating ring-config.json from template..."
    cp "$config_template" "$config_file"
    
    # Replace placeholders
    local sed_inplace="sed -i"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed_inplace="sed -i ''"
    fi
    
    # Update clone configuration
    $sed_inplace "s/\"name\": \"my-ring-clone\"/\"name\": \"${CLONE_NAME}\"/" "$config_file"
    $sed_inplace "s/\"displayName\": \"My Ring Clone\"/\"displayName\": \"${DISPLAY_NAME}\"/" "$config_file"
    $sed_inplace "s/contact@your-domain.com/${CONTACT_EMAIL}/" "$config_file"
    $sed_inplace "s/support@your-domain.com/support@${CLONE_NAME}.com/" "$config_file"
    $sed_inplace "s/your-domain.com/${PRODUCTION_DOMAIN}/g" "$config_file"
    $sed_inplace "s/Your Organization Name/${DISPLAY_NAME}/" "$config_file"
    $sed_inplace "s/Your Company Name/${DISPLAY_NAME}/" "$config_file"
    $sed_inplace "s/my-ring-clone/${CLONE_NAME}/g" "$config_file"
    $sed_inplace "s/my_ring_clone/${CLONE_NAME//-/_}/g" "$config_file"
    
    print_success "Created ring-config.json"
    print_info "Customize branding and features in ring-config.json"
}

create_minimal_ring_config() {
    cat > ring-config.json << EOF
{
  "clone": {
    "name": "${CLONE_NAME}",
    "displayName": "${DISPLAY_NAME}",
    "version": "1.0.0",
    "contactEmail": "${CONTACT_EMAIL}"
  },
  "domains": {
    "production": "https://${PRODUCTION_DOMAIN}",
    "development": "http://localhost:3000"
  },
  "features": {
    "store": { "enabled": true, "multiVendor": true },
    "web3": { "enabled": true, "ringToken": true },
    "messaging": { "enabled": true },
    "ai": { "enabled": true }
  },
  "database": {
    "backendMode": "firebase-full"
  },
  "branding": {
    "primaryColor": "#3B82F6",
    "secondaryColor": "#10B981"
  }
}
EOF
    print_success "Created minimal ring-config.json"
}

# =============================================================================
# Step 5: Project Dependencies
# =============================================================================

step_5_project_dependencies() {
    print_step 5 10 "Installing Project Dependencies"
    
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    print_action "Installing npm dependencies (this may take a few minutes)..."
    
    if [[ "$VERBOSE" == true ]]; then
        npm install
    else
        npm install 2>&1 | tail -5
    fi
    
    print_success "Project dependencies installed!"
    echo
}

# =============================================================================
# Step 6: Firebase Configuration
# =============================================================================

step_6_firebase_setup() {
    print_step 6 10 "Firebase Configuration Setup"
    
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
    echo -e "  • Service Account (Admin SDK)"
    echo
    
    prompt_continue "Have you created your Firebase project and collected the configuration?"
}

# =============================================================================
# Step 7: OAuth Providers Setup
# =============================================================================

step_7_oauth_setup() {
    print_step 7 10 "OAuth Providers Configuration"
    
    echo -e "🔑${BOLD} OAuth Provider Setup${RESET}"
    echo
    
    print_link "Google OAuth Console" "https://console.developers.google.com/apis/credentials"
    echo -e "${DIM}   • Create OAuth 2.0 Client ID${RESET}"
    echo -e "${DIM}   • Set authorized redirect URI: http://localhost:3000/api/auth/callback/google${RESET}"
    echo -e "${DIM}   • For production: https://${PRODUCTION_DOMAIN}/api/auth/callback/google${RESET}"
    echo
    
    print_link "Apple Developer Portal" "https://developer.apple.com/account/resources/identifiers/list/serviceId"
    echo -e "${DIM}   • Create Services ID for Sign in with Apple${RESET}"
    echo -e "${DIM}   • Configure return URLs${RESET}"
    echo
    
    print_link "MetaMask / WalletConnect" "https://cloud.walletconnect.com/"
    echo -e "${DIM}   • Create WalletConnect project for Web3 login${RESET}"
    echo
    
    prompt_continue "Have you set up your OAuth providers? (Can be done later)"
}

# =============================================================================
# Origin URL sync (local .env.local + optional k8s secrets)
# =============================================================================
# NEXT_PUBLIC_API_URL / AUTH_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL / PORT must
# share one origin. Drift (e.g. API_URL=:3099 while server binds :3000) causes
# Firefox NetworkError on /api/wallet/credit/balance.

upsert_env_var() {
    local file=$1
    local key=$2
    local value=$3
    local tmp
    tmp="$(mktemp)"
    if [[ -f "$file" ]] && grep -qE "^${key}=" "$file"; then
        # Replace first assignment; keep remaining duplicates removed later by caller if needed
        awk -v k="$key" -v v="$value" '
            BEGIN { done=0 }
            $0 ~ "^" k "=" {
                if (!done) { print k "=" v; done=1; next }
                next
            }
            { print }
            END { if (!done) print k "=" v }
        ' "$file" > "$tmp"
        mv "$tmp" "$file"
    else
        printf '%s=%s\n' "$key" "$value" >> "$file"
        rm -f "$tmp"
    fi
}

sync_origin_urls_local() {
    local env_file="${1:-.env.local}"
    local mode="${2:-dev}" # dev|prod
    local port="${3:-$LOCAL_PORT}"
    local domain="${4:-$PRODUCTION_DOMAIN}"
    local origin api_url secure

    if [[ ! -f "$env_file" ]]; then
        print_error "Missing $env_file — run ./install.sh dev first or copy env.local.template"
        return 1
    fi

    if [[ "$mode" == "prod" ]]; then
        if [[ -z "$domain" || "$domain" == "localhost:3000" ]]; then
            domain=$(prompt_input "Production domain (no scheme)" "n9life.com")
        fi
        origin="https://${domain}"
        # Same-origin browser fetches: empty API URL is safest; absolute https also OK.
        api_url="$origin"
        secure="true"
    else
        origin="http://localhost:${port}"
        # Empty → RingApiClient uses relative /api/* (immune to port drift).
        api_url=""
        secure="false"
    fi

    print_action "Syncing origin URLs in $env_file → $origin"

    upsert_env_var "$env_file" "PORT" "$port"
    upsert_env_var "$env_file" "AUTH_URL" "$origin"
    upsert_env_var "$env_file" "NEXTAUTH_URL" "$origin"
    upsert_env_var "$env_file" "NEXT_PUBLIC_APP_URL" "$origin"
    upsert_env_var "$env_file" "NEXT_PUBLIC_API_URL" "$api_url"
    upsert_env_var "$env_file" "AUTH_USE_SECURE_COOKIES" "$secure"
    upsert_env_var "$env_file" "AUTH_TRUST_HOST" "true"

    print_success "Origin vars synced (AUTH_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_API_URL / PORT)"
    if [[ "$mode" == "dev" ]]; then
        print_info "NEXT_PUBLIC_API_URL is empty (same-origin relative /api). Restart npm run dev after sync."
    fi
}

sync_origin_urls_k8s() {
    local domain="${1:-$PRODUCTION_DOMAIN}"
    local clone_dir secrets_file origin
    clone_dir="$(basename "$SCRIPT_DIR")"
    secrets_file="$(cd "$SCRIPT_DIR/../infrastructure/k3s-3/${clone_dir}" 2>/dev/null && pwd)/secrets.local.yaml"

    if [[ ! -f "$secrets_file" ]]; then
        print_warning "k8s secrets.local.yaml not found — skipped (expected: infrastructure/k3s-3/${clone_dir}/secrets.local.yaml)"
        print_info "Create from 00-mail-secrets.template.yaml then re-run: ./install.sh sync-urls --domain HOST --k8s"
        return 0
    fi

    if [[ -z "$domain" || "$domain" == "localhost:3000" || "$domain" == localhost* ]]; then
        domain=$(prompt_input "Production domain for k8s secrets" "n9life.com")
    fi
    origin="https://${domain}"

    print_action "Patching origin URLs into $secrets_file"

    # Upsert YAML stringData keys via python for safety
    python3 - "$secrets_file" "$origin" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
origin = sys.argv[2]
text = path.read_text()
keys = {
    "AUTH_URL": origin,
    "NEXTAUTH_URL": origin,
    "NEXT_PUBLIC_APP_URL": origin,
    "NEXT_PUBLIC_API_URL": origin,
    "AUTH_USE_SECURE_COOKIES": "true",
    "AUTH_TRUST_HOST": "true",
}
lines = text.splitlines(True)
out = []
in_sd = False
existing = set()
i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith("stringData:"):
        in_sd = True
        out.append(line)
        i += 1
        continue
    if in_sd:
        if line and not line.startswith(" ") and not line.startswith("\t"):
            for k, v in keys.items():
                if k not in existing:
                    out.append(f'  {k}: "{v}"\n')
            in_sd = False
            out.append(line)
            i += 1
            continue
        replaced = False
        for k, v in keys.items():
            if line.startswith(f"  {k}:"):
                out.append(f'  {k}: "{v}"\n')
                existing.add(k)
                replaced = True
                break
        if not replaced:
            out.append(line)
        i += 1
        continue
    out.append(line)
    i += 1
if in_sd:
    for k, v in keys.items():
        if k not in existing:
            out.append(f'  {k}: "{v}"\n')
path.write_text("".join(out))
print(f"updated {path}")
PY

    print_success "k8s origin URL keys updated in secrets.local.yaml"
    print_info "Apply with: kctl k3s-3 apply -f \"$secrets_file\" (after namespace exists)"
}

cmd_sync_urls() {
    print_step 1 1 "Sync origin URL environment variables"

    # Local stays http://localhost:$PORT unless --domain is used *without* --k8s
    # (prod-shaped local) OR user explicitly wants both via DOMAIN_FOR_LOCAL.
    local local_mode="dev"
    if [[ -n "$PRODUCTION_DOMAIN" && "$PRODUCTION_DOMAIN" != localhost* && "$SYNC_K8S" != true ]]; then
        local_mode="prod"
    fi

    sync_origin_urls_local ".env.local" "$local_mode" "$LOCAL_PORT" "$PRODUCTION_DOMAIN"

    if [[ "$SYNC_K8S" == true ]]; then
        sync_origin_urls_k8s "$PRODUCTION_DOMAIN"
    fi

    print_success "URL sync complete"
}

# =============================================================================
# setup-db — flattened schema SSOT (data/schema.sql)
# =============================================================================

cmd_setup_db() {
    print_step 1 1 "Create clone database + apply data/schema.sql"

    if [[ ! -f "$SCRIPT_DIR/scripts/setup-clone-db.sh" ]]; then
        print_error "Missing scripts/setup-clone-db.sh"
        exit 1
    fi
    if [[ ! -f "$SCRIPT_DIR/data/schema.sql" ]]; then
        print_error "Missing data/schema.sql (flattened SSOT)"
        exit 1
    fi

    local slug="${CLONE_NAME:-platform}"
    slug=$(echo "$slug" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
    local db_name="${DB_NAME:-ring_${slug//-/_}}"
    local db_user="${DB_USER:-ring_user}"

    if [[ "$QUICK_MODE" != true ]]; then
        db_name=$(prompt_input "Database name" "$db_name")
        db_user=$(prompt_input "Database user" "$db_user")
    fi

    print_info "Applying flattened schema (do NOT re-run numbered migrations on empty DBs)"
    print_info "DB=$db_name USER=$db_user"

    local args=(--db-name "$db_name" --db-user "$db_user")
    if [[ "$CREATE_DB_ROLE" == true ]]; then
        args+=(--create-role)
    fi

    bash "$SCRIPT_DIR/scripts/setup-clone-db.sh" "${args[@]}"

    # Upsert DATABASE_URL into .env.local when local defaults apply
    if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
        local host="${PGHOST:-localhost}"
        local port="${PGPORT:-5432}"
        local pass="${PGPASSWORD:-ring_password_2024}"
        if [[ "$CREATE_DB_ROLE" == true ]]; then
            print_warning "Role was (re)created — copy DATABASE_URL printed above into .env.local"
        else
            local url="postgresql://${db_user}:${pass}@${host}:${port}/${db_name}"
            if grep -q '^DATABASE_URL=' "$SCRIPT_DIR/.env.local"; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=\"$url\"|" "$SCRIPT_DIR/.env.local"
                else
                    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$url\"|" "$SCRIPT_DIR/.env.local"
                fi
            else
                echo "DATABASE_URL=\"$url\"" >> "$SCRIPT_DIR/.env.local"
            fi
            print_success "Updated DATABASE_URL in .env.local"
        fi
    else
        print_info "No .env.local yet — set DATABASE_URL after ./install.sh dev"
    fi

    print_success "Database setup complete"
}

# =============================================================================
# Step 8: Environment Variables Setup
# =============================================================================

step_8_env_setup() {
    print_step 8 10 "Environment Variables Configuration"
    
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
            print_info "Keeping existing .env.local — syncing origin URLs only"
            LOCAL_PORT=$(prompt_input "Local PORT" "$LOCAL_PORT")
            sync_origin_urls_local "$env_file" "dev" "$LOCAL_PORT" ""
            return
        fi
        # Backup existing
        mv "$env_file" "${env_file}.backup.$(date +%s)"
    fi
    
    # Copy template to .env.local
    cp "$template_file" "$env_file"
    print_success "Created .env.local from template"
    
    # Generate AUTH_SECRET
    print_action "Generating AUTH_SECRET..."
    local auth_secret
    if check_command openssl; then
        auth_secret=$(openssl rand -base64 32)
    else
        auth_secret=$(head -c 32 /dev/urandom | base64)
    fi
    
    # Generate WALLET_ENCRYPTION_KEY
    print_action "Generating WALLET_ENCRYPTION_KEY..."
    local wallet_key
    if check_command openssl; then
        wallet_key=$(openssl rand -hex 32)
    else
        wallet_key=$(head -c 32 /dev/urandom | xxd -p | head -c 64)
    fi
    
    # Replace secrets in .env.local
    local sed_inplace="sed -i"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed_inplace="sed -i ''"
    fi
    
    $sed_inplace "s/AUTH_SECRET=\"someSecretKeyGoesHere\"/AUTH_SECRET=\"$auth_secret\"/" "$env_file"
    $sed_inplace "s/AUTH_SECRET=\"\"/AUTH_SECRET=\"$auth_secret\"/" "$env_file"
    $sed_inplace "s/WALLET_ENCRYPTION_KEY=your_wallet_encryption_key_32_hex_chars/WALLET_ENCRYPTION_KEY=$wallet_key/" "$env_file"

    LOCAL_PORT=$(prompt_input "Local PORT for npm run dev" "$LOCAL_PORT")
    if [[ -n "$PRODUCTION_DOMAIN" && "$PRODUCTION_DOMAIN" != "localhost:3000" ]]; then
        sync_origin_urls_local "$env_file" "prod" "$LOCAL_PORT" "$PRODUCTION_DOMAIN"
    else
        sync_origin_urls_local "$env_file" "dev" "$LOCAL_PORT" ""
    fi
    
    print_success "Generated and set AUTH_SECRET"
    print_success "Generated and set WALLET_ENCRYPTION_KEY"
    
    # Open .env.local in IDE
    local ide=$(detect_ide)
    if [[ "$ide" != "none" ]] && [[ "$QUICK_MODE" == false ]]; then
        print_info "Opening .env.local in $ide for manual configuration..."
        if [[ "$ide" == "cursor" ]]; then
            cursor "$env_file" 2>/dev/null || true
        else
            code "$env_file" 2>/dev/null || true
        fi
    fi
    
    echo
    print_warning "Please update Firebase and OAuth credentials in .env.local"
    prompt_continue "Have you updated the environment variables? (Can be done later)"
}

# =============================================================================
# Step 9: IDE Configuration
# =============================================================================

step_9_ide_config() {
    print_step 9 10 "IDE Configuration Setup"
    
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
        print_info "Creating .vscode configuration..."
        
        mkdir -p .vscode
        
        # Create settings.json
        cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "git.enableSmartCommit": true,
  "git.autofetch": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
EOF
        print_success "Created .vscode/settings.json"
    fi
    
    # Check for .cursor directory
    if [[ -d ".cursor" ]]; then
        print_success ".cursor configuration found (Legiox AI ready)"
    fi
    
    print_success "IDE configuration completed!"
    echo
}

# =============================================================================
# Step 10: Final Setup & Start Server
# =============================================================================

step_10_final_setup() {
    print_step 10 10 "Final Setup"
    
    # Create additional config files from templates if they don't exist
    if [[ -f "next.config.template.mjs" ]] && [[ ! -f "next.config.mjs" ]]; then
        print_action "Creating next.config.mjs from template..."
        cp "next.config.template.mjs" "next.config.mjs"
        
        local sed_inplace="sed -i"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed_inplace="sed -i ''"
        fi
        $sed_inplace "s/YOUR_PRODUCTION_DOMAIN/${PRODUCTION_DOMAIN}/g" "next.config.mjs"
        print_success "Created next.config.mjs"
    fi
    
    if [[ -f "docker-compose.template.yml" ]] && [[ ! -f "docker-compose.yml" ]]; then
        print_action "Creating docker-compose.yml from template..."
        cp "docker-compose.template.yml" "docker-compose.yml"
        print_success "Created docker-compose.yml"
    fi
    
    if [[ -f "Dockerfile.template" ]] && [[ ! -f "Dockerfile" ]]; then
        print_action "Creating Dockerfile from template..."
        cp "Dockerfile.template" "Dockerfile"
        
        local sed_inplace="sed -i"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed_inplace="sed -i ''"
        fi
        $sed_inplace "s/YOUR_CLONE_NAME/${CLONE_NAME}/g" "Dockerfile"
        $sed_inplace "s/YOUR_DOMAIN/${PRODUCTION_DOMAIN}/g" "Dockerfile"
        $sed_inplace "s/YOUR_EMAIL/${CONTACT_EMAIL}/g" "Dockerfile"
        print_success "Created Dockerfile"
    fi
    
    # Print success message
    echo
    echo -e "${GREEN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                      ║"
    echo "║    🎉 RING PLATFORM INSTALLATION COMPLETE!                           ║"
    echo "║                                                                      ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo
    
    echo -e "${WHITE}${BOLD}📋 Created Files:${RESET}"
    [[ -f "ring-config.json" ]] && echo -e "   ${GREEN}✓${RESET} ring-config.json       - Clone customization"
    [[ -f ".env.local" ]] && echo -e "   ${GREEN}✓${RESET} .env.local              - Environment variables (secrets generated)"
    [[ -f "next.config.mjs" ]] && echo -e "   ${GREEN}✓${RESET} next.config.mjs         - Next.js configuration"
    [[ -f "docker-compose.yml" ]] && echo -e "   ${GREEN}✓${RESET} docker-compose.yml      - Docker orchestration"
    [[ -f "Dockerfile" ]] && echo -e "   ${GREEN}✓${RESET} Dockerfile              - Docker build"
    echo
    
    echo -e "${WHITE}${BOLD}⚠️  Required Next Steps:${RESET}"
    echo -e "   ${CYAN}1.${RESET} Configure Firebase credentials in ${YELLOW}.env.local${RESET}"
    echo -e "   ${CYAN}2.${RESET} Configure OAuth providers (Google, Apple) in ${YELLOW}.env.local${RESET}"
    echo -e "   ${CYAN}3.${RESET} Customize branding in ${YELLOW}ring-config.json${RESET}"
    echo
    
    echo -e "${WHITE}${BOLD}📚 Documentation:${RESET}"
    echo -e "   • Setup Guide:     ${DIM}./SETUP_GUIDE.md${RESET}"
    echo -e "   • Templates Guide: ${DIM}./TEMPLATES.md${RESET}"
    echo -e "   • Installation:    ${DIM}./INSTALL.md${RESET}"
    echo -e "   • Full Docs:       ${DIM}https://ring-platform.org/docs${RESET}"
    echo
    
    echo -e "${WHITE}${BOLD}🚀 Available Commands:${RESET}"
    echo -e "   ${GREEN}npm run dev${RESET}              - Start development server"
    echo -e "   ${GREEN}npm run build${RESET}            - Build for production"
    echo -e "   ${GREEN}npm run type-check${RESET}       - TypeScript validation"
    echo -e "   ${GREEN}npm test${RESET}                 - Run tests (95+ tests)"
    echo -e "   ${GREEN}npm run seed:opportunities${RESET} - Seed sample data"
    echo
    
    # Ask if user wants to start dev server
    if [[ "$QUICK_MODE" == false ]]; then
        echo
        if prompt_destructive "Start development server now?"; then
            echo
            print_action "Starting Next.js development server..."
            echo -e "${DIM}Press Ctrl+C to stop${RESET}"
            echo
            npm run dev
        else
            echo
            print_info "Run ${GREEN}npm run dev${RESET} when ready to start"
            echo -e "${DIM}Your Ring Platform is ready for development!${RESET}"
        fi
    else
        echo
        print_info "Quick setup complete! Run ${GREEN}npm run dev${RESET} to start"
    fi
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
    # Parse command line arguments
    parse_args "$@"
    
    # Validate setup mode
    if [[ "$SETUP_MODE" != "dev" && "$SETUP_MODE" != "prod" && "$SETUP_MODE" != "sync-urls" && "$SETUP_MODE" != "setup-db" ]]; then
        # Check if it's a flag that wasn't processed
        if [[ "$SETUP_MODE" == --* ]]; then
            print_error "Unknown option: $SETUP_MODE"
            show_help
        fi
        SETUP_MODE="dev"
    fi

    # Fast path: origin URL sync only (local ± k8s)
    if [[ "$SETUP_MODE" == "sync-urls" ]]; then
        if [[ ! -f "package.json" ]]; then
            print_error "Please run this script from the Ring Platform project root."
            exit 1
        fi
        cmd_sync_urls
        exit 0
    fi

    # Fast path: create DB + apply flattened schema.sql
    if [[ "$SETUP_MODE" == "setup-db" ]]; then
        if [[ ! -f "package.json" ]]; then
            print_error "Please run this script from the Ring Platform project root."
            exit 1
        fi
        cmd_setup_db
        exit 0
    fi
    
    # Show 80s-style MOTD
    print_80s_motd
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_error "Please run this script from the Ring Platform project root."
        print_info "Expected to find: package.json"
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
            "k8s")
                deploy_to_k8s
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
    
    # Execute setup steps with error handling
    trap 'handle_error "System Check"' ERR
    step_1_system_check
    
    trap 'handle_error "Package Installation"' ERR
    step_2_install_packages
    
    trap 'handle_error "Clone Configuration"' ERR
    step_3_clone_config
    
    trap 'handle_error "Ring Config"' ERR
    step_4_ring_config
    
    trap 'handle_error "Project Dependencies"' ERR
    step_5_project_dependencies
    
    trap 'handle_error "Firebase Setup"' ERR
    step_6_firebase_setup
    
    trap 'handle_error "OAuth Setup"' ERR
    step_7_oauth_setup
    
    trap 'handle_error "Environment Variables"' ERR
    step_8_env_setup

    # Optional: create local DB schema
    if prompt_destructive "Create/refresh local Postgres DB from data/schema.sql?"; then
        trap 'handle_error "Database Setup"' ERR
        cmd_setup_db
    else
        print_info "Skipped DB setup — later: ./install.sh setup-db --clone-name ${CLONE_NAME:-platform}"
    fi
    
    trap 'handle_error "IDE Configuration"' ERR
    step_9_ide_config
    
    trap 'handle_error "Final Setup"' ERR
    step_10_final_setup
}

# Run main function
main "$@"
