#!/bin/sh
set -e

echo "[entrypoint] 正在执行数据库迁移…"
cd /app/packages/db
DB_URL="${DB_URL:-file:/data/app.db}" node_modules/.bin/drizzle-kit migrate

echo "[entrypoint] 正在启动 nginx…"
nginx -g "daemon off;" &
NGINX_PID=$!

echo "[entrypoint] 正在启动 API 服务 (port ${PORT:-3000})…"
cd /app/apps/server
exec node --import tsx dist/index.js
