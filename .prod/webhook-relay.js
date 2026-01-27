#!/usr/bin/env node
// Webhook Relay Service: Translates Strapi webhooks → GitHub repository_dispatch
// 
// Purpose:
//   Accepts POST requests from Strapi webhooks and forwards them as GitHub
//   repository_dispatch events to trigger GitHub Actions workflows.
//
// Environment Variables:
//   GH_PAT - GitHub Personal Access Token (with 'repo' scope)
//   RELAY_SECRET - Secret for authenticating webhook requests
//   PORT - Port to listen on (default: 4000)
//
// Usage:
//   node webhook-relay.js
//
// To run as systemd service:
//   sudo systemctl start redcudi-webhook-relay
//   sudo journalctl -u redcudi-webhook-relay -f  (view logs)

import http from 'http';

const PORT = process.env.PORT || 4000;
const GITHUB_REPO = 'OliAjonjoli/redcudi.org-astro';
const GH_PAT = process.env.GH_PAT;
const RELAY_SECRET = process.env.RELAY_SECRET;

if (!GH_PAT) {
  console.error('GH_PAT is required');
  process.exit(1);
}
if (!RELAY_SECRET) {
  console.error('RELAY_SECRET is required');
  process.exit(1);
}

// Deduplicate webhook calls - track recent dispatches
// If same content type is published twice within 5 seconds, the second is ignored
const recentDispatches = new Map();
const DEDUP_WINDOW = 5000; // 5 seconds

function isRecentlyDispatched(entity) {
  const key = `${entity}`;
  const now = Date.now();
  if (recentDispatches.has(key)) {
    return now - recentDispatches.get(key) < DEDUP_WINDOW;
  }
  recentDispatches.set(key, now);
  return false;
}

const server = http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.method !== 'POST') {
    console.log('  → Method not allowed');
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  if (req.headers['x-relay-secret'] !== RELAY_SECRET) {
    console.log('  → Unauthorized');
    res.statusCode = 401;
    return res.end('Unauthorized');
  }

  console.log('  → Processing webhook');
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const event = parsed.event || {};
      const entity = event.model?.singularName || 'unknown';
      
      // Check for duplicates
      if (isRecentlyDispatched(entity)) {
        console.log(`  ⊘ Duplicate webhook for ${entity} (ignoring)`);
        res.statusCode = 200;
        return res.end('ok');
      }
      
      const payload = {
        event_type: 'strapi-content-published',
        client_payload: {
          entity: entity,
          action: event.action || 'unknown',
          uid: event.model?.uid || 'unknown',
        },
      };

      console.log('  → Sending to GitHub:', payload.event_type);
      const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GH_PAT}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'redcudi-relay',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error('  → GitHub dispatch failed', resp.status, text);
        res.statusCode = 502;
        return res.end('GitHub dispatch failed');
      }

      console.log('  ✓ GitHub dispatch successful');
      res.statusCode = 200;
      res.end('ok');
    } catch (err) {
      console.error('  → Error', err.message);
      res.statusCode = 500;
      res.end('Error');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Relay listening on ${PORT}`);
});
