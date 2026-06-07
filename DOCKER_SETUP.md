# 🐳 Ring Platform Docker Setup Guide

**Complete Docker containerization guide for Ring Platform - Professional Networking with Web3 Integration**

> **Ring Platform v1.6.0** is a Next.js 16 + React 19 professional networking platform with PostgreSQL-primary or Firebase backends, PaymentConductor, and Web3 integration. This guide covers **Docker self-hosted** deployment. Kubernetes manifests are **not** in the public OSS repo — see [Ringdom](https://ringdom.org) for managed hosting.

---

## 📋 **Prerequisites**

### System Requirements
- **Docker Desktop** 4.0+ (Mac/Windows) or **Docker Engine** 20.10+ (Linux)
- **Docker Compose** 2.0+ (included with Docker Desktop)
- **Git** (latest version)
- **4GB RAM** minimum, **8GB recommended**
- **10GB free disk space**

### Required Services
- **Firebase Project** with Firestore and Authentication enabled
- **OAuth Providers** (Google, Apple - optional)
- **Vercel Blob Storage** (for file uploads)

---

## 🚀 **Quick Start (All Platforms)**

### 1. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/connectplatform/ring.git
cd ring

# Copy environment template
cp docker.env.template .env.local

# Edit .env.local with your Firebase credentials
# (See Configuration section below)
```

### 2. Start with Docker Compose
```bash
# Start all services (Ring + Redis + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f ring-app

# Stop services
docker-compose down
```

### 3. Access the Application
- **Ring Platform**: http://localhost:3000
- **Redis**: localhost:6379
- **MongoDB**: localhost:27017

---

## 🖥️ **Platform-Specific Installation**

### 🍎 **macOS Setup**

#### Option 1: Docker Desktop (Recommended)
```bash
# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop from Applications
open -a Docker

# Verify installation
docker --version
docker-compose --version
```

#### Option 2: OrbStack (Lightweight Alternative)
```bash
# Install OrbStack
brew install --cask orbstack

# Start OrbStack
open -a OrbStack
```

#### Build and Run
```bash
# Clone Ring Platform
git clone https://github.com/connectplatform/ring.git
cd ring

# Setup environment
cp docker.env.template .env.local
# Edit .env.local with your Firebase credentials

# Build and start
docker-compose up --build -d

# Check status
docker-compose ps
```

### 🪟 **Windows Setup**

#### Option 1: Docker Desktop with WSL2 (Recommended)
```powershell
# Install WSL2 (if not already installed)
wsl --install

# Download and install Docker Desktop from:
# https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

# Enable WSL2 integration in Docker Desktop settings
```

#### Option 2: Windows with Git Bash
```bash
# Open Git Bash as Administrator
# Clone Ring Platform
git clone https://github.com/connectplatform/ring.git
cd ring

# Setup environment
cp docker.env.template .env.local
# Edit .env.local with your Firebase credentials

# Build and start
docker-compose up --build -d
```

#### PowerShell Commands
```powershell
# Clone Ring Platform
git clone https://github.com/connectplatform/ring.git
Set-Location ring

# Copy environment template
Copy-Item docker.env.template .env.local

# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f ring-app
```

### 🐧 **Linux Setup**

#### Ubuntu/Debian
```bash
# Update package index
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### CentOS/RHEL/Fedora
```bash
# Install Docker
sudo dnf install -y docker docker-compose
# or for older versions: sudo yum install -y docker docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Arch Linux
```bash
# Install Docker
sudo pacman -S docker docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Build and Run (All Linux Distributions)
```bash
# Clone Ring Platform
git clone https://github.com/connectplatform/ring.git
cd ring

# Setup environment
cp docker.env.template .env.local
# Edit .env.local with your Firebase credentials

# Build and start
docker-compose up --build -d

# Check status
docker-compose ps
```

---

## ⚙️ **Configuration**

### Firebase Setup
1. **Create Firebase Project**: https://console.firebase.google.com
2. **Enable Services**:
   - Authentication (Email/Password, Google, Apple)
   - Firestore Database
   - Cloud Messaging (FCM)
3. **Get Configuration**:
   - Go to Project Settings > General > Your apps
   - Copy the config values to `.env.local`

### Environment Variables
Edit `.env.local` with your actual values:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Auth.js Configuration
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_FIREBASE_PROJECT_ID=your-project-id
AUTH_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
AUTH_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# OAuth Providers (Optional)
AUTH_GOOGLE_ID=your_google_client_id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_RESEND_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxx
```

---

## 🛠️ **Development Workflows**

### Development Mode
```bash
# Start with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or build development image
docker build --target builder -t ring-platform:dev .
docker run -p 3000:3000 -v $(pwd):/app ring-platform:dev
```

### Production Build
```bash
# Build production image
./docker/build.sh --env production

# Run production container
docker run -d -p 3000:3000 --env-file .env.local ring-platform:latest
```

### Multi-Architecture Build
```bash
# Build for multiple architectures
./docker/build.sh --multi-arch --push

# Build for specific architecture
./docker/build.sh --platform linux/arm64
```

---

## 📊 **Service Management**

### Docker Compose Commands
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d ring-app

# View logs
docker-compose logs -f ring-app
docker-compose logs -f redis
docker-compose logs -f mongodb

# Scale services
docker-compose up -d --scale ring-app=3

# Update services
docker-compose pull
docker-compose up -d

# Stop services
docker-compose stop
docker-compose down

# Remove everything (including volumes)
docker-compose down -v --remove-orphans
```

### Individual Container Management
```bash
# Build image
docker build -t ring-platform .

# Run container
docker run -d \
  --name ring-platform \
  -p 3000:3000 \
  --env-file .env.local \
  ring-platform

# View logs
docker logs -f ring-platform

# Execute commands in container
docker exec -it ring-platform sh

# Stop and remove
docker stop ring-platform
docker rm ring-platform
```

---

## 🔧 **Advanced Configuration**

### Custom Docker Compose
Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'
services:
  ring-app:
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
```

### Production Deployment
```bash
# Production with Nginx reverse proxy
docker-compose --profile production up -d

# With monitoring stack
docker-compose --profile monitoring up -d
```

### Environment-Specific Configs
```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

---

## 🐛 **Troubleshooting**

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
docker run -p 3001:3000 ring-platform
```

#### Permission Denied (Linux)
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo
sudo docker-compose up
```

#### Out of Memory
```bash
# Increase Docker memory limit in Docker Desktop settings
# Or add to docker-compose.yml:
services:
  ring-app:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### Firebase Connection Issues
```bash
# Check environment variables
docker-compose exec ring-app env | grep FIREBASE

# Verify Firebase config
docker-compose exec ring-app node -e "console.log(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)"
```

### Debug Mode
```bash
# Run with debug output
DEBUG=* docker-compose up

# Access container shell
docker-compose exec ring-app sh

# Check application logs
docker-compose logs -f ring-app | grep ERROR
```

### Performance Optimization
```bash
# Build with cache
docker build --cache-from ring-platform:latest -t ring-platform .

# Use multi-stage build
docker build --target runtime -t ring-platform .

# Optimize image size
docker system prune -a
```

---

## 📈 **Monitoring & Maintenance**

### Health Checks
```bash
# Check container health
docker-compose ps
docker inspect --format='{{.State.Health.Status}}' ring-platform

# Application health endpoint
curl http://localhost:3000/api/health
```

### Log Management
```bash
# View logs with timestamps
docker-compose logs -f -t ring-app

# Limit log output
docker-compose logs --tail=100 ring-app

# Export logs
docker-compose logs ring-app > ring-platform.log
```

### Backup & Restore
```bash
# Backup volumes
docker run --rm -v ring_mongodb-data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb-backup.tar.gz /data

# Restore volumes
docker run --rm -v ring_mongodb-data:/data -v $(pwd):/backup alpine tar xzf /backup/mongodb-backup.tar.gz -C /
```

---

## 🚀 **Deployment Options**

### Local Development
- **Docker Compose**: Full stack with all services
- **Single Container**: Just Ring Platform with external services

### Cloud Deployment
- **AWS ECS/Fargate**: Managed container service
- **Google Cloud Run**: Serverless containers
- **Azure Container Instances**: Simple container hosting
- **DigitalOcean App Platform**: Platform-as-a-Service

### Kubernetes
```bash
# Generate Kubernetes manifests
docker-compose config | kompose convert -f -

# Deploy to Kubernetes
kubectl apply -f ring-platform-deployment.yaml
```

---

## 📚 **Additional Resources**

### Documentation
- [Ring Platform Documentation](./docs/)
- [Firebase Setup Guide](./docs/FIREBASE_SETUP.md)
- [API Reference](./docs/API_REFERENCE.md)

### Community
- [GitHub Issues](https://github.com/connectplatform/ring/issues)
- [Discussions](https://github.com/connectplatform/ring/discussions)
- [Discord Community](https://discord.gg/ring-platform)

### Support
- **Email**: support@ring.platform
- **Documentation**: https://docs.ring.platform
- **Status Page**: https://status.ring.platform

---

## 🎯 **Next Steps**

1. **Configure Firebase** with your project credentials
2. **Set up OAuth providers** for social authentication
3. **Configure Vercel Blob** for file storage
4. **Enable Web3 features** with Ethereum integration
5. **Set up monitoring** with Prometheus and Grafana
6. **Deploy to production** using your preferred cloud provider

---

**🎉 Congratulations! You now have Ring Platform running in Docker containers across any platform. The professional networking revolution starts here!**
