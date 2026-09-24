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
# A dump that pg_restore can't list is not a backup (truncated / disk full).
pg_restore --list "$OUT" >/dev/null
SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] wrote $OUT ($SIZE, verified readable)"

# Uploaded files (KYC documents, avatars, dispute evidence) live outside the
# database. Mounted read-only at /uploads by the compose file.
FILES_OUT=""
if [ -d /uploads ]; then
  FILES_OUT="$DIR/tazdan-uploads-$STAMP.tar.gz"
  tar -czf "$FILES_OUT" -C /uploads .
  echo "[backup] wrote $FILES_OUT ($(du -h "$FILES_OUT" | cut -f1))"
fi

# Rotate
find "$DIR" \( -name 'tazdan-*.dump' -o -name 'tazdan-uploads-*.tar.gz' \) -mtime +"$RETAIN_DAYS" -print -delete | sed 's/^/[backup] pruned /'

# Offsite copy (DO Spaces / S3). The droplet dying must not take the backups
# with it, so a configured-but-broken upload FAILS the run instead of being
# skipped quietly.
if [ -n "${BACKUP_S3_URI:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[backup] ERROR: BACKUP_S3_URI is set but the aws CLI is missing — nothing was copied offsite" >&2
    exit 1
  fi
  aws s3 cp "$OUT" "$BACKUP_S3_URI/" ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"}
  [ -n "$FILES_OUT" ] && aws s3 cp "$FILES_OUT" "$BACKUP_S3_URI/" ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"}
  echo "[backup] uploaded to $BACKUP_S3_URI"
else
  echo "[backup] WARNING: BACKUP_S3_URI not set — backups exist only on this droplet" >&2
fi

echo "[backup] done"
