#!/bin/bash

# Ring Platform - Docker Quick Start Script
# One-command setup for Ring Platform with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_ENV="development"
DEFAULT_PROFILE="default"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
${WHITE}Ring Platform Docker Quick Start${NC}

${CYAN}Usage:${NC}
  $0 [ENVIRONMENT] [PROFILE]

${CYAN}Environments:${NC}
  development    Development mode with hot reload (default)
  production     Production mode with Nginx reverse proxy

${CYAN}Profiles:${NC}
  default        Ring Platform + Redis + MongoDB
  dev-tools      + Mongo Express + Redis Commander + MailHog
  monitoring     + Prometheus + Grafana
  backup         + Automated backup service
  logging        + Fluentd log aggregation

${CYAN}Examples:${NC}
  $0                           # Development with default services
  $0 development dev-tools     # Development with admin tools
  $0 production monitoring     # Production with monitoring
  $0 development               # Development mode only

${CYAN}Quick Commands:${NC}
  $0 stop                      # Stop all services
  $0 logs                      # View logs
  $0 clean                     # Clean up containers and volumes
  $0 build                     # Rebuild images
  $0 status                    # Show service status

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop and try again."
        echo "  macOS: brew install --cask docker"
        echo "  Windows: Download from https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
        echo "  Linux: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    # Use docker compose if available, fallback to docker-compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        DOCKER_COMPOSE_CMD="docker-compose"
    fi
    
    print_success "Prerequisites check passed"
}

# Function to setup environment
setup_environment() {
    print_info "Setting up environment configuration..."
    
    if [[ ! -f ".env.local" ]]; then
        if [[ -f "docker.env.template" ]]; then
            print_info "Creating .env.local from template..."
            cp docker.env.template .env.local
            print_warning "Please edit .env.local with your Firebase credentials before starting services"
            print_info "Required variables:"
            echo "  - NEXT_PUBLIC_FIREBASE_API_KEY"
            echo "  - NEXT_PUBLIC_FIREBASE_PROJECT_ID"
            echo "  - AUTH_SECRET (generate with: openssl rand -base64 32)"
            echo "  - AUTH_FIREBASE_PROJECT_ID"
            echo "  - AUTH_FIREBASE_CLIENT_EMAIL"
            echo "  - AUTH_FIREBASE_PRIVATE_KEY"
            echo ""
            read -p "Press Enter to continue after editing .env.local, or Ctrl+C to exit..."
        else
            print_error "Environment template not found. Please create .env.local manually."
            exit 1
        fi
    else
        print_success "Environment file .env.local already exists"
    fi
}

# Function to build compose command
build_compose_command() {
    local environment=$1
    local profile=$2
    
    COMPOSE_FILES="-f docker-compose.yml"
    
    # Add environment-specific compose file
    if [[ "$environment" == "development" ]]; then
        if [[ -f "docker/docker-compose.dev.yml" ]]; then
            COMPOSE_FILES="$COMPOSE_FILES -f docker/docker-compose.dev.yml"
        fi
    elif [[ "$environment" == "production" ]]; then
        if [[ -f "docker/docker-compose.prod.yml" ]]; then
            COMPOSE_FILES="$COMPOSE_FILES -f docker/docker-compose.prod.yml"
        fi
    fi
    
    # Add profile if specified
    if [[ "$profile" != "default" ]]; then
        COMPOSE_PROFILES="--profile $profile"
    else
        COMPOSE_PROFILES=""
    fi
}

