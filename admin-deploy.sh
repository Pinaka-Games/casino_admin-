#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Configuration....
# ============================================================

AWS_REGION="us-east-1"
ECR_REGISTRY="496675774474.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_NAME="wulf-admin-prod"
CONTAINER_NAME="wulf-admin-test"

PORT="5005"

NEXT_PUBLIC_API_URL="https://api.wulfcasino.com/api/v1/admin"
NEXT_PUBLIC_SOCKET_URL="https://api.wulfcasino.com"
NEXT_PUBLIC_USER_FRONTEND_URL="https://wulfcasino.com"

IMAGE_TAG=""
IMAGE=""

# ============================================================
# Colors
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================
# Cleanup
# ============================================================

cleanup() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        info "Removing test container..."
        docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT

# ============================================================
# Pre-flight checks
# ============================================================

info "Checking required commands..."

command -v git >/dev/null 2>&1 || {
    error "git is not installed."
    exit 1
}

command -v docker >/dev/null 2>&1 || {
    error "docker is not installed."
    exit 1
}

command -v aws >/dev/null 2>&1 || {
    error "AWS CLI is not installed."
    exit 1
}

success "Required commands are available."

# ============================================================
# Git
# ============================================================

CURRENT_BRANCH=$(git branch --show-current)

if [[ "${CURRENT_BRANCH}" != "production" ]]; then
    error "You are currently on '${CURRENT_BRANCH}'."
    error "Deployment must be run from the 'production' branch."
    exit 1
fi

info "Pulling latest production changes..."

git pull origin production

success "Production branch is up to date."

# ============================================================
# Commit-based image tag
# ============================================================

IMAGE_TAG=$(git rev-parse --short=8 HEAD)

IMAGE="${ECR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo
info "Deployment information:"
echo "  Branch : production"
echo "  Commit : ${IMAGE_TAG}"
echo "  Image  : ${IMAGE}"
echo

# ============================================================
# ECR Login
# ============================================================

info "Logging into AWS ECR..."

aws ecr get-login-password \
    --region "${AWS_REGION}" |
    docker login \
        --username AWS \
        --password-stdin "${ECR_REGISTRY}"

success "ECR login successful."

# ============================================================
# Build
# ============================================================

info "Building Docker image..."

docker build \
    --no-cache \
    --build-arg "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" \
    --build-arg "NEXT_PUBLIC_USER_FRONTEND_URL=${NEXT_PUBLIC_USER_FRONTEND_URL}" \
    --build-arg "NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}" \
    -t "${IMAGE}" \
    .

success "Docker image built successfully."

# ============================================================
# Remove existing test container
# ============================================================

cleanup

# ============================================================
# Run test container
# ============================================================

info "Starting test container..."

docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${PORT}:${PORT}" \
    "${IMAGE}"

success "Test container started."

echo
echo "============================================================"
echo "📋 Container logs"
echo "============================================================"
echo
echo "Press Ctrl+C when you have finished checking the logs."
echo

# ============================================================
# Show logs
# ============================================================

docker logs -f "${CONTAINER_NAME}" || true

echo
echo "============================================================"
warning "You stopped following the container logs."
echo "============================================================"
echo

# ============================================================
# Ask before push
# ============================================================

read -r -p "Does the admin container look good? Push ${IMAGE_TAG} to ECR? [y/N]: " CONFIRM

if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
    warning "Deployment cancelled. Image was NOT pushed to ECR."
    exit 0
fi

# ============================================================
# Push
# ============================================================

info "Pushing image to ECR..."

docker push "${IMAGE}"

success "Docker image pushed successfully."

echo
echo "============================================================"
success "Admin deployment completed successfully!"
echo "============================================================"
echo
echo "Image:"
echo "${IMAGE}"
echo
echo "Commit:"
echo "${IMAGE_TAG}"
echo