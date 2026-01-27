# Git Repository Structure & Tracking Guide

This document explains what's tracked in git, what's not, and why.

## Repository Map

### Repository 1: redcudi.org-astro (frontend)

**GitHub**: https://github.com/OliAjonjoli/redcudi.org-astro

**Includes**:
- ✅ Astro source code (`src/`, `public/`, `astro.config.mjs`, etc.)
- ✅ Dark mode implementation (ThemeToggle, MainLayout)
- ✅ GitHub Actions workflows (`.github/workflows/`)
- ✅ Package.json and dependencies config
- ✅ Server configuration files (webhook relay, nginx, systemd)
- ❌ `node_modules/` (ignored)
- ❌ `dist/` (generated during build)
- ❌ `.env.webhook` (sensitive credentials)
- ❌ `.env` (sensitive data)

**Branch Strategy**:
- `main` - Production ready (auto-deploys)
- Deploy triggers GitHub Actions → builds → deploys to `/proj/redcudi.org/.prod/astro/dist/`

### Repository 2: redcudi.org-strapi (backend)

**GitHub**: https://github.com/OliAjonjoli/redcudi.org-strapi

**Includes**:
- ✅ Strapi source code (`src/`, `config/`)
- ✅ Content type definitions
- ✅ Dockerfile for containerization
- ❌ `node_modules/`
- ❌ `.env` (database credentials)

**Deployment**:
- Push to `main` → Docker image builds → deploy manually or via CI

## What Should Be Tracked

### In astro-repo (`.prod` folder contents)

The `.prod/` directory contains server-only configuration. These should be tracked in the astro repo under `.prod/` or in this documentation:

1. **webhook-relay.js** ✅ TRACK THIS
   - Node.js relay service code
   - Translates Strapi webhooks → GitHub events
   - Location: `.prod/webhook-relay.js` in git

2. **nginx-webhook.conf** ✅ TRACK THIS
   - Nginx configuration for webhook proxy
   - Location: `.prod/nginx-webhook.conf` in git
   - Deploy to: `/var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf`

3. **redcudi-webhook-relay.service** ✅ TRACK THIS
   - Systemd service file
   - Location: `.prod/redcudi-webhook-relay.service` in git
   - Deploy to: `/etc/systemd/system/redcudi-webhook-relay.service`

4. **docker-compose.yml** ✅ TRACK THIS
   - Strapi + PostgreSQL configuration
   - Location: `.prod/docker-compose.yml` in git

5. **.env.webhook.example** ✅ TRACK THIS
   - Template with placeholder values
   - No sensitive data
   - Location: `.prod/.env.webhook.example` in git

### In root directory

6. **PRODUCTION_SETUP.md** ✅ TRACK THIS
   - Complete setup guide (already created above)
   - Location: `/PRODUCTION_SETUP.md` in git

7. **.gitignore updates** ✅ TRACK THIS
   - Ensure `.env.webhook` is ignored
   - Ensure `.env` is ignored
   - Ensure `dist/` is ignored

## What Should NOT Be Tracked

1. ❌ **.env.webhook** - Contains GitHub token (GH_PAT) and relay secret
2. ❌ **.env** - Contains database passwords
3. ❌ **dist/** - Generated build files
4. ❌ **node_modules/** - Package dependencies
5. ❌ **build artifacts**

## File Structure in Git

```
redcudi.org-astro/
├── .github/
│   └── workflows/
│       ├── deploy-static.yml       (code changes → rebuild)
│       └── deploy-content.yml      (webhook → rebuild)
├── .prod/                          ← NEW: Server-only configs
│   ├── webhook-relay.js
│   ├── nginx-webhook.conf
│   ├── redcudi-webhook-relay.service
│   ├── docker-compose.yml
│   ├── .env.webhook.example
│   └── README.md                   (setup instructions for .prod)
├── src/
├── public/
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── package-lock.json
├── PRODUCTION_SETUP.md             ← NEW: Complete deployment guide
├── .gitignore                      (updated)
└── README.md
```

## .gitignore Updates

Ensure your `.gitignore` has:

```
# Environment variables
.env
.env.local
.env.*.local
.env.webhook

# Build outputs
dist/
build/

# Dependencies
node_modules/
/.cache/
.astro/

# OS
.DS_Store
*.swp
*.swo
*~
.vscode/

# Logs
npm-debug.log*
*.log
```

## Deployment Flow Explained

### When You Push Code Changes to GitHub

```
1. git push origin main (astro repo)
   ↓
2. GitHub Actions runs deploy-static.yml
   ↓
3. SSH into production server
   ↓
4. cd /proj/redcudi.org/.prod/astro
   ↓
5. git fetch && git reset --hard origin/main
   ↓
6. npm ci && npm run build
   ↓
7. Output goes to /proj/redcudi.org/.prod/astro/dist/
   ↓
8. nginx serves updated files from dist/
```

### When You Publish Content in Strapi

```
1. Click "Publish" in https://cms.redcudi.org/admin
   ↓
2. Strapi sends webhook to https://cms.redcudi.org/webhook
   ↓
3. nginx proxy forwards to localhost:4000/webhook
   ↓
4. webhook-relay.js:
   - Validates secret
   - Deduplicates (5-sec window)
   - Sends GitHub repository_dispatch event
   ↓
5. GitHub Actions runs deploy-content.yml
   ↓
6. Same as steps 3-8 above
```

## Next Steps: Getting This Into Git

### 1. Copy Configuration Files to .prod Folder

```bash
mkdir -p /proj/redcudi.org/astro/.prod

# Copy webhook relay
cp /proj/redcudi.org/.prod/webhook-relay.js /proj/redcudi.org/astro/.prod/

# Copy nginx config
cp /var/www/vhosts/system/cms.redcudi.org/conf/webhook.conf \
   /proj/redcudi.org/astro/.prod/nginx-webhook.conf

# Copy systemd service
sudo cp /etc/systemd/system/redcudi-webhook-relay.service \
   /proj/redcudi.org/astro/.prod/

# Copy docker-compose
cp /proj/redcudi.org/.prod/docker-compose.yml \
   /proj/redcudi.org/astro/.prod/

# Create .env example
cat > /proj/redcudi.org/astro/.prod/.env.webhook.example << 'EOF'
# GitHub Personal Access Token (repo scope required)
# Get at: https://github.com/settings/tokens
GH_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Random secret for Strapi webhook authentication
# Generate: openssl rand -hex 32
RELAY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Relay service port (localhost only)
PORT=4000
EOF

# Create .prod README
cat > /proj/redcudi.org/astro/.prod/README.md << 'EOF'
# Production Server Configuration

This folder contains configuration files that run on the production server.

## Files

- **webhook-relay.js** - Node.js service that bridges Strapi webhooks to GitHub
- **nginx-webhook.conf** - Nginx reverse proxy configuration for webhook endpoint
- **redcudi-webhook-relay.service** - Systemd service definition
- **docker-compose.yml** - Strapi + PostgreSQL container configuration
- **.env.webhook.example** - Template for environment variables

## Deployment

See `../PRODUCTION_SETUP.md` for complete setup instructions.

## Important

Never commit `.env.webhook` with actual secrets. Use `.env.webhook.example` as template.
EOF
```

### 2. Update Astro .gitignore

```bash
cd /proj/redcudi.org/astro
```

Make sure `.gitignore` includes:
```
.env
.env.webhook
.env.local
dist/
node_modules/
.astro/
```

### 3. Add Files to Git

```bash
cd /proj/redcudi.org/astro

# Add all new files
git add .prod/
git add PRODUCTION_SETUP.md
git add .gitignore  # if you updated it

# Review changes
git status

# Commit
git commit -m "docs: add production server configuration and setup guide

- Add webhook relay service (webhook-relay.js)
- Add nginx webhook proxy configuration
- Add systemd service definition
- Add docker-compose for Strapi
- Add comprehensive PRODUCTION_SETUP.md guide
- Add .env.webhook.example template (no secrets)
- These files enable complete reproduction of production setup"

# Push
git push origin main
```

### 4. Verify on GitHub

Visit: https://github.com/OliAjonjoli/redcudi.org-astro

You should now see:
- `.prod/` folder with all configuration files
- `PRODUCTION_SETUP.md` in root
- Updated `.gitignore`

## Security Checklist

Before pushing:

- [ ] `.env.webhook` is in `.gitignore` (actual file NOT committed)
- [ ] `.env` is in `.gitignore` (actual file NOT committed)
- [ ] `.env.webhook.example` has NO real secrets (OK to commit)
- [ ] `node_modules/` is in `.gitignore`
- [ ] `dist/` is in `.gitignore`
- [ ] Run `git status` and verify no sensitive files are staged

## When Restoring on New Server

```bash
# 1. Clone repo
git clone https://github.com/OliAjonjoli/redcudi.org-astro.git

# 2. Copy .prod files to production location
cp -r .prod/* /proj/redcudi.org/.prod/

# 3. Create actual .env.webhook from example
cp .prod/.env.webhook.example .prod/.env.webhook
# EDIT and add real secrets!
vim .prod/.env.webhook

# 4. Follow PRODUCTION_SETUP.md for rest of setup
```

## Summary

✅ **What gets committed to git**:
- Source code (Astro, Strapi)
- Configuration templates (.env.example)
- Deployment scripts (workflows, webhook relay, nginx config)
- Documentation (PRODUCTION_SETUP.md)

❌ **What NEVER gets committed**:
- Actual secrets (.env.webhook, .env)
- Generated files (dist/, node_modules/)
- Server-specific data

This way, you can fully reproduce your production setup on a new server with just the git repo + one secret file!
