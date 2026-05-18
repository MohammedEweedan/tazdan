#!/usr/bin/env bash
# Database backup script for promrkts PostgreSQL
# Usage:
#   ./scripts/backup-db.sh                          # manual one-off
#   Add to cron: 0 2 * * * /app/scripts/backup-db.sh
#
# Env vars read:
#   DATABASE_URL  (postgres://user:pass@host:5432/db)
#   BACKUP_DIR    (default: ./backups)
#   BACKUP_RETAIN_DAYS (default: 14)
#   S3_BUCKET     (optional — upload to S3 if set)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="promrkts_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Parse DATABASE_URL ──────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Extract components from postgres://user:pass@host:5432/db
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgres(ql)?://([^:]+):.*|\2|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|postgres(ql)?://[^:]+:([^@]+)@.*|\2|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup of ${DB_NAME} → ${FILEPATH}"

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[backup] Done — ${FILEPATH} (${SIZE})"

# ── Upload to S3 (optional) ─────────────────────────────────────────
if [[ -n "${S3_BUCKET:-}" ]]; then
  S3_KEY="${S3_BUCKET}/backups/${FILENAME}"
  echo "[backup] Uploading to s3://${S3_KEY}"
  aws s3 cp "$FILEPATH" "s3://${S3_KEY}" --storage-class STANDARD_IA
  echo "[backup] S3 upload complete"
fi

# ── Prune old local backups ─────────────────────────────────────────
echo "[backup] Pruning backups older than ${RETAIN_DAYS} days"
find "$BACKUP_DIR" -name "promrkts_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
echo "[backup] Pruning complete"

echo "[backup] ✓ Backup finished successfully"
