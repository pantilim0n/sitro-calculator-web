#!/bin/sh
set -eu

APP_DIR=${SITRO_APP_DIR:-/opt/sitro/app}
BACKUP_DIR=${SITRO_BACKUP_DIR:-/opt/sitro/backups}
ORDER_VOLUME=${SITRO_ORDER_VOLUME:-app_order_data}
KEEP_DAYS=${SITRO_BACKUP_KEEP_DAYS:-30}

umask 077
mkdir -p "$BACKUP_DIR"

volume_path=$(docker volume inspect --format '{{ .Mountpoint }}' "$ORDER_VOLUME")
stamp=$(date '+%Y-%m-%d_%H-%M-%S')
temporary="$BACKUP_DIR/.sitro-$stamp.tar.gz.tmp"
archive="$BACKUP_DIR/sitro-$stamp.tar.gz"

tar -czf "$temporary" \
  -C "$volume_path" . \
  -C "$APP_DIR" .env.server
mv "$temporary" "$archive"
chmod 600 "$archive"
sha256sum "$archive" > "$archive.sha256"
chmod 600 "$archive.sha256"

find "$BACKUP_DIR" -type f \( -name 'sitro-*.tar.gz' -o -name 'sitro-*.tar.gz.sha256' \) -mtime "+$KEEP_DAYS" -delete
printf '%s\n' "$archive"
