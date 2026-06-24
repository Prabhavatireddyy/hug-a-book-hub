# BookHug Backend (AWS)

This folder is the self-contained Node/Express backend for BookHug. It is built
to run on an **AWS EC2** instance, store all data in **Amazon RDS for MySQL**,
and keep uploaded book/avatar photos in **Amazon S3**.

It also still runs on a laptop for local testing (it falls back to local disk
for photos when S3 isn't configured).

## What it does
- Express API for BookHug
- Google OAuth callback handling
- MySQL-backed users, roles, listings, requests, payments, complaints, notifications
- Cookie session support (cross-site `SameSite=None; Secure` over HTTPS)
- Photo uploads to Amazon S3 (local disk fallback for development)

---

## Architecture on AWS

```
Browser ──HTTPS──> Lovable frontend (hug-a-book-hub.lovable.app)
   │
   └──HTTPS (api.yourdomain.com)──> EC2 (this Node/Express backend)
                                       ├── Amazon RDS for MySQL  (all data)
                                       └── Amazon S3            (photos)
```

---

## Environment variables

Create a `.env` file in the repo root on the EC2 server (or export these before
starting). The server reads them via `dotenv`.

```bash
PC_SERVER_PORT=8788
PUBLIC_BACKEND_URL=https://api.yourdomain.com
FRONTEND_ORIGIN=https://hug-a-book-hub.lovable.app

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback

# Amazon RDS for MySQL
MYSQL_HOST=bookhug-db.xxxxxxxx.ap-south-1.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=your-rds-password
MYSQL_DATABASE=bookhug

# Amazon S3 (photo storage)
AWS_REGION=ap-south-1
S3_BUCKET=bookhug-photos
# Optional: set this if you serve images via CloudFront or a custom URL.
# If omitted, the standard https://<bucket>.s3.<region>.amazonaws.com URL is used.
S3_PUBLIC_BASE_URL=https://bookhug-photos.s3.ap-south-1.amazonaws.com
# AWS credentials are ONLY needed if you do NOT attach an IAM role to EC2.
# Preferred: attach an IAM role with S3 access and leave these empty.
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# Other integrations (unchanged)
GOOGLE_MAPS_API_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAPIDAPI_KEY=...
```

---

## 1. Amazon RDS for MySQL

1. RDS console → **Create database** → MySQL.
2. Choose a size (a `db.t3.micro` free-tier instance is fine to start).
3. Set the master username/password and an initial database name `bookhug`.
4. Place it in the **same VPC** as your EC2 instance.
5. In the RDS **security group**, add an inbound rule allowing **MySQL/Aurora
   (port 3306)** from your **EC2 instance's security group**.
6. Copy the **endpoint** into `MYSQL_HOST`.
7. From the EC2 server, build the schema once:
   ```bash
   npm run backend:setup-db
   ```
   On every start the server also runs idempotent migrations automatically.

---

## 2. Amazon S3 (photos)

1. S3 console → **Create bucket** (e.g. `bookhug-photos`) in your region.
2. To serve images by public URL, either:
   - allow public read on the bucket (turn off "Block all public access" and add
     a bucket policy granting `s3:GetObject` to everyone), **or**
   - put a **CloudFront** distribution in front and set `S3_PUBLIC_BASE_URL` to
     the CloudFront domain (recommended for speed + caching).
3. Add a **CORS** configuration so the browser can load images:
   ```json
   [
     {
       "AllowedOrigins": ["https://hug-a-book-hub.lovable.app"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```
4. Set `AWS_REGION` and `S3_BUCKET` in `.env`.

The backend uploads files server-side using the AWS SDK, so the bucket does not
need public **write** access — only public **read** (or CloudFront) for display.

---

## 3. EC2 instance (the backend)

1. Launch an **Ubuntu** EC2 instance (a `t3.small` is a good start).
2. **IAM role:** create a role with an S3 policy limited to your bucket and
   attach it to the instance. This lets the SDK upload without storing keys:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::bookhug-photos/*"
       }
     ]
   }
   ```
3. **Security group:** allow inbound 22 (SSH, your IP), 80, and 443.
4. Install Node and pull the repo:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   git clone <your-repo-url> bookhug && cd bookhug
   npm install
   ```
5. Create the `.env` file (see above).
6. Run it under **pm2** so it restarts on crash/reboot:
   ```bash
   sudo npm install -g pm2
   pm2 start "npm run backend" --name bookhug-api
   pm2 save
   pm2 startup   # follow the printed command to enable boot startup
   ```

---

## 4. Domain + HTTPS (Route 53 + SSL)

Use **nginx + certbot** on the EC2 box (simplest), or an Application Load
Balancer with an ACM certificate.

### nginx + Let's Encrypt
```bash
sudo apt-get install -y nginx
# /etc/nginx/sites-available/bookhug
server {
  server_name api.yourdomain.com;
  location / {
    proxy_pass http://localhost:8788;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bookhug /etc/nginx/sites-enabled/
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Route 53
1. Create (or use) a hosted zone for `yourdomain.com`.
2. Add an **A record** `api.yourdomain.com` → your EC2 public IP (or an Elastic
   IP, recommended so the address never changes).

### Google OAuth
Update the OAuth client in Google Cloud Console:
- Authorized redirect URI: `https://api.yourdomain.com/api/auth/google/callback`
- Set the same value in `GOOGLE_CALLBACK_URL`.

---

## 5. Connect the frontend

Set the Lovable frontend build variable to the AWS backend:

```
VITE_PC_BACKEND_URL=https://api.yourdomain.com
```

Then the app calls AWS for `/api/auth/google/start`, `/api/me`, `/api/search`,
`/api/notifications`, `/api/requests/:id`, `/api/payments/*`, `/api/complaints`,
and the rest.

---

## Health check
```bash
curl https://api.yourdomain.com/api/health
```

## Local development (no AWS)
You can still run it on a laptop. Without `AWS_REGION`/`S3_BUCKET` set, photos
save to the local `pc-server/uploads/` folder and serve at `/uploads`.

```bash
npm run backend:setup-db
npm run backend
```
