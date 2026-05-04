#!/usr/bin/env bash
set -e

read -rsp "Enter MySQL kea user password: " KEA_PASS
echo

echo "==> Creating MySQL database and user..."
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS kea;
CREATE USER IF NOT EXISTS 'kea'@'127.0.0.1' IDENTIFIED BY '${KEA_PASS}';
GRANT ALL PRIVILEGES ON kea.* TO 'kea'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "==> Initialising Kea schema..."
kea-admin db-init mysql -u kea -p "${KEA_PASS}" -n kea -h 127.0.0.1

echo "==> Done. Kea MySQL database is ready."
echo "==> Remember: use this same password in /etc/kea/kea-dhcp4.conf (3 occurrences)."
