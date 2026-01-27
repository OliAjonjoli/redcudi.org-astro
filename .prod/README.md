# Production Server Configuration

This folder contains all server-only configuration files needed to run redcudi.org in production.

## Files Overview

### `webhook-relay.js`
**Node.js webhook relay service**

Bridges Strapi webhooks to GitHub Actions:
- Receives POST requests from Strapi at `https://cms.redcudi.org/webhook`
- Validates authentication (x-relay-secret header)
- Deduplicates within 5-second window (prevents double triggers)
- Sends GitHub `repository_dispatch` event to trigger rebuilds
- Logs all activity to systemd journal

**Requires environment**:
- `GH_PAT` - GitHub Personal Access Token
- `RELAY_SECRET` - Webhook authentication secret
- `PORT` - Listening port (default: 4000)

**Managed by**: systemd service `redcudi-webhook-relay`

**Logs**: `sudo journalctl -u redcudi-webhook-relay -f`

---

### `nginx-webhook.conf`
**Nginx reverse proxy configuration**

Routes webhook traffic from the internet to the relay service:
- Listens on: `https://cms.redcudi.org/webhook`
- Proxies to: `localhost:4000/webhook` (relay service)
- Forwards client headers (X-Forwarded-*, X-Real-IP, etc.)

**Critical detail**: Uses `location ^~ /webhook` prefix match with precedence (`^~`)
- Without `^~`, Plesk's Docker proxy rule would catch requests first
- With `^~`, this rule takes priority over regex matches

**Installation**:
```bash
sudo cp nginx-webhook.conf /var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf
sudo sed -i '/^[[:space:]]*#extension docker begin/i\    include "/var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf";' \
  /var/www/vhosts/system/cms.redcudi.org/conf/nginx.conf
sudo nginx -T && sudo systemctl reload nginx
```

**Verify**:
```bash
sudo nginx -T | grep -A 10 "location.*webhook"
curl -X POST https://cms.redcudi.org/webhook -H "x-relay-secret: test" -d '{}'
```

---

### `redcudi-webhook-relay.service`
**Systemd service definition**

Manages the webhook relay as a background service:
- Starts on boot (WantedBy=multi-user.target)
- Auto-restarts on failure
- Loads environment variables from `.env.webhook`
- Runs as user `oliboli`
- Logs to systemd journal

**Installation**:
```bash
sudo cp redcudi-webhook-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable redcudi-webhook-relay
sudo systemctl start redcudi-webhook-relay
```

**Usage**:
```bash
sudo systemctl status redcudi-webhook-relay    # Check status
sudo systemctl restart redcudi-webhook-relay   # Restart (after code changes)
sudo systemctl stop redcudi-webhook-relay      # Stop
sudo journalctl -u redcudi-webhook-relay -f    # View live logs
```

---

### `docker-compose.yml`
**Container orchestration for Strapi + PostgreSQL**

Services:
- **postgres**: PostgreSQL 16 database
  - Port: 5432 (internal only)
  - Volume: `postgres_data` (persistent storage)
  - Healthcheck: Ensures database is ready before Strapi starts

- **strapi**: Strapi CMS application
  - Port: 12002 (exposed to localhost, proxied by Plesk/nginx)
  - Depends on: postgres service (waits for health check)
  - Volumes: `strapi_uploads` (user-uploaded files)
  - Environment: All secrets from `.env` file

**Environment variables** (from `.env` file):
```
DB_NAME=redcudi
DB_USER=redcudi
DB_PASSWORD=your_strong_password
DB_PORT=5432
NODE_ENV=production
APP_KEYS=your_key
ADMIN_JWT_SECRET=your_secret
... (other Strapi secrets)
```

**Usage**:
```bash
cd /proj/redcudi.org/.prod

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f strapi
docker-compose logs -f postgres

# Restart after changes
docker-compose restart strapi

# Update image
docker-compose pull
docker-compose up -d
```

---

### `.env.webhook.example`
**Template for webhook relay environment variables**

Used to generate the actual `.env.webhook` file (which is NOT tracked in git).

**Setup**:
```bash
cp .env.webhook.example /proj/redcudi.org/.prod/.env.webhook
vim /proj/redcudi.org/.prod/.env.webhook  # Edit with real values
chmod 600 /proj/redcudi.org/.prod/.env.webhook
```

**Variables**:
- `GH_PAT` - GitHub token for repository_dispatch API
- `RELAY_SECRET` - Secret to authenticate Strapi webhook
- `PORT` - Port for relay service (default: 4000)

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│              Production Deployment Flow                  │
└─────────────────────────────────────────────────────────┘

CODE CHANGES (git push)
  ↓
  GitHub Actions (deploy-static.yml)
  ↓
  SSH into server
  ↓
  /proj/redcudi.org/.prod/astro/
    - git pull
    - npm ci
    - npm run build
  ↓
  /proj/redcudi.org/.prod/astro/dist/ (updated)
  ↓
  nginx serves new static files

CONTENT CHANGES (Strapi publish)
  ↓
  Strapi webhook → https://cms.redcudi.org/webhook
  ↓
  nginx proxy (webhook.conf)
  ↓
  webhook-relay.js (localhost:4000)
    - Validates secret
    - Deduplicates
    - Sends GitHub dispatch
  ↓
  GitHub Actions (deploy-content.yml)
  ↓
  Same deployment as code changes above
```

---

## Security

### `.env.webhook`
- **Location**: `/proj/redcudi.org/.prod/.env.webhook`
- **Permissions**: `600` (read-only by owner)
- **Tracking**: **NOT** committed to git (use `.env.webhook.example` as template)
- **Contents**: GitHub token, relay secret
- **Access**: Only the systemd service reads this file

### GitHub Token (GH_PAT)
- **Scope**: `repo` (full access to private repositories)
- **Rotation**: Regularly (e.g., every 6 months)
- **Storage**: Only in `.env.webhook`, never logged or shared
- **Revocation**: If compromised, go to https://github.com/settings/tokens

### Relay Secret
- **Purpose**: Authenticates Strapi webhook requests
- **Matching**: Must match in:
  - `.env.webhook` (RELAY_SECRET)
  - Strapi webhook config (x-relay-secret header)
  - Any manual curl tests
- **Generation**: `openssl rand -hex 32`

---

## Monitoring & Troubleshooting

### Check All Systems
```bash
# Relay service
sudo systemctl status redcudi-webhook-relay
sudo journalctl -u redcudi-webhook-relay -f

# Docker containers
docker ps
docker logs redcudi-strapi -f

# Nginx
sudo nginx -T
curl -I https://cms.redcudi.org/webhook

# Site files
ls -la /proj/redcudi.org/.prod/astro/dist/index.html
```

### Test Webhook Flow
```bash
# Get secret from env file
RELAY_SECRET=$(grep RELAY_SECRET /proj/redcudi.org/.prod/.env.webhook | cut -d= -f2)

# Test relay directly
curl -X POST http://localhost:4000/webhook \
  -H "x-relay-secret: $RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":{"model":{"singularName":"professional"},"action":"publish"}}'

# Check GitHub Actions triggered
curl -s https://api.github.com/repos/OliAjonjoli/redcudi.org-astro/actions/runs \
  -H "Authorization: Bearer $GH_PAT" | grep status
```

---

## See Also

- `../PRODUCTION_SETUP.md` - Complete server setup guide
- `../GIT_TRACKING_GUIDE.md` - What's tracked in git and why
- `../README.md` - Project overview
