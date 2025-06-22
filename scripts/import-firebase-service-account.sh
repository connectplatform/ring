#!/bin/bash

# =============================================================================
# 🔥 Firebase Service Account Importer
# =============================================================================
# Imports Firebase service account credentials from JSON file to:
# 1. Local .env.local file
# 2. Vercel production environment
# =============================================================================

set -e

# Colors for output
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

print_banner() {
    echo -e "${PURPLE}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo -e "║    🔥 ${WHITE}FIREBASE SERVICE ACCOUNT IMPORTER${PURPLE}${BOLD}                               ║"
    echo "║                                                                              ║"
    echo -e "║    ${WHITE}Import credentials from JSON to .env.local and Vercel production${PURPLE}${BOLD}   ║"
    echo "║                                                                              ║"
    echo -e "║    ${DIM}Usage: ./scripts/import-firebase-service-account.sh <file.json>${PURPLE}${BOLD}     ║"
    echo "║                                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo
}

# Check if jq is installed
check_jq() {
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        echo -e "${DIM}Install with: brew install jq (macOS) or apt install jq (Linux)${RESET}"
        exit 1
    fi
}

# Validate Firebase service account JSON file
validate_service_account_file() {
    local json_file="$1"
    
    if [[ -z "$json_file" ]]; then
        print_error "No JSON file specified"
        echo -e "${DIM}Usage: $0 <firebase-service-account.json>${RESET}"
        exit 1
    fi
    
    if [[ ! -f "$json_file" ]]; then
        print_error "File not found: $json_file"
        echo -e "${DIM}Please provide a valid path to your Firebase service account JSON file${RESET}"
        exit 1
    fi
    
    if ! jq -e '.type == "service_account"' "$json_file" >/dev/null 2>&1; then
        print_error "Invalid Firebase service account JSON file: $json_file"
        echo -e "${DIM}The file must be a valid Firebase service account JSON with 'type': 'service_account'${RESET}"
        exit 1
    fi
    
    echo "$json_file"
}

# Extract values from JSON
extract_from_json() {
    local json_file="$1"
    local key="$2"
    jq -r ".$key // empty" "$json_file"
}

# Update .env.local file
update_env_local() {
    local json_file="$1"
    local env_file=".env.local"
    
    print_info "Updating $env_file with Firebase service account credentials..."
    
    # Extract values from JSON
    local project_id=$(extract_from_json "$json_file" "project_id")
    local client_email=$(extract_from_json "$json_file" "client_email")
    local private_key=$(extract_from_json "$json_file" "private_key")
    
    if [[ -z "$project_id" || -z "$client_email" || -z "$private_key" ]]; then
        print_error "Failed to extract required fields from JSON file"
        exit 1
    fi
    
    # Check if .env.local exists
    if [[ ! -f "$env_file" ]]; then
        print_warning ".env.local not found, creating from template..."
        if [[ -f "env.local.template" ]]; then
            cp env.local.template "$env_file"
        else
            print_error "env.local.template not found"
            exit 1
        fi
    fi
    
    # Update AUTH_FIREBASE_PROJECT_ID
    if grep -q "AUTH_FIREBASE_PROJECT_ID=" "$env_file"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|AUTH_FIREBASE_PROJECT_ID=.*|AUTH_FIREBASE_PROJECT_ID=\"$project_id\"|" "$env_file"
        else
            sed -i "s|AUTH_FIREBASE_PROJECT_ID=.*|AUTH_FIREBASE_PROJECT_ID=\"$project_id\"|" "$env_file"
        fi
        print_success "Updated AUTH_FIREBASE_PROJECT_ID"
    else
        echo "AUTH_FIREBASE_PROJECT_ID=\"$project_id\"" >> "$env_file"
        print_success "Added AUTH_FIREBASE_PROJECT_ID"
    fi
    
    # Update AUTH_FIREBASE_CLIENT_EMAIL
    if grep -q "AUTH_FIREBASE_CLIENT_EMAIL=" "$env_file"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|AUTH_FIREBASE_CLIENT_EMAIL=.*|AUTH_FIREBASE_CLIENT_EMAIL=\"$client_email\"|" "$env_file"
        else
            sed -i "s|AUTH_FIREBASE_CLIENT_EMAIL=.*|AUTH_FIREBASE_CLIENT_EMAIL=\"$client_email\"|" "$env_file"
        fi
        print_success "Updated AUTH_FIREBASE_CLIENT_EMAIL"
    else
        echo "AUTH_FIREBASE_CLIENT_EMAIL=\"$client_email\"" >> "$env_file"
        print_success "Added AUTH_FIREBASE_CLIENT_EMAIL"
    fi
    
    # Update AUTH_FIREBASE_PRIVATE_KEY (handle multiline properly)
    # Use printf to properly escape the private key for environment file
    local temp_file=$(mktemp)
    
    # Remove existing AUTH_FIREBASE_PRIVATE_KEY line if it exists
    if grep -q "AUTH_FIREBASE_PRIVATE_KEY=" "$env_file"; then
        grep -v "^AUTH_FIREBASE_PRIVATE_KEY=" "$env_file" > "$temp_file"
        mv "$temp_file" "$env_file"
        print_success "Removed existing AUTH_FIREBASE_PRIVATE_KEY"
    fi
    
    # Add the private key using printf to handle special characters and newlines
    printf 'AUTH_FIREBASE_PRIVATE_KEY="%s"\n' "$private_key" >> "$env_file"
    print_success "Added AUTH_FIREBASE_PRIVATE_KEY"
    
    # Also update NEXT_PUBLIC_FIREBASE_PROJECT_ID if it exists
    if grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID=" "$env_file"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|NEXT_PUBLIC_FIREBASE_PROJECT_ID=.*|NEXT_PUBLIC_FIREBASE_PROJECT_ID=\"$project_id\"|" "$env_file"
        else
            sed -i "s|NEXT_PUBLIC_FIREBASE_PROJECT_ID=.*|NEXT_PUBLIC_FIREBASE_PROJECT_ID=\"$project_id\"|" "$env_file"
        fi
        print_success "Updated NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    fi
}

