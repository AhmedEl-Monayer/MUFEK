#!/bin/sh
# تشغيل المنصة على Alwaysdata (خطة مجانية) أو أي استضافة Node مشابهة.
set -e

export NODEJS_VERSION=24
export NODE_ENV=production

cd "$(dirname "$0")"
exec node --env-file-if-exists=.env server/index.js
