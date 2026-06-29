#!/bin/sh
set -e

echo "Running database migrations..."
node scripts/run-migrations.mjs

echo "Starting application..."
exec node server.js
