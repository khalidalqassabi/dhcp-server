#!/usr/bin/env bash
set -e

echo "==> Creating MySQL database and user..."
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS kea;
CREATE USER IF NOT EXISTS 'kea'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON kea.* TO 'kea'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "==> Initialising Kea schema..."
kea-admin db-init mysql -u kea -p REPLACE_WITH_STRONG_PASSWORD -n kea -h 127.0.0.1

echo "==> Done. Kea MySQL database is ready."
