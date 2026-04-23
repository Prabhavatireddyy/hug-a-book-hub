# BookHug PC Server

This folder contains the self-hosted backend that runs on your PC and connects to MySQL.

## What it does
- Express API for BookHug
- Google OAuth callback handling
- MySQL-backed users, roles, listings, requests, and notifications
- Cookie session support
- Static `/uploads` hosting for book photos

## Required environment variables
Set these in your PC terminal before starting the server:

- `PC_SERVER_PORT=8788`
- `PUBLIC_BACKEND_URL=https://your-cloudflare-tunnel-url.trycloudflare.com`
- `FRONTEND_ORIGIN=https://hug-a-book-hub.lovable.app`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_CALLBACK_URL=https://your-cloudflare-tunnel-url.trycloudflare.com/api/auth/google/callback`
- `MYSQL_HOST=127.0.0.1`
- `MYSQL_PORT=3306`
- `MYSQL_USER=root`
- `MYSQL_PASSWORD=your-password`
- `MYSQL_DATABASE=bookhug`

## Run on your PC
From the repo root:

```bash
npm run backend:setup-db
npm run backend
```

## Health check
After starting the server:

```bash
curl http://localhost:8788/api/health
```

## Google OAuth setup
1. Create an OAuth client in Google Cloud Console.
2. Add this callback URL:
   - `https://your-cloudflare-tunnel-url.trycloudflare.com/api/auth/google/callback`
3. Add these allowed origins:
   - your Cloudflare Tunnel URL
   - your published frontend URL if needed for testing

## Cloudflare Tunnel
Recommended because Google OAuth needs a public HTTPS callback URL.

Typical local command on your PC:

```bash
cloudflared tunnel --url http://localhost:8788
```

Copy the HTTPS URL that Cloudflare gives you and use it for:
- `PUBLIC_BACKEND_URL`
- `GOOGLE_CALLBACK_URL`

## Frontend connection
Set the frontend build variable to your PC server URL:

- `VITE_PC_BACKEND_URL=https://your-cloudflare-tunnel-url.trycloudflare.com`

Then the TanStack app will call your PC-hosted backend for:
- `/api/auth/google/start`
- `/api/me`
- `/api/onboarding`
- `/api/search`
- `/api/users/:petName`
- `/api/notifications`
