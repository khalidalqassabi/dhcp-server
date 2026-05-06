# Ubuntu Installation Guide

## Prerequisites

Ubuntu 22.04 or 24.04 LTS. Run all commands as a user with `sudo` access.

## 1. Install packages

```bash
# Add ISC Kea 2.6 repository
curl -1sLf 'https://dl.cloudsmith.io/public/isc/kea-2-6/setup.deb.sh' | sudo bash

sudo apt install -y \
  isc-kea-dhcp4-server \
  isc-kea-ctrl-agent \
  isc-kea-admin \
  isc-kea-hooks \
  mysql-server \
  nginx \
  nodejs npm
```

## 2. Set up MySQL

Edit `kea/init-mysql.sh` and replace both occurrences of `REPLACE_WITH_STRONG_PASSWORD`
with a strong password, then run:

```bash
sudo bash kea/init-mysql.sh
```

## 3. Configure Kea

```bash
sudo cp kea/kea-dhcp4.conf /etc/kea/kea-dhcp4.conf
sudo cp kea/kea-ctrl-agent.conf /etc/kea/kea-ctrl-agent.conf
```

Edit both files and replace `REPLACE_WITH_STRONG_PASSWORD`:
- In `/etc/kea/kea-dhcp4.conf`: set the same MySQL password you used in step 2 (three occurrences — lease-database, hosts-database, config-control).
- In `/etc/kea/kea-ctrl-agent.conf`: set a strong admin UI password under `clients[0].password`.

## 4. Generate TLS certificate

```bash
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/kea-admin.key \
  -out /etc/ssl/certs/kea-admin.crt \
  -subj "/CN=dhcp-admin"
```

## 5. Configure nginx

```bash
sudo cp nginx/dhcp-admin.conf /etc/nginx/sites-available/dhcp-admin
sudo ln -s /etc/nginx/sites-available/dhcp-admin /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Build and deploy the frontend

```bash
cd /home/user01/Downloads/dhcp-server-main/frontend
npm install
npm run build
sudo mkdir -p /var/www/dhcp-admin
sudo cp -r /home/user01/Downloads/dhcp-server-main/frontend/dist/dhcp-frontend/* /var/www/dhcp-admin/
```

## 7. Start services

```bash
sudo systemctl enable --now mysql
sudo systemctl enable --now isc-kea-dhcp4-server
sudo systemctl enable --now isc-kea-ctrl-agent
sudo systemctl enable --now nginx
```

## 8. Verify

```bash
systemctl status isc-kea-dhcp4-server
systemctl status isc-kea-ctrl-agent
# Test CA is reachable (replace ADMIN_PASSWORD with value from kea-ctrl-agent.conf)
curl -s -u kea-api:ADMIN_PASSWORD http://127.0.0.1:8000/ \
  -d '{"command":"status-get","service":["dhcp4"]}' | python3 -m json.tool
```

Open `https://<server-ip>` in a browser. Accept the self-signed certificate warning.
Log in with the admin UI password you set in step 3.

## Notes

- **Hook library path**: `/usr/lib/x86_64-linux-gnu/kea/hooks/` is correct for Ubuntu x86_64.
  On ARM64 (Raspberry Pi, AWS Graviton), replace with `/usr/lib/aarch64-linux-gnu/kea/hooks/`
  in `/etc/kea/kea-dhcp4.conf`.
- **First subnet**: After logging in, go to the SUBNETS page to add your first subnet and pool.
  The DHCP server will not assign leases until at least one subnet is configured.
- **Password sync**: The MySQL password in `kea-dhcp4.conf` and the password used in `init-mysql.sh`
  must match exactly.
- **Changing the admin UI password**: Edit `clients[0].password` in `/etc/kea/kea-ctrl-agent.conf`
  then run `sudo systemctl restart isc-kea-ctrl-agent`.
