# StockVala V2 — Deployment Guide

> **Zero hardcoded URLs.** Everything resolves from environment variables or window.location at runtime.
> The same codebase works on any domain, any VPS — just set the right `.env`.

---

## Architecture

```
Browser → Nginx → Frontend (React SPA, built files)
                → Backend (Node.js :5006) ← MySQL + Redis
                                          ← C# Gateway (Windows VPS :8081)
```

---

## Fresh VPS Setup (Linux — Ubuntu/CentOS)

### 1. Clone the repo

```bash
git clone git@github.com:Da-Prakhar/stockvala-v2.git /var/www/stockvala-v2
cd /var/www/stockvala-v2
```

### 2. Backend `.env`

```bash
cp backend/.env.example backend/.env
nano backend/.env   # fill in all values
```

**Key values to set:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL server | `localhost` |
| `DB_NAME` | Database name | `stockvala_prod` |
| `DB_USER` / `DB_PASSWORD` | DB credentials | — |
| `JWT_SECRET` | 64-char hex (generate with `openssl rand -hex 64`) | — |
| `JWT_REFRESH_SECRET` | Different 64-char hex | — |
| `MT5_GATEWAY_URL` | C# Gateway URL | `http://YOUR_WINDOWS_VPS_IP:8081` |
| `MT5_BRIDGE_API_KEY` | Gateway API key (set in gateway appsettings) | — |
| `CORS_ORIGINS` | Allowed frontend origins | `https://app.yourdomain.com` |
| `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP credentials | — |
| `EMAIL_FROM` | Sender address | `noreply@yourdomain.com` |
| `COPY_ENGINE_ENABLED` | Enable copy trading | `true` |

### 3. Install backend dependencies & start

```bash
cd backend
npm install
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name stockvala-backend --interpreter node \
  --node-args="--experimental-vm-modules" \
  -- --env-file=.env

pm2 save
pm2 startup   # follow the printed command to enable on boot
```

### 4. Build frontend

```bash
cd ../frontend

# No .env needed for production — URLs auto-derive from domain
# BUT you can override if needed (e.g. API on non-standard subdomain):
# echo "VITE_API_URL=https://api.yourdomain.com/api" > .env

npm install
npm run build   # outputs to frontend/dist/
```

### 5. Nginx config

```nginx
# /etc/nginx/sites-available/stockvala

# Frontend (User CRM) — served from app.yourdomain.com
server {
    listen 443 ssl;
    server_name app.yourdomain.com;

    root /var/www/stockvala-v2/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}

# Backend API — served from api.yourdomain.com
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;  # for Socket.IO long-polling
    }

    location /uploads/ {
        alias /var/www/stockvala-v2/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name app.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
ln -s /etc/nginx/sites-available/stockvala /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. SSL with Let's Encrypt

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

### 7. Redis

```bash
apt install redis-server
systemctl enable redis-server
systemctl start redis-server
```

---

## Updating (any future deploy)

```bash
cd /var/www/stockvala-v2
git pull origin main

# Backend only changed?
pm2 restart stockvala-backend

# Frontend changed?
cd frontend && npm run build
# (Nginx serves the new dist/ automatically — no restart needed)
```

---

## DNS Setup

For `yourdomain.com`, add these A records pointing to your VPS IP:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `YOUR_VPS_IP` |
| A | `app` | `YOUR_VPS_IP` |
| A | `api` | `YOUR_VPS_IP` |

---

## Domain switching — how URLs auto-resolve

The frontend (`domainConfig.js`) reads `window.location.hostname` at runtime:

| Hostname | API URL | WS URL |
|----------|---------|--------|
| `app.newdomain.com` | `https://api.newdomain.com/api` | `https://api.newdomain.com` |
| `app.brand.co.in` | `https://api.brand.co.in/api` | `https://api.brand.co.in` |
| `localhost` | `$VITE_API_URL` or `localhost:5006` | same |

**No code changes needed when switching domains.** Just:
1. Point DNS to new VPS
2. Set `CORS_ORIGINS` in backend `.env` to new frontend origin
3. Get SSL cert for new domain
4. `pm2 restart stockvala-backend`

---

## Local Development

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env   # fill in DB / Gateway values
npm install
npm run dev            # starts on :5006

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev            # starts on :3001, proxies /api → :5006
```

Open http://localhost:3001

---

## Environment variables reference

See `backend/.env.example` and `frontend/.env.example` for full reference.
