#!/bin/sh
set -eu

APP_DIR=${SITRO_APP_DIR:-/opt/sitro/app}
BACKUP_DIR=${SITRO_BACKUP_DIR:-/opt/sitro/backups}
ORDER_VOLUME=${SITRO_ORDER_VOLUME:-app_order_data}
KEEP_DAYS=${SITRO_BACKUP_KEEP_DAYS:-30}
MAIL_CLOUD_NETRC=${SITRO_MAIL_CLOUD_NETRC:-/etc/sitro/mail-cloud.netrc}
MAIL_CLOUD_DIR=${SITRO_MAIL_CLOUD_DIR:-https://webdav.cloud.mail.ru/SITRO-backups}

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

if [ -f "$MAIL_CLOUD_NETRC" ]; then
  folder_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --netrc-file "$MAIL_CLOUD_NETRC" -X MKCOL "$MAIL_CLOUD_DIR")
  case "$folder_status" in
    201|405) ;;
    *) printf 'Mail Cloud folder error: HTTP %s\n' "$folder_status" >&2; exit 1 ;;
  esac

  archive_name=$(basename "$archive")
  curl --fail --silent --show-error --netrc-file "$MAIL_CLOUD_NETRC" \
    --upload-file "$archive" "$MAIL_CLOUD_DIR/$archive_name"
  curl --fail --silent --show-error --netrc-file "$MAIL_CLOUD_NETRC" \
    --upload-file "$archive.sha256" "$MAIL_CLOUD_DIR/$archive_name.sha256"
fi

find "$BACKUP_DIR" -type f \( -name 'sitro-*.tar.gz' -o -name 'sitro-*.tar.gz.sha256' \) -mtime "+$KEEP_DAYS" -delete
printf '%s\n' "$archive"
