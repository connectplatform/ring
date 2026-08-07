# Ring Platform CLI

A command-line interface for deploying and managing Ring Platform services on Kubernetes.

## Installation

### Global Installation

```bash
# From the ring-platform.org directory
npm run cli:install
```

This will install the CLI globally and make the `ring` command available system-wide.

### Local Development

```bash
# Run CLI commands locally without global installation
npm run cli:dev -- <command>
```

## Commands

### Production Deployment

Deploy the current codebase to the production Kubernetes cluster:

```bash
ring --prod
```

**Options:**
- `-v, --version <version>`: Specify version to deploy (defaults to package.json version)
- `--skip-build`: Skip Docker build step
- `--skip-push`: Skip Docker push step
- `--skip-deploy`: Skip Kubernetes deployment step

**Example:**
```bash
# Deploy specific version
ring --prod --version 1.2.3

# Only build and push, skip deployment
ring --prod --skip-deploy

# Update Firebase configuration before deployment
ring config --set firebase.apiKey="your-new-api-key"
ring config --set firebase.projectId="your-project-id"
```

### Configuration Management

Manage global Ring Platform configuration:

```bash
# Set a configuration value
ring config --set k8s.controlNode=k8s-control-01

# Get a configuration value
ring config --get k8s.namespace

# List all configuration
ring config --list

# Reset to defaults
ring config --reset
```

**Configuration Keys:**
- `k8s.controlNode`: Kubernetes control node hostname
- `k8s.namespace`: Kubernetes namespace for deployment
- `database.host`: PostgreSQL host
- `database.port`: PostgreSQL port
- `database.name`: PostgreSQL database name
- `database.user`: PostgreSQL username
- `database.hybridMode`: Database hybrid mode (true/false)
- `auth.secret`: NextAuth secret
- `auth.googleClientId`: Google OAuth client ID
- `firebase.projectId`: Firebase project ID
- `firebase.apiKey`: Firebase API key
- `firebase.appId`: Firebase app ID
- `firebase.authDomain`: Firebase auth domain
- `firebase.storageBucket`: Firebase storage bucket
- `firebase.messagingSenderId`: Firebase messaging sender ID
- `firebase.measurementId`: Firebase measurement ID
- `firebase.vapidKey`: Firebase VAPID key
- `web3.polygonRpcUrl`: Polygon RPC URL
- `app.url`: Application URL
- `app.apiUrl`: API URL

### Status Check

Check the deployment status of all services:

```bash
ring status
```

This command checks:
- Kubernetes pod status
- Service status
- Ingress configuration
- Application health endpoint
- Database connectivity

## Configuration

Configuration is stored in `~/.ring-platform.org/config.json`. The CLI comes with sensible defaults for the Ring Platform production environment.

### Default Configuration

```json
{
  "k8s": {
    "controlNode": "k8s-control-01",
    "namespace": "ring-platform-org"
  },
  "database": {
    "host": "postgres.ring-platform-org.svc.cluster.local",
    "port": "5432",
    "name": "ring_platform",
    "user": "ring_user",
    "hybridMode": "true"
  },
  "auth": {
    "secret": "s5dzmaQkiKWkfIBsDpRxaPrv/X93TIyy0M5Ofk/+8z0=",
    "googleClientId": "919637187324-286nus771ip11266pobu98mgsbkoclc4.apps.googleusercontent.com"
  },
  "firebase": {
    "projectId": "ring-main",
    "apiKey": "AIzaSyCWd2YVU7mN0FkMMO9ZDuIv6MlnunH7VX8",
    "appId": "1:919637187324:web:af95cb1c3d96f2bc0bd579",
    "authDomain": "ring-main.firebaseapp.com",
    "storageBucket": "ring-main.appspot.com",
    "messagingSenderId": "919637187324",
    "measurementId": "G-WVDVCRX12R",
    "vapidKey": "BKQ4OAwA-1wPgnqLXuvbf-RE-QetqqAJX-EENcmViZ97dhygWE6K7GFyNkB_fkQo_suVk06nbkDBnypsFaajSjw"
  },
  "web3": {
    "polygonRpcUrl": "https://polygon-rpc.com"
  },
  "app": {
    "url": "https://ring-platform.org",
    "apiUrl": "https://ring-platform.org"
  }
}
```

## Prerequisites

- Node.js 18+
- Docker
- SSH access to Kubernetes control node
- kubectl configured on the control node
- GitHub Container Registry access (for pushing images)

## Workflow

The `ring --prod` command follows this workflow:

1. **Read Version**: Gets version from package.json or command line
2. **Build Image**: Builds Docker image with all required build arguments automatically pulled from CLI configuration
3. **Push Image**: Pushes image to GitHub Container Registry
4. **Deploy**: Updates Kubernetes deployment and waits for rollout

### Build Arguments

The CLI automatically includes all critical build-time environment variables:

- **Authentication**: `AUTH_SECRET`, `NEXT_PUBLIC_AUTH_GOOGLE_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXTAUTH_URL`
- **Firebase**: All client SDK variables (`NEXT_PUBLIC_FIREBASE_*`)
- **Database**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_HYBRID_MODE`
- **Application**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`
- **Web3**: `POLYGON_RPC_URL`

All variables are sourced from the CLI configuration and compiled into the Docker image at build time.

## Troubleshooting

### Common Issues

**SSH Connection Failed**
```bash
# Check SSH key is added to ssh-agent
ssh-add ~/.ssh/id_rsa

# Test SSH connection
ssh k8s-control-01 "echo 'Connection successful'"
```

**Docker Build Failed**
```bash
# Check Docker is running
docker info

# Clean up old images
docker system prune -f
```

**Kubernetes Deployment Failed**
```bash
# Check kubectl context
ssh k8s-control-01 "kubectl config current-context"

# Check namespace exists
ssh k8s-control-01 "kubectl get ns ring-platform-org"
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=1 ring --prod
# or
RING_DEBUG=1 ring --prod
```

## Contributing

The CLI is located in the `cli/` directory. To modify commands:

1. Edit the command files in `cli/commands/`
2. Update configuration in `cli/config.js`
3. Add utilities to `cli/utils.js`
4. Update this README

## License

MIT - Same as Ring Platform
