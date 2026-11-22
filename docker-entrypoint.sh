#!/bin/sh
set -e

# المجلدات قد تكون مملوكة لـ root عند أول تركيب لـ Volume.
mkdir -p "$DATA_DIR" "$UPLOAD_DIR"

if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR" "$UPLOAD_DIR"
  exec su-exec node "$@"
fi

exec "$@"