# Function to start services
start_services() {
    local environment=$1
    local profile=$2
    
    print_header "Starting Ring Platform ($environment mode)"
    
    build_compose_command "$environment" "$profile"
    
    print_info "Docker Compose command: $DOCKER_COMPOSE_CMD $COMPOSE_FILES $COMPOSE_PROFILES up -d"
    
    # Pull latest images
    print_info "Pulling latest images..."
    $DOCKER_COMPOSE_CMD $COMPOSE_FILES pull --quiet || true
    
    # Start services
    print_info "Starting services..."
    $DOCKER_COMPOSE_CMD $COMPOSE_FILES $COMPOSE_PROFILES up -d --build
    
    # Wait for services to be ready
    print_info "Waiting for services to be ready..."
    sleep 10
    
    # Check service status
    print_info "Service status:"
    $DOCKER_COMPOSE_CMD $COMPOSE_FILES ps
    
    print_success "Ring Platform started successfully!"
    
    # Show access URLs
    echo ""
    print_header "Access URLs:"
    echo -e "${CYAN}🌐 Ring Platform:${NC} http://localhost:3000"
    
    if [[ "$profile" == "dev-tools" ]]; then
        echo -e "${CYAN}📊 Mongo Express:${NC} http://localhost:8081 (admin/admin123)"
        echo -e "${CYAN}🔴 Redis Commander:${NC} http://localhost:8082"
        echo -e "${CYAN}📧 MailHog:${NC} http://localhost:8025"
    fi
    
    if [[ "$profile" == "monitoring" ]]; then
        echo -e "${CYAN}📈 Prometheus:${NC} http://localhost:9090"
        echo -e "${CYAN}📊 Grafana:${NC} http://localhost:3001 (admin/ring_admin_2024)"
    fi
    
    if [[ "$environment" == "production" ]]; then
        echo -e "${CYAN}🔒 HTTPS (with SSL):${NC} https://localhost"
        echo -e "${CYAN}🏥 Health Check:${NC} http://localhost/api/health"
    fi
    
    echo ""
    print_info "To view logs: $0 logs"
    print_info "To stop services: $0 stop"
}

# Function to stop services
stop_services() {
    print_info "Stopping Ring Platform services..."
    
    # Try to stop with all possible compose files
    for compose_file in "docker-compose.yml" "docker/docker-compose.dev.yml" "docker/docker-compose.prod.yml"; do
        if [[ -f "$compose_file" ]]; then
            COMPOSE_FILES="$COMPOSE_FILES -f $compose_file"
        fi
    done
    
    $DOCKER_COMPOSE_CMD $COMPOSE_FILES down
    print_success "Services stopped"
}

# Function to show logs
show_logs() {
    print_info "Showing Ring Platform logs..."
    $DOCKER_COMPOSE_CMD logs -f ring-app
}

# Function to show status
show_status() {
    print_info "Ring Platform service status:"
    $DOCKER_COMPOSE_CMD ps
    
    echo ""
    print_info "Docker system status:"
    docker system df
}

# Function to clean up
clean_up() {
    print_warning "This will remove all Ring Platform containers, networks, and volumes."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleaning up Ring Platform..."
        
        # Stop and remove containers
        $DOCKER_COMPOSE_CMD down -v --remove-orphans
        
        # Remove images
        docker images | grep ring-platform | awk '{print $3}' | xargs -r docker rmi
        
        # Prune unused resources
        docker system prune -f
        
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Function to rebuild images
rebuild_images() {
    print_info "Rebuilding Ring Platform images..."
    $DOCKER_COMPOSE_CMD build --no-cache
    print_success "Images rebuilt"
}

# Main script logic
main() {
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "docker-compose.yml" ]]; then
        print_error "This script must be run from the Ring Platform root directory"
        exit 1
    fi
    
    # Handle special commands
    case "${1:-}" in
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        "stop")
            check_prerequisites
            stop_services
            exit 0
            ;;
        "logs")
            check_prerequisites
            show_logs
            exit 0
            ;;
        "status")
            check_prerequisites
            show_status
            exit 0
            ;;
        "clean")
            check_prerequisites
            clean_up
            exit 0
            ;;
        "build")
            check_prerequisites
            rebuild_images
            exit 0
            ;;
    esac
    
    # Parse arguments
    ENVIRONMENT="${1:-$DEFAULT_ENV}"
    PROFILE="${2:-$DEFAULT_PROFILE}"
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|production)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT. Must be 'development' or 'production'"
        show_usage
        exit 1
    fi
    
    # Validate profile
    if [[ ! "$PROFILE" =~ ^(default|dev-tools|monitoring|backup|logging)$ ]]; then
        print_error "Invalid profile: $PROFILE. Must be one of: default, dev-tools, monitoring, backup, logging"
        show_usage
        exit 1
    fi
    
    # Run the setup
    check_prerequisites
    setup_environment
    start_services "$ENVIRONMENT" "$PROFILE"
}

# Run main function with all arguments
main "$@"
