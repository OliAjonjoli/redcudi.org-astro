# Redcudi.org Production Setup Guide

Complete documentation for setting up redcudi.org in a production environment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Browser                                                          │
│    ↓                                                              │
│  Cloudflare CDN                                                   │
│    ↓                                                              │
│  Plesk Control Panel (nginx + SSL)                               │
│    ├─→ redcudi.org (port 80/443)                                │
│    │     └─→ /proj/redcudi.org/.prod/astro/dist/                │
│    │         (Static HTML files)                                │
│    │                                                              │
│    └─→ cms.redcudi.org (port 80/443)                            │
│          └─→ Docker Container (Strapi on port 12002)            │
│               └─→ PostgreSQL Database                            │
│                                                                   │
│  Webhook Flow:                                                    │
│    Strapi → Webhook → localhost:4000/webhook                     │
│    (Docker)          (Relay Service)                             │
│                         ↓                                         │
│                    GitHub API                                     │
│                         ↓                                         │
│                    GitHub Actions                                 │
│                         ↓                                         │
│                    SSH Deploy → git pull → npm build             │
│                         ↓                                         │
│                    /proj/redcudi.org/.prod/astro/dist/           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
/proj/redcudi.org/
├── .prod/                          # Production configuration & services
│   ├── astro/
│   │   ├── dist/                   # Built static site (served by nginx)
│   │   ├── node_modules/
│   │   └── src/                    # Symlink to astro repo
│   ├── webhook-relay.js            # Node.js relay service
│   ├── .env.webhook                # [SENSITIVE] Webhook relay env vars
│   ├── nginx-webhook.conf          # Nginx proxy config for relay
│   └── docker-compose.yml          # Docker services (Strapi + PostgreSQL)
│
├── astro/                          # Git repo: redcudi.org-astro
│   ├── src/
│   ├── public/
│   ├── .github/workflows/
│   │   ├── deploy-static.yml       # Triggered on git push
│   │   └── deploy-content.yml      # Triggered by webhook
│   └── package.json
│
└── strapi/                         # Git repo: redcudi.org-strapi
    ├── src/
    ├── config/
    ├── package.json
    └── Dockerfile
```

## Production Services

### 1. Strapi CMS + PostgreSQL (Dockerized)

**Location**: `/proj/redcudi.org/.prod/`

**Running**:
```bash
cd /proj/redcudi.org/.prod
docker-compose up -d
```

**Services**:
- `redcudi-strapi`: Strapi CMS on port 12002
- `redcudi-postgres`: PostgreSQL 16 on port 5432

**Access**:
- Admin: https://cms.redcudi.org/admin
- API: https://cms.redcudi.org/api

**Important Files**:
- `docker-compose.yml` - Service configuration
- `.env` (not tracked) - Database credentials and Strapi secrets

### 2. Webhook Relay Service

**Location**: `/proj/redcudi.org/.prod/webhook-relay.js`

**Purpose**: Translates Strapi webhooks to GitHub repository_dispatch events

**Running**:
```bash
# Start service
sudo systemctl start redcudi-webhook-relay

# View logs
sudo journalctl -u redcudi-webhook-relay -f

# Restart after code changes
sudo systemctl restart redcudi-webhook-relay
```

**Configuration**:
- Port: 4000 (localhost only)
- Exposed via nginx proxy at: `https://cms.redcudi.org/webhook`
- Auth: `x-relay-secret` header (see `.env.webhook`)
- Deduplication: 5 seconds (prevents duplicate GitHub triggers)

**Environment Variables** (`/proj/redcudi.org/.prod/.env.webhook`):
```
GH_PAT=ghp_xxxxxxxxxxxx              # GitHub Personal Access Token
RELAY_SECRET=xxxxxxxxxxxxx           # Secret for Strapi webhook auth
PORT=4000
```

**Important**: Never commit `.env.webhook` to git!

### 3. Nginx Configuration

**Location**: `/var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf`

**Purpose**: Proxy `/webhook` requests to relay service on localhost:4000

