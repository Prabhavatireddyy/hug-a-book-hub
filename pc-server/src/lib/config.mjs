import { resolve } from "node:path";

const backendPort = Number(process.env.PC_SERVER_PORT ?? process.env.PORT ?? 8788);
const publicBaseUrl = process.env.PUBLIC_BACKEND_URL?.trim() || `http://localhost:${backendPort}`;
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim() || "";
const uploadsDir = resolve(process.cwd(), "pc-server", "uploads");

export const serverConfig = {
  port: Number.isNaN(backendPort) ? 8788 : backendPort,
  publicBaseUrl,
  frontendOrigin,
  sessionCookieName: "bookhug_session",
  uploadsDir,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL?.trim() ||
      `${publicBaseUrl.replace(/\/$/, "")}/api/auth/google/callback`,
  },
  mysql: {
    host: process.env.MYSQL_HOST?.trim() || "",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER?.trim() || "",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE?.trim() || "",
  },
  // Google Maps Geocoding (server-side address verification only).
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() || "",
  },
  // Razorpay for the ₹5 "unlock contact" connection fee.
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID?.trim() || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || "",
  },
  // RapidAPI key for live Amazon/online book prices (optional; falls back to search links).
  rapidApiKey: process.env.RAPIDAPI_KEY?.trim() || "",
  // Amount charged to unlock a contact, in paise (₹5 = 500 paise).
  connectionFeePaise: Number(process.env.CONNECTION_FEE_PAISE ?? 500),
  // Amazon S3 for book/avatar photo uploads (AWS hosting).
  // On EC2, prefer an attached IAM role over access keys (leave the keys empty).
  aws: {
    region: process.env.AWS_REGION?.trim() || "",
    s3Bucket: process.env.S3_BUCKET?.trim() || "",
    // Public base URL for objects (S3 REST URL or a CloudFront domain).
    // Falls back to the standard virtual-hosted S3 URL when not set.
    s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || "",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || "",
  },
};

export function isGoogleConfigured() {
  return Boolean(
    serverConfig.google.clientId &&
      serverConfig.google.clientSecret &&
      serverConfig.google.callbackUrl,
  );
}

export function isGoogleMapsConfigured() {
  return Boolean(serverConfig.googleMaps.apiKey);
}

export function isRazorpayConfigured() {
  return Boolean(serverConfig.razorpay.keyId && serverConfig.razorpay.keySecret);
}

export function isMysqlConfigured() {
  return Boolean(
    serverConfig.mysql.host &&
      serverConfig.mysql.user &&
      serverConfig.mysql.database,
  );
}
