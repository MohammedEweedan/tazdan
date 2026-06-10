#!/bin/sh
# Nightly Postgres backup with rotation. Runs inside the `backup` sidecar
# (postgres:16-alpine) defined in docker-compose.prod.yml; can also be run
# manually: docker compose -f docker-compose.prod.yml run --rm backup /backup.sh
#
# Writes gzipped custom-format dumps (pg_restore-able, supports parallel
# restore and selective table recovery) to the `dbbackups` volume and keeps
# the most recent $RETAIN_DAYS days.
#
# RESTORE (see docs/runbooks/backup-restore.md):
#   pg_restore --clean --if-exists -d "$DATABASE_URL" /backups/<file>.dump
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
DIR="${BACKUP_DIR:-/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DIR/tazdan-$STAMP.dump"

mkdir -p "$DIR"
echo "[backup] starting $OUT"
pg_dump --format=custom --compress=6 --no-owner --dbname="$DATABASE_URL" --file="$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] wrote $OUT ($SIZE)"

# Rotate
find "$DIR" -name 'tazdan-*.dump' -mtime +"$RETAIN_DAYS" -print -delete | sed 's/^/[backup] pruned /'

# Optional: copy offsite (DO Spaces / S3) when configured. The droplet dying
# must not take the backups with it.
if [ -n "${BACKUP_S3_URI:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "$OUT" "$BACKUP_S3_URI/" && echo "[backup] uploaded to $BACKUP_S3_URI"
fi

echo "[backup] done"