**Configuration**:
```nginx
location ^~ /webhook {
    proxy_pass http://localhost:4000/webhook;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

**Why `location ^~ /webhook`?**: 
- `^~` ensures this location matches with higher precedence than the Docker proxy `location ~ ^/.*`
- Without it, all requests get proxied to Docker instead of the relay

**Verify Config**:
```bash
sudo nginx -T          # Test configuration
sudo systemctl reload nginx  # Apply changes
```

**Astro Static Site**:
- Location: `/var/www/vhosts/system/redcudi.org/conf/nginx.conf`
- Document root: `/proj/redcudi.org/.prod/astro/dist/`
- Served on: https://redcudi.org (ports 80/443)

### 4. Astro Static Site

**Location**: `/proj/redcudi.org/astro/`

**Build & Deploy**:
```bash
cd /proj/redcudi.org/astro
npm install
npm run build  # Creates /dist folder
```

**Served by nginx** from `/proj/redcudi.org/.prod/astro/dist/`

**Permissions** (set once):
```bash
sudo chmod -R 755 /proj/redcudi.org
find /proj/redcudi.org -type f -exec sudo chmod 644 {} \;
```

## Deployment Workflows

### Workflow 1: Code Changes (GitHub Push)

```
git push to main (astro repo)
    ↓
GitHub Actions (deploy-static.yml)
    ↓
SSH into server
    ↓
cd /proj/redcudi.org/.prod/astro
git reset --hard HEAD
git clean -fd
git pull origin main
npm ci
npm run build
    ↓
nginx serves updated /dist files
```

**Trigger**: Push to `main` branch

**Time**: ~2 minutes

### Workflow 2: Content Changes (Strapi Webhook)

```
Publish content in Strapi
    ↓
Strapi sends webhook to https://cms.redcudi.org/webhook
    ↓
nginx proxy → localhost:4000/webhook (relay service)
    ↓
Relay validates x-relay-secret header
    ↓
Relay checks for duplicates (5 sec window)
    ↓
Relay sends GitHub repository_dispatch event
    ↓
GitHub Actions (deploy-content.yml)
    ↓
Same deployment process as Workflow 1
    ↓
Site automatically updates
```

**Trigger**: Click "Publish" in Strapi admin

**Time**: ~2-3 minutes

**Deduplication**: If same content type published twice within 5 seconds, second trigger is ignored

### Workflow 3: Strapi Code Changes

```
git push to main (strapi repo)
    ↓
Docker Hub or GitHub Container Registry
    ↓
Pull new image: ghcr.io/OliAjonjoli/redcudi.org-strapi:latest
    ↓
docker-compose pull && docker-compose up -d
    ↓
Strapi restarts with new code
```

**Manual trigger** (for now):
```bash
cd /proj/redcudi.org/.prod
docker-compose pull
docker-compose up -d
```

## Strapi Webhook Configuration

**Location**: Strapi Admin → Settings → Webhooks

**Current Setup**:
- Name: `GitHub Auto-Deploy`
- URL: `https://cms.redcudi.org/webhook`
- Event Type: Entry → publish
- Headers:
  - `x-relay-secret`: (from `.env.webhook`)
- Status: Enabled

**To Modify**:
1. Login to https://cms.redcudi.org/admin
2. Go to Settings → Webhooks
3. Click the webhook to edit
4. Click Save

## Server Setup Checklist

If you need to set up this on a new server:

### Prerequisites
- [ ] Linux server with Plesk installed
- [ ] Docker and Docker Compose installed
- [ ] Node.js v20+ installed
- [ ] Git installed
- [ ] SSH key authentication configured

### Step 1: Clone Repositories
```bash
cd /proj/redcudi.org
git clone https://github.com/OliAjonjoli/redcudi.org-astro.git astro
git clone https://github.com/OliAjonjoli/redcudi.org-strapi.git strapi
```