# Update Vercel environment variables
update_vercel_env() {
    local json_file="$1"
    
    print_info "Updating Vercel production environment variables..."
    
    # Check if vercel CLI is available
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI is required but not installed"
        echo -e "${DIM}Install with: npm install -g vercel${RESET}"
        exit 1
    fi
    
    # Extract values from JSON
    local project_id=$(extract_from_json "$json_file" "project_id")
    local client_email=$(extract_from_json "$json_file" "client_email")
    local private_key=$(extract_from_json "$json_file" "private_key")
    
    # Update AUTH_FIREBASE_PROJECT_ID
    print_info "Setting AUTH_FIREBASE_PROJECT_ID..."
    if vercel env ls | grep -q "AUTH_FIREBASE_PROJECT_ID.*Production"; then
        echo "y" | vercel env rm AUTH_FIREBASE_PROJECT_ID production >/dev/null 2>&1 || true
    fi
    echo "$project_id" | vercel env add AUTH_FIREBASE_PROJECT_ID production >/dev/null 2>&1
    print_success "Set AUTH_FIREBASE_PROJECT_ID in Vercel production"
    
    # Update AUTH_FIREBASE_CLIENT_EMAIL
    print_info "Setting AUTH_FIREBASE_CLIENT_EMAIL..."
    if vercel env ls | grep -q "AUTH_FIREBASE_CLIENT_EMAIL.*Production"; then
        echo "y" | vercel env rm AUTH_FIREBASE_CLIENT_EMAIL production >/dev/null 2>&1 || true
    fi
    echo "$client_email" | vercel env add AUTH_FIREBASE_CLIENT_EMAIL production >/dev/null 2>&1
    print_success "Set AUTH_FIREBASE_CLIENT_EMAIL in Vercel production"
    
    # Update AUTH_FIREBASE_PRIVATE_KEY
    print_info "Setting AUTH_FIREBASE_PRIVATE_KEY..."
    if vercel env ls | grep -q "AUTH_FIREBASE_PRIVATE_KEY.*Production"; then
        echo "y" | vercel env rm AUTH_FIREBASE_PRIVATE_KEY production >/dev/null 2>&1 || true
    fi
    echo "$private_key" | vercel env add AUTH_FIREBASE_PRIVATE_KEY production >/dev/null 2>&1
    print_success "Set AUTH_FIREBASE_PRIVATE_KEY in Vercel production"
    
    # Also update NEXT_PUBLIC_FIREBASE_PROJECT_ID if it exists
    if vercel env ls | grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID.*Production"; then
        print_info "Updating NEXT_PUBLIC_FIREBASE_PROJECT_ID..."
        echo "y" | vercel env rm NEXT_PUBLIC_FIREBASE_PROJECT_ID production >/dev/null 2>&1 || true
        echo "$project_id" | vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production >/dev/null 2>&1
        print_success "Updated NEXT_PUBLIC_FIREBASE_PROJECT_ID in Vercel production"
    fi
}

# Deploy to production
deploy_to_production() {
    print_info "Deploying to Vercel production..."
    
    if vercel --prod --force; then
        print_success "Successfully deployed to production!"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Main execution
main() {
    print_banner
    
    # Check dependencies
    check_jq
    
    # Validate service account JSON file from command line argument
    local json_file=$(validate_service_account_file "$1")
    print_success "Validated Firebase service account file: $json_file"
    
    # Show what will be imported
    local project_id=$(extract_from_json "$json_file" "project_id")
    local client_email=$(extract_from_json "$json_file" "client_email")
    
    echo -e "${YELLOW}${BOLD}📋 Credentials to import:${RESET}"
    echo -e "${DIM}  • Project ID: ${CYAN}$project_id${RESET}"
    echo -e "${DIM}  • Client Email: ${CYAN}$client_email${RESET}"
    echo -e "${DIM}  • Private Key: ${CYAN}[REDACTED]${RESET}"
    echo
    
    # Confirm before proceeding
    read -p "$(echo -e "${YELLOW}${BOLD}Continue with import? ${DIM}(Y/n):${RESET} ")" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_error "Import cancelled by user"
        exit 1
    fi
    
    # Update .env.local
    update_env_local "$json_file"
    echo
    
    # Ask about Vercel update
    read -p "$(echo -e "${YELLOW}${BOLD}Update Vercel production environment? ${DIM}(Y/n):${RESET} ")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        update_vercel_env "$json_file"
        echo
        
        # Ask about deployment
        read -p "$(echo -e "${YELLOW}${BOLD}Deploy to production now? ${DIM}(Y/n):${RESET} ")" -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            deploy_to_production
        fi
    fi
    
    echo
    print_success "Firebase service account import completed!"
    
    # Security reminder
    echo -e "${YELLOW}${BOLD}🔒 Security Reminder:${RESET}"
    echo -e "${DIM}  • Keep your service account JSON file secure${RESET}"
    echo -e "${DIM}  • Consider deleting the JSON file after import${RESET}"
    echo -e "${DIM}  • Never commit service account files to version control${RESET}"
}

# Run main function
main "$@" 