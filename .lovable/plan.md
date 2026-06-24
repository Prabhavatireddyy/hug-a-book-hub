# Move BookHug to AWS (EC2 + RDS MySQL + S3)

Your app is split in two: the Lovable frontend (stays on Lovable) and the `pc-server/` Express + MySQL backend (currently on your laptop). Because the backend is already a self-contained Node app, moving it to AWS is mostly **deployment + configuration**, with **one real code change** (photo uploads → S3). All app behavior, features, and the workflows we already built stay exactly the same.

```text
Browser ──HTTPS──> Lovable frontend (hug-a-book-hub.lovable.app)
   │
   └──HTTPS (api.yourdomain.com)──> EC2 (Node/Express backend)
                                       ├── Amazon RDS for MySQL  (all data)
                                       └── Amazon S3            (book/avatar photos)
```

## What changes in the code

### 1. Photo uploads → Amazon S3 (the main change)
Today multer writes images to a local `uploads/` folder and serves them at `/uploads`. On AWS that disk is temporary and would lose photos when the server is replaced.

- Switch multer to in-memory storage and upload the file buffer to S3 using the AWS SDK.
- `photoUrlFor()` returns the public S3 URL (or CloudFront URL) instead of `/uploads/...`. Since `photo_path`/`avatar_url` already store a full URL, existing read code stays unchanged.
- Keep the `/uploads` static route only as a harmless fallback (can be removed later).

### 2. Config additions (`pc-server/src/lib/config.mjs`)
Add an `aws` block read from env: `AWS_REGION`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` (bucket or CloudFront URL), plus `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or rely on an EC2 IAM role — preferred, no keys in env). Add an `isS3Configured()` helper.

### 3. Database → Amazon RDS for MySQL (no code change)
The code already uses `mysql2` with `MYSQL_*` env vars. Moving to RDS is just pointing those vars at the RDS endpoint. The existing `npm run backend:setup-db` builds the schema, and your in-app idempotent migrations still run on startup.

### 4. Frontend (one env var)
Point `VITE_PC_BACKEND_URL` at the new AWS backend domain (e.g. `https://api.yourdomain.com`). Cookies already use `SameSite=None; Secure` over HTTPS and CORS already honors `FRONTEND_ORIGIN`, so cross-site login keeps working. No component changes.

### 5. Optional but recommended: DB-backed sessions
Sessions are currently in-memory, so an EC2 restart logs everyone out. Optionally add a small `sessions` table and back `session-store.mjs` with it for persistence. I'll only do this if you want it.

## What you set up in AWS (I'll give exact steps)

1. **RDS MySQL** — create a MySQL instance, note the endpoint/user/password/db name, allow the EC2 security group to connect on port 3306.
2. **S3 bucket** — create a bucket for photos, set public-read (or CloudFront) for image URLs, and add CORS so the browser can load images.
3. **EC2 instance** — Ubuntu, install Node, pull the repo, set env vars, run with **pm2** (auto-restart) or systemd. Attach an **IAM role** granting S3 access (so no AWS keys live in env).
4. **Domain + SSL** — Route 53 hosted zone, an **ACM certificate**, and either an **Application Load Balancer** or **nginx + certbot** in front of the Node app, so `api.yourdomain.com` serves HTTPS. Update Google OAuth callback to the new HTTPS URL.

## Environment variables on EC2 (`.env`)
```text
PC_SERVER_PORT=8788
PUBLIC_BACKEND_URL=https://api.yourdomain.com
FRONTEND_ORIGIN=https://hug-a-book-hub.lovable.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
MYSQL_HOST=<rds-endpoint>
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=bookhug
AWS_REGION=ap-south-1
S3_BUCKET=bookhug-photos
S3_PUBLIC_BASE_URL=https://bookhug-photos.s3.ap-south-1.amazonaws.com
# AWS keys only if NOT using an EC2 IAM role:
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
GOOGLE_MAPS_API_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAPIDAPI_KEY=...
```

## Deliverables in this build
- Add `@aws-sdk/client-s3` to `pc-server`.
- Rewrite the upload path in `pc-server/src/server.mjs` to push to S3 and return S3 URLs.
- Extend `pc-server/src/lib/config.mjs` with the AWS/S3 block + helper.
- Update `pc-server/README.md` with full AWS deployment steps (RDS, S3, EC2, domain/SSL, IAM).
- Update `.lovable/plan.md` to record the AWS hosting decision.
- (Optional) DB-backed session store if you confirm you want it.

## Notes
- Everything else we planned (Google geocoding, Razorpay ₹5 connect, notifications, contacts, live prices, help/complaint/payments pages, SEO) is **unchanged** — only the hosting moves.
- No Lovable Cloud/Supabase is introduced; your backend stays self-managed, now on AWS.
- I can't click around your AWS console, so the AWS resource creation (RDS/S3/EC2/Route 53) is done by you following the step-by-step README; I handle all the code and config.