### Step 2: Set Up .prod Directory
```bash
mkdir -p /proj/redcudi.org/.prod/astro
cd /proj/redcudi.org/.prod

# Copy webhook relay
cp ../astro/.prod/webhook-relay.js .

# Create webhook config
cat > .env.webhook << 'EOF'
GH_PAT=your_github_token
RELAY_SECRET=your_random_secret
PORT=4000
EOF
chmod 600 .env.webhook

# Copy docker-compose and nginx config
cp ../astro/.prod/docker-compose.yml .
cp ../astro/.prod/webhook.conf /var/www/vhosts/system/cms.redcudi.org/conf/
```

### Step 3: Create Systemd Service
```bash
sudo tee /etc/systemd/system/redcudi-webhook-relay.service > /dev/null << 'EOF'
[Unit]
Description=Redcudi Webhook Relay Service
After=network.target

[Service]
Type=simple
User=oliboli
WorkingDirectory=/proj/redcudi.org/.prod
ExecStart=/usr/bin/node /proj/redcudi.org/.prod/webhook-relay.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webhook-relay
EnvironmentFile=/proj/redcudi.org/.prod/.env.webhook

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable redcudi-webhook-relay
sudo systemctl start redcudi-webhook-relay
```

### Step 4: Configure Plesk

**For redcudi.org** (Astro):
- Document root: `/proj/redcudi.org/.prod/astro/dist/`
- SSL certificate: Let's Encrypt (auto-renew)

**For cms.redcudi.org** (Strapi Docker):
- Forward to Docker: `0.0.0.0:12002`
- Add nginx webhook config:
  - Edit `/var/www/vhosts/system/cms.redcudi.org/conf/nginx.conf`
  - Add line before Docker extension: `include "/var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf";`
  - Run `sudo nginx -T && sudo systemctl reload nginx`

### Step 5: Set Permissions
```bash
sudo chmod -R 755 /proj/redcudi.org
find /proj/redcudi.org -type f -exec sudo chmod 644 {} \;
```

### Step 6: Build Astro
```bash
cd /proj/redcudi.org/astro
npm ci
npm run build
```

### Step 7: Start Strapi
```bash
cd /proj/redcudi.org/.prod
docker-compose up -d
```

### Step 8: Configure GitHub Secrets (in Astro repo)
```
PROD_SERVER_HOST: your.server.com
PROD_SERVER_USER: oliboli
PROD_SERVER_SSH_KEY: (your SSH private key)
```

### Step 9: Test Deployment
```bash
# Test code deploy
git push to main in astro repo

# Test content deploy
Publish something in Strapi
```

## Important Commands

### Astro Site
```bash
cd /proj/redcudi.org/astro

# Build locally
npm run build

# Deploy (automatic via GitHub Actions)
git push origin main

# View on server
ls -la /proj/redcudi.org/.prod/astro/dist/
```

### Strapi
```bash
cd /proj/redcudi.org/.prod

# View logs
docker logs redcudi-strapi -f

# Stop/start
docker-compose down
docker-compose up -d

# Database logs
docker logs redcudi-postgres -f

# Backup database
docker exec redcudi-postgres pg_dump -U redcudi redcudi > backup.sql
```

### Webhook Relay
```bash
# Check status
sudo systemctl status redcudi-webhook-relay

# View logs
sudo journalctl -u redcudi-webhook-relay -f

# Restart after code changes
sudo systemctl restart redcudi-webhook-relay

# Test relay directly
curl -X POST http://localhost:4000/webhook \
  -H "x-relay-secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'

# Test through nginx
curl -X POST https://cms.redcudi.org/webhook \
  -H "x-relay-secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

### Nginx
```bash
# Test configuration
sudo nginx -T

# Reload
sudo systemctl reload nginx

# View access logs
tail -f /var/www/vhosts/system/redcudi.org/logs/proxy_access_ssl_log
tail -f /var/www/vhosts/system/cms.redcudi.org/logs/proxy_access_ssl_log

