#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/var/www/intellihrhub/backups"
COMPOSE_FILE="/var/www/intellihrhub/docker-compose.prod.yml"
PROJECT_NAME="intellihrhub"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.dump"
MEDIA_BACKUP_FILE="$BACKUP_DIR/media_backup_$TIMESTAMP.tar.gz"

echo "Starting database backup at $(date)..."

# Run pg_dump inside the postgres-db container and redirect output to host file
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" exec -T postgres-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"

echo "Starting media backup at $(date)..."

# Compress the uploads folder from the backend container
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" exec -T backend tar -czf - -C /usr/src/app uploads > "$MEDIA_BACKUP_FILE"

echo "Media backup saved to $MEDIA_BACKUP_FILE"

# Clean up backups older than 30 days to conserve disk space
echo "Pruning backups older than 30 days..."
find "$BACKUP_DIR" -name "db_backup_*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "media_backup_*.tar.gz" -mtime +30 -delete

echo "Database and media backup completed successfully!"
