# Ubuntu Installation Guide

## Prerequisites

Ubuntu 22.04 or 24.04 LTS. Run all commands as a user with `sudo` access.

## 1. Install packages

### Option A — ISC public repository (preferred)

```bash
# Add ISC Kea 3.0 public repository (free — no subscription required)
curl -fsSL 'https://dl.cloudsmith.io/public/isc/kea-3-0/setup.deb.sh' -o /tmp/kea-setup.sh
sudo bash /tmp/kea-setup.sh

sudo apt install -y \
  isc-kea-dhcp4-server \
  isc-kea-ctrl-agent \
  isc-kea-admin \
  isc-kea-hooks \
  mysql-server \
  nginx \
  nodejs npm
```

> `isc-kea-hooks` includes all open-source hooks: `lease_cmds`, `host_cmds`, `subnet_cmds`, `stat_cmds`.
> Only `cb_cmds` (config backend) and `rbac` require a paid subscription — this project does not use them.

### Option B — Build Kea from source (if ISC repo is unavailable)

Find the latest tarball version at `https://downloads.isc.org/isc/kea/` then replace `X.Y.Z` below:

```bash
# Install build dependencies (Kea 3.x uses Meson + Ninja)
sudo apt install -y \
  build-essential meson ninja-build pkg-config \
  libboost-all-dev libssl-dev liblog4cplus-dev \
  libmysqlclient-dev libpq-dev

# Download — check https://downloads.isc.org/isc/kea/ for latest version
KEA_VERSION=3.1.8
curl -fL -o /tmp/kea-${KEA_VERSION}.tar.gz \
  "https://downloads.isc.org/isc/kea/${KEA_VERSION}/kea-${KEA_VERSION}.tar.gz"

cd /tmp
tar xf kea-${KEA_VERSION}.tar.gz
cd kea-${KEA_VERSION}

meson setup build \
  --prefix=/usr \
  --sysconfdir=/etc \
  --localstatedir=/var \
  -Dmysql=true \
  -Ddocs=disabled

ninja -C build -j$(nproc)
sudo ninja -C build install
sudo ldconfig
```

After building, hooks install to `/usr/lib/kea/hooks/`. Update the hook paths in `kea/kea-dhcp4.conf` before copying:

```bash
# Verify hooks are present
ls /usr/lib/kea/hooks/

# Update hook paths in config
sed -i 's|/usr/lib/x86_64-linux-gnu/kea/hooks/|/usr/lib/kea/hooks/|g' \
  kea/kea-dhcp4.conf
```

Install remaining packages:
```bash
sudo apt install -y mysql-server nginx nodejs npm
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
- In `/etc/kea/kea-dhcp4.conf`: set the same MySQL password you used in step 2 (two occurrences — lease-database, hosts-database).
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