# View error logs
tail -f /var/www/vhosts/system/redcudi.org/logs/proxy_error_log
tail -f /var/www/vhosts/system/cms.redcudi.org/logs/proxy_error_log
```

## Troubleshooting

### Site shows old content
```bash
# Verify build completed
ls -la /proj/redcudi.org/.prod/astro/dist/

# Check permissions
sudo ls -la /proj/redcudi.org/.prod/astro/

# Reload in browser with Ctrl+Shift+R to bypass cache
```

### Webhook not triggering
```bash
# 1. Check relay is running
sudo systemctl status redcudi-webhook-relay

# 2. Check logs
sudo journalctl -u redcudi-webhook-relay -f

# 3. Test relay directly
curl -X POST http://localhost:4000/webhook \
  -H "x-relay-secret: $(grep RELAY_SECRET /proj/redcudi.org/.prod/.env.webhook | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"event":{"model":{"singularName":"professional"},"action":"publish"}}'

# 4. Check nginx proxy
sudo nginx -T | grep -A 10 "webhook"

# 5. Test through nginx
curl -X POST https://cms.redcudi.org/webhook \
  -H "x-relay-secret: $(grep RELAY_SECRET /proj/redcudi.org/.prod/.env.webhook | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"event":{"model":{"singularName":"professional"},"action":"publish"}}'

# 6. Check Strapi webhook configuration
# - Login to https://cms.redcudi.org/admin
# - Settings → Webhooks
# - Verify URL and secret match

# 7. Check GitHub Actions
# - https://github.com/OliAjonjoli/redcudi.org-astro/actions
# - Verify workflow ran
```

### Strapi not accessible
```bash
# Check Docker containers
docker ps

# View Strapi logs
docker logs redcudi-strapi -f

# Restart Strapi
docker-compose restart redcudi-strapi

# Check database connection
docker exec redcudi-postgres psql -U redcudi -c "SELECT 1"
```

### Database issues
```bash
# Check PostgreSQL
docker exec redcudi-postgres pg_isready

# Connect to database
docker exec -it redcudi-postgres psql -U redcudi -d redcudi

# Dump database
docker exec redcudi-postgres pg_dump -U redcudi redcudi > backup.sql

# Restore database
docker exec -i redcudi-postgres psql -U redcudi redcudi < backup.sql
```

## Security Notes

1. **Never commit sensitive files**:
   - `.env.webhook` (GitHub token, relay secret)
   - `.env` files (database passwords)
   - Private SSH keys

2. **GitHub Token Permissions**:
   - Only needs `repo` scope for repository_dispatch
   - Rotate regularly
   - Never share publicly

3. **Firewall Rules**:
   - Only expose ports 80, 443 to public
   - Port 4000 (relay) should be localhost only
   - PostgreSQL (5432) should be Docker-only

4. **Backups**:
   ```bash
   # Backup database regularly
   docker exec redcudi-postgres pg_dump -U redcudi redcudi > /backups/redcudi_$(date +%Y%m%d).sql
   ```

## Monitoring

### Check All Services
```bash
echo "=== Astro ===" && \
ls /proj/redcudi.org/.prod/astro/dist/index.html && echo "✓ Site files exist" || echo "✗ Missing site files"

echo -e "\n=== Strapi ===" && \
docker ps | grep redcudi-strapi && echo "✓ Container running" || echo "✗ Container not running" && \
curl -s https://cms.redcudi.org/api/health || echo "✗ API not responding"

echo -e "\n=== Webhook Relay ===" && \
sudo systemctl status redcudi-webhook-relay | grep active && echo "✓ Service running" || echo "✗ Service not running"

echo -e "\n=== Nginx ===" && \
sudo nginx -T > /dev/null 2>&1 && echo "✓ Configuration valid" || echo "✗ Configuration error"
```

## Version Info

Last updated: January 27, 2026

- Astro: v5.16.9
- Strapi: v5.33.4
- PostgreSQL: 16-alpine
- Node.js: v20.20.0
- Docker: latest
- Nginx: latest (via Plesk)

---

**Need help?** Check the logs and troubleshooting section above!
