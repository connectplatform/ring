#!/bin/bash

# Ring Platform - Docker Build Script
# Builds Docker images for different environments and platforms

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
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"ghcr.io"}
DOCKER_NAMESPACE=${DOCKER_NAMESPACE:-"connectplatform"}
IMAGE_NAME="ring-platform"
VERSION=${VERSION:-$(cat package.json | grep '"version"' | cut -d'"' -f4)}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Default values
ENVIRONMENT="production"
PLATFORM="linux/amd64"
PUSH=false
CACHE=true
MULTI_ARCH=false

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
    echo -e "${PURPLE}🐳 $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
${WHITE}Ring Platform Docker Build Script${NC}

${CYAN}Usage:${NC}
  $0 [OPTIONS]

${CYAN}Options:${NC}
  -e, --env ENVIRONMENT     Build environment (development|production) [default: production]
  -p, --platform PLATFORM  Target platform [default: linux/amd64]
  -t, --tag TAG            Custom tag for the image
  -r, --registry REGISTRY  Docker registry [default: ghcr.io]
  -n, --namespace NS       Docker namespace [default: connectplatform]
  --push                   Push image to registry after build
  --no-cache              Disable Docker build cache
  --multi-arch            Build for multiple architectures (linux/amd64,linux/arm64)
  -h, --help              Show this help message

${CYAN}Examples:${NC}
  $0                                    # Build production image
  $0 --env development                  # Build development image
  $0 --push --tag latest               # Build and push with latest tag
  $0 --multi-arch --push               # Build multi-arch and push
  $0 --platform linux/arm64           # Build for ARM64

${CYAN}Environment Variables:${NC}
  DOCKER_REGISTRY    Docker registry URL
  DOCKER_NAMESPACE   Docker namespace/organization
  VERSION           Image version (auto-detected from package.json)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        -t|--tag)
            CUSTOM_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        -n|--namespace)
            DOCKER_NAMESPACE="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --no-cache)
            CACHE=false
            shift
            ;;
        --multi-arch)
            MULTI_ARCH=true
            PLATFORM="linux/amd64,linux/arm64"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be 'development' or 'production'"
    exit 1
fi

# Set image tags
if [[ -n "$CUSTOM_TAG" ]]; then
    IMAGE_TAG="$CUSTOM_TAG"
else
    IMAGE_TAG="$VERSION"
fi

FULL_IMAGE_NAME="$DOCKER_REGISTRY/$DOCKER_NAMESPACE/$IMAGE_NAME:$IMAGE_TAG"

# Print build information
print_header "Ring Platform Docker Build"
echo -e "${WHITE}Configuration:${NC}"
echo -e "  Environment: ${CYAN}$ENVIRONMENT${NC}"
echo -e "  Platform: ${CYAN}$PLATFORM${NC}"
echo -e "  Image: ${CYAN}$FULL_IMAGE_NAME${NC}"
echo -e "  Version: ${CYAN}$VERSION${NC}"
echo -e "  Git Commit: ${CYAN}$GIT_COMMIT${NC}"
echo -e "  Build Date: ${CYAN}$BUILD_DATE${NC}"
echo -e "  Push: ${CYAN}$PUSH${NC}"
echo -e "  Cache: ${CYAN}$CACHE${NC}"
echo -e "  Multi-arch: ${CYAN}$MULTI_ARCH${NC}"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "Dockerfile" ]]; then
    print_error "This script must be run from the Ring Platform root directory"
    exit 1
fi

# Prepare build arguments
BUILD_ARGS=(
    --build-arg "NODE_ENV=$ENVIRONMENT"
    --build-arg "VERSION=$VERSION"
    --build-arg "BUILD_DATE=$BUILD_DATE"
    --build-arg "GIT_COMMIT=$GIT_COMMIT"
)

# Prepare Docker build command
DOCKER_CMD="docker"
if [[ "$MULTI_ARCH" == true ]]; then
    DOCKER_CMD="docker buildx"
    
    # Ensure buildx is available
    if ! docker buildx version >/dev/null 2>&1; then
        print_error "Docker Buildx is required for multi-architecture builds"
        exit 1
    fi
    
    # Create builder if it doesn't exist
    if ! docker buildx ls | grep -q "ring-builder"; then
        print_info "Creating multi-platform builder..."
        docker buildx create --name ring-builder --use
    else
        docker buildx use ring-builder
    fi
fi

# Build command components
BUILD_CMD_ARGS=(
    "build"
    "--platform" "$PLATFORM"
    "--tag" "$FULL_IMAGE_NAME"
)

# Add cache options
if [[ "$CACHE" == true ]]; then
    BUILD_CMD_ARGS+=("--cache-from" "type=local,src=/tmp/.buildx-cache")
    BUILD_CMD_ARGS+=("--cache-to" "type=local,dest=/tmp/.buildx-cache-new,mode=max")
else
    BUILD_CMD_ARGS+=("--no-cache")
fi

# Add push option for multi-arch builds
if [[ "$MULTI_ARCH" == true ]] && [[ "$PUSH" == true ]]; then
    BUILD_CMD_ARGS+=("--push")
elif [[ "$MULTI_ARCH" == true ]]; then
    BUILD_CMD_ARGS+=("--load")
fi

# Add build args
BUILD_CMD_ARGS+=("${BUILD_ARGS[@]}")

# Add context
BUILD_CMD_ARGS+=(".")

# Execute build
print_info "Starting Docker build..."
echo -e "${CYAN}Command: $DOCKER_CMD ${BUILD_CMD_ARGS[*]}${NC}"
echo ""

if $DOCKER_CMD "${BUILD_CMD_ARGS[@]}"; then
    print_success "Docker build completed successfully!"
    
    # Move cache for next build
    if [[ "$CACHE" == true ]] && [[ -d "/tmp/.buildx-cache-new" ]]; then
        rm -rf /tmp/.buildx-cache
        mv /tmp/.buildx-cache-new /tmp/.buildx-cache
    fi
    
    # Push image if requested and not multi-arch (multi-arch pushes during build)
    if [[ "$PUSH" == true ]] && [[ "$MULTI_ARCH" == false ]]; then
        print_info "Pushing image to registry..."
        if docker push "$FULL_IMAGE_NAME"; then
            print_success "Image pushed successfully!"
        else
            print_error "Failed to push image"
            exit 1
        fi
    fi
    
    # Show image information
    if [[ "$MULTI_ARCH" == false ]]; then
        print_info "Image information:"
        docker images "$FULL_IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    fi
    
    echo ""
    print_success "Build process completed!"
    
    if [[ "$PUSH" == true ]]; then
        echo -e "${GREEN}🚀 Image available at: ${WHITE}$FULL_IMAGE_NAME${NC}"
    else
        echo -e "${GREEN}🐳 Local image: ${WHITE}$FULL_IMAGE_NAME${NC}"
        echo -e "${YELLOW}💡 To push: docker push $FULL_IMAGE_NAME${NC}"
    fi
    
else
    print_error "Docker build failed!"
    exit 1
fi
