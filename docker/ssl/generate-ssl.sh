#!/bin/bash

# Ring Platform - SSL Certificate Generator
# Generates self-signed SSL certificates for local development

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Configuration
CERT_DIR="$(dirname "$0")"
DOMAIN="${1:-localhost}"
DAYS="${2:-365}"

print_info "Generating SSL certificate for domain: $DOMAIN"
print_info "Certificate will be valid for: $DAYS days"

# Create certificate directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate private key
print_info "Generating private key..."
openssl genrsa -out "$CERT_DIR/key.pem" 2048

# Generate certificate signing request
print_info "Generating certificate signing request..."
openssl req -new -key "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.csr" -subj "/C=US/ST=State/L=City/O=Ring Platform/OU=Development/CN=$DOMAIN"

# Generate self-signed certificate
print_info "Generating self-signed certificate..."
openssl x509 -req -in "$CERT_DIR/cert.csr" -signkey "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" -days "$DAYS" -extensions v3_req -extfile <(
cat <<EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Clean up CSR file
rm "$CERT_DIR/cert.csr"

# Set appropriate permissions
chmod 600 "$CERT_DIR/key.pem"
chmod 644 "$CERT_DIR/cert.pem"

print_success "SSL certificate generated successfully!"
print_info "Certificate: $CERT_DIR/cert.pem"
print_info "Private key: $CERT_DIR/key.pem"
print_warning "This is a self-signed certificate for development only!"
print_warning "Browsers will show a security warning. Click 'Advanced' and 'Proceed to $DOMAIN (unsafe)'"

# Display certificate information
print_info "Certificate details:"
openssl x509 -in "$CERT_DIR/cert.pem" -text -noout | grep -A 1 "Subject:"
openssl x509 -in "$CERT_DIR/cert.pem" -text -noout | grep -A 3 "Subject Alternative Name:"
