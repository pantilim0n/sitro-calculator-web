#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
stamp=$(date -u +%Y%m%d-%H%M%S)
backup_dir="${1:-$project_dir/backups/$stamp}"
mkdir -p "$backup_dir"

git -C "$project_dir" bundle create "$backup_dir/sitro-repository.bundle" --all
tar -czf "$backup_dir/sitro-files.tar.gz" \
  --exclude=.git --exclude=.env.server --exclude=backups \
  -C "$project_dir" .

printf '%s\n' "Backup created: $backup_dir"
