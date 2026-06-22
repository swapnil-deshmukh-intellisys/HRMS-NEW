#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/var/www/intellihrhub"
BRANCH="main"

echo "=== Starting Deployment for intellihrhub (with Traefik) ==="

# Navigate to project directory
cd "$PROJECT_DIR"

# 1. Fetch latest changes
echo "Fetching latest changes from origin..."
git fetch origin

# 2. Reset local changes and checkout branch
echo "Checking out branch $BRANCH..."
git checkout -f "$BRANCH"
git reset --hard "origin/$BRANCH"

# 3. Pull latest code
echo "Pulling latest code..."
git pull origin "$BRANCH"

# 4. Build and start containers
echo "Building and starting Docker containers..."
docker compose -p intellihrhub -f docker-compose.prod.yml up -d --build

# 5. Clean up old images to save disk space
echo "Pruning unused Docker images..."
docker image prune -f

echo "=== Deployment Completed Successfully! ==="
