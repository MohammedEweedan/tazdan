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
STARTED="$(date +%s)"
REQUIRE_OFFSITE="${BACKUP_REQUIRE_OFFSITE:-1}"

if [ "$REQUIRE_OFFSITE" = 1 ] && [ -z "${BACKUP_S3_URI:-}" ]; then
  echo '[backup] ERROR: an offsite destination is required' >&2
  exit 1
fi
case "$RETAIN_DAYS" in ''|*[!0-9]*) echo '[backup] invalid retention' >&2; exit 1;; esac
[ "$RETAIN_DAYS" -ge 2 ] || { echo '[backup] retention must be at least two days' >&2; exit 1; }
umask 077
trap 'code=$?; rm -f "$OUT.partial"; if [ -n "${FILES_OUT:-}" ]; then rm -f "$FILES_OUT.partial"; fi; if [ "$code" -ne 0 ]; then date +%s > "$DIR/latest-failure"; fi' EXIT

mkdir -p "$DIR"
echo "[backup] starting $OUT"
pg_dump --format=custom --compress=6 --no-owner --dbname="$DATABASE_URL" --file="$OUT.partial"
# A dump that pg_restore can't list is not a backup (truncated / disk full).
pg_restore --list "$OUT.partial" >/dev/null
mv "$OUT.partial" "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] wrote $OUT ($SIZE, verified readable)"

# Uploaded files (KYC documents, avatars, dispute evidence) live outside the
# database. Mounted read-only at /uploads by the compose file.
FILES_OUT=""
if [ -d /uploads ]; then
  FILES_OUT="$DIR/tazdan-uploads-$STAMP.tar.gz"
  tar -czf "$FILES_OUT.partial" -C /uploads .
  mv "$FILES_OUT.partial" "$FILES_OUT"
  echo "[backup] wrote $FILES_OUT ($(du -h "$FILES_OUT" | cut -f1))"
fi

# The manifest binds the exact dump and uploaded-file archive to this run.
DIGEST="$(sha256sum "$OUT" | cut -d ' ' -f1)"
MANIFEST="$DIR/tazdan-$STAMP.manifest.json"
UPLOADS_JSON=null
if [ -n "$FILES_OUT" ]; then
  UPLOADS_DIGEST="$(sha256sum "$FILES_OUT" | cut -d ' ' -f1)"
  UPLOADS_JSON="{\"file\":\"tazdan-uploads-$STAMP.tar.gz\",\"sha256\":\"$UPLOADS_DIGEST\"}"
fi
printf '{"version":1,"createdAt":"%s","database":{"file":"tazdan-%s.dump","sha256":"%s"},"uploads":%s}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$STAMP" "$DIGEST" "$UPLOADS_JSON" > "$MANIFEST"

# Offsite copy (DO Spaces / S3). The droplet dying must not take the backups
# with it, so a configured-but-broken upload FAILS the run instead of being
# skipped quietly.
if [ -n "${BACKUP_S3_URI:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[backup] ERROR: BACKUP_S3_URI is set but the aws CLI is missing — nothing was copied offsite" >&2
    exit 1
  fi
  set --
  if [ -n "${AWS_ENDPOINT_URL:-}" ]; then set -- --endpoint-url "$AWS_ENDPOINT_URL"; fi
  aws "$@" s3 cp "$OUT" "$BACKUP_S3_URI/" --only-show-errors
  if [ -n "$FILES_OUT" ]; then aws "$@" s3 cp "$FILES_OUT" "$BACKUP_S3_URI/" --only-show-errors; fi
  # The manifest is uploaded last. Its presence marks a complete backup set.
  aws "$@" s3 cp "$MANIFEST" "$BACKUP_S3_URI/" --only-show-errors
  echo "[backup] uploaded to $BACKUP_S3_URI"
else
  echo "[backup] WARNING: BACKUP_S3_URI not set — backups exist only on this droplet" >&2
fi

# Rotate only after a successful required offsite copy, preserving the last
# good local recovery point when uploads fail.
find "$DIR" \( -name 'tazdan-*.dump' -o -name 'tazdan-uploads-*.tar.gz' -o -name 'tazdan-*.manifest.json' \) -mtime +"$RETAIN_DAYS" -print -delete | sed 's/^/[backup] pruned /'
date +%s > "$DIR/latest-success.partial"
mv "$DIR/latest-success.partial" "$DIR/latest-success"
rm -f "$DIR/latest-failure"
echo "[backup] duration $(( $(date +%s) - STARTED )) seconds"
echo "[backup] done"
