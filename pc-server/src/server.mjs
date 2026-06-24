import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import { mkdirSync, writeFile } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID, createHmac } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { demoNotifications, demoProfile, demoSearchResponse } from "./lib/demo-data.mjs";
import { getPool, hasDatabase, pingDatabase, query } from "./lib/db.mjs";
import {
  isGoogleConfigured,
  isGoogleMapsConfigured,
  isRazorpayConfigured,
  isS3Configured,
  serverConfig,
} from "./lib/config.mjs";
import { createSession, deleteSession, getSession, updateSessionUser } from "./lib/session-store.mjs";

mkdirSync(serverConfig.uploadsDir, { recursive: true });

// Photos are buffered in memory, then pushed to Amazon S3 (AWS hosting).
// If S3 isn't configured (e.g. local development) we fall back to disk so
// nothing breaks while testing on a laptop.
const imageFileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};

const uploadBookPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single("photo");

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single("avatar");

// Lazily created S3 client so the module also runs without AWS configured.
let s3Client = null;
async function getS3Client() {
  if (s3Client) return s3Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: serverConfig.aws.region,
    // When access keys are omitted the SDK uses the EC2 instance IAM role.
    ...(serverConfig.aws.accessKeyId && serverConfig.aws.secretAccessKey
      ? {
          credentials: {
            accessKeyId: serverConfig.aws.accessKeyId,
            secretAccessKey: serverConfig.aws.secretAccessKey,
          },
        }
      : {}),
  });
  return s3Client;
}

function s3PublicUrlFor(key) {
  const base =
    serverConfig.aws.s3PublicBaseUrl ||
    `https://${serverConfig.aws.s3Bucket}.s3.${serverConfig.aws.region}.amazonaws.com`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

function localUrlFor(filename) {
  return `${serverConfig.publicBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;
}

// Saves a multer in-memory file to S3 (preferred) or local disk (fallback),
// returning the public URL stored in the database.
async function storeUploadedImage(file, prefix) {
  if (!file) return null;
  const ext = (extname(file.originalname || "") || ".jpg").toLowerCase();
  const key = `${prefix}/${randomUUID()}${ext}`;

  if (isS3Configured()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: serverConfig.aws.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return s3PublicUrlFor(key);
  }

  // Local fallback for development without AWS.
  const filename = key.replace("/", "_");
  await new Promise((resolve, reject) =>
    writeFile(join(serverConfig.uploadsDir, filename), file.buffer, (err) =>
      err ? reject(err) : resolve(),
    ),
  );
  return localUrlFor(filename);
}


// Per-role book listing limits (kept small while the database is young).
const LISTING_LIMITS = { reader: 20, seller: 100, library: 1000, admin: 5000 };
function listingLimitFor(role) {
  return LISTING_LIMITS[role] ?? LISTING_LIMITS.reader;
}

// Distance (km) between two GPS points using the haversine formula.
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Address match threshold (km). A typed address within this range of the
// device GPS location counts as "verified".
const ADDRESS_MATCH_KM = 20;

// Geocode a free-text address via the Google Maps Geocoding API (accurate).
async function geocodeAddress(address) {
  if (!isGoogleMapsConfigured()) {
    throw new Error(
      "Google Maps is not set up yet. Add GOOGLE_MAPS_API_KEY to pc-server/.env and restart the server.",
    );
  }
  const params = new URLSearchParams({ address, key: serverConfig.googleMaps.apiKey });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Could not reach the Google address lookup service.");
  }
  const data = await response.json();
  if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
    throw new Error(
      data.error_message || "Google rejected the address lookup. Check that your GOOGLE_MAPS_API_KEY is valid.",
    );
  }
  if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }
  const top = data.results[0];
  return {
    latitude: Number(top.geometry?.location?.lat),
    longitude: Number(top.geometry?.location?.lng),
    label: String(top.formatted_address ?? ""),
  };
}

// --- Live online prices (Amazon etc.) with graceful fallback to search links ---
const priceCache = new Map(); // title -> { at, data }
const PRICE_TTL_MS = 1000 * 60 * 60; // 1 hour

function fallbackPrices(title) {
  const q = encodeURIComponent(title || "books");
  return [
    { store: "Amazon", price: null, url: `https://www.amazon.in/s?k=${q}`, image: null },
    { store: "Flipkart", price: null, url: `https://www.flipkart.com/search?q=${q}`, image: null },
    { store: "Google Books", price: null, url: `https://www.google.com/search?tbm=bks&q=${q}`, image: null },
  ];
}

async function fetchOnlinePrices(title) {
  const key = (title || "").trim().toLowerCase();
  if (!key) return fallbackPrices(title);

  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) {
    return cached.data;
  }

  if (!serverConfig.rapidApiKey) {
    return fallbackPrices(title);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const url = `https://real-time-amazon-data.p.rapidapi.com/search?query=${encodeURIComponent(
      title,
    )}&country=IN&category_id=283155`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": serverConfig.rapidApiKey,
        "X-RapidAPI-Host": "real-time-amazon-data.p.rapidapi.com",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`Price API responded ${response.status}`);
    const data = await response.json();
    const products = Array.isArray(data?.data?.products) ? data.data.products : [];
    const mapped = products.slice(0, 3).map((p) => {
      const raw = String(p.product_price ?? "").replace(/[^\d.]/g, "");
      const price = raw ? Math.round(Number(raw)) : null;
      return {
        store: "Amazon",
        price: Number.isFinite(price) ? price : null,
        url: p.product_url || `https://www.amazon.in/s?k=${encodeURIComponent(title)}`,
        image: p.product_photo || null,
      };
    });
    const result = mapped.length ? mapped : fallbackPrices(title);
    priceCache.set(key, { at: Date.now(), data: result });
    return result;
  } catch (error) {
    console.error("Live price lookup failed, using fallback links", error.message);
    return fallbackPrices(title);
  }
}

// Razorpay REST helpers (no SDK needed; uses Basic auth + fetch).
function razorpayAuthHeader() {
  const token = Buffer.from(
    `${serverConfig.razorpay.keyId}:${serverConfig.razorpay.keySecret}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function createRazorpayOrder({ amountPaise, receipt }) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, payment_capture: 1 }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || "Could not create the Razorpay order.");
  }
  return data;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const expected = createHmac("sha256", serverConfig.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

// Returns the public contact details for a user (mobile + whatsapp).
async function fetchUserContact(userId) {
  const rows = await query(
    `SELECT pet_name AS petName, mobile_number AS mobile, whatsapp_same AS whatsappSame,
            whatsapp_number AS whatsappNumber, email
     FROM users WHERE id = :userId LIMIT 1`,
    { userId },
  );
  const row = rows[0];
  if (!row) return null;
  const whatsapp = Number(row.whatsappSame) === 1 ? row.mobile : row.whatsappNumber;
  return {
    petName: row.petName,
    mobile: row.mobile ?? null,
    whatsapp: whatsapp ?? null,
  };
}

// Add or upgrade columns for existing installs (idempotent).
async function ensureSchemaUpgrades() {
  if (!hasDatabase()) return;
  const pool = await getPool();
  const dbName = serverConfig.mysql.database;
  const columnExists = async (table, column) => {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, column],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  };
  const addColumn = async (table, column, definition) => {
    if (!(await columnExists(table, column))) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Migration: added ${table}.${column}`);
    }
  };

  await addColumn("users", "bio", "TEXT NULL");
  await addColumn("users", "address", "TEXT NULL");
  await addColumn("users", "address_verified", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumn("users", "mobile_number", "VARCHAR(20) NULL");
  await addColumn("users", "whatsapp_same", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumn("users", "whatsapp_number", "VARCHAR(20) NULL");
  await addColumn("book_listings", "exchange_address", "TEXT NULL");
  await addColumn("notifications", "request_id", "BIGINT UNSIGNED NULL");
  await addColumn("requests", "contact_unlocked", "TINYINT(1) NOT NULL DEFAULT 0");

  // Create newer tables on existing installs.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      payer_id BIGINT UNSIGNED NOT NULL,
      request_id BIGINT UNSIGNED NOT NULL,
      amount_paise INT UNSIGNED NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      razorpay_order_id VARCHAR(255) NULL,
      razorpay_payment_id VARCHAR(255) NULL,
      status ENUM('created', 'paid', 'failed') NOT NULL DEFAULT 'created',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_payer (payer_id),
      INDEX idx_payments_order (razorpay_order_id),
      CONSTRAINT fk_payments_payer FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_payments_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      reporter_id BIGINT UNSIGNED NOT NULL,
      target_pet_name VARCHAR(80) NULL,
      category VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('open', 'reviewing', 'resolved') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_complaints_reporter (reporter_id),
      CONSTRAINT fk_complaints_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}




const app = express();
const googleClient = isGoogleConfigured()
  ? new OAuth2Client(
      serverConfig.google.clientId,
      serverConfig.google.clientSecret,
      serverConfig.google.callbackUrl,
    )
  : null;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (!serverConfig.frontendOrigin || origin === serverConfig.frontendOrigin) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(serverConfig.uploadsDir));

function cookieOptions() {
  const isHttps = serverConfig.publicBaseUrl.startsWith("https://");
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  };
}

function getAuthedUser(req) {
  const sessionId = req.cookies?.[serverConfig.sessionCookieName];
  const session = getSession(sessionId);
  return session ?? null;
}

function parseState(input) {
  if (!input) return { redirectTo: "/onboarding" };
  try {
    return JSON.parse(Buffer.from(input, "base64url").toString("utf8"));
  } catch {
    return { redirectTo: "/onboarding" };
  }
}

async function upsertGoogleUser(profile) {
  if (!hasDatabase()) {
    return {
      id: profile.googleId,
      email: profile.email,
      petName: profile.email.split("@")[0],
      avatarUrl: profile.avatarUrl,
      city: null,
      role: null,
      storeName: null,
      libraryName: null,
      libraryStatus: null,
    };
  }

  const pool = await getPool();
  const [existingRows] = await pool.execute(
    `SELECT id, email, pet_name AS petName, avatar_url AS avatarUrl, location_city AS city
     FROM users
     WHERE google_id = ? OR email = ?
     LIMIT 1`,
    [profile.googleId, profile.email],
  );

  const existing = Array.isArray(existingRows) ? existingRows[0] : null;

  if (existing) {
    await pool.execute(
      `UPDATE users
       SET google_id = ?, email = ?, avatar_url = ?
       WHERE id = ?`,
      [profile.googleId, profile.email, profile.avatarUrl, existing.id],
    );

    const roleRows = await query(
      `SELECT role FROM user_roles WHERE user_id = :userId ORDER BY role ASC LIMIT 1`,
      { userId: existing.id },
    );

    return {
      ...existing,
      role: roleRows[0]?.role ?? null,
      storeName: null,
      libraryName: null,
      libraryStatus: null,
    };
  }

  const [insertResult] = await pool.execute(
    `INSERT INTO users (google_id, email, pet_name, avatar_url)
     VALUES (?, ?, ?, ?)`,
    [profile.googleId, profile.email, profile.email.split("@")[0], profile.avatarUrl],
  );

  return {
    id: insertResult.insertId,
    email: profile.email,
    petName: profile.email.split("@")[0],
    avatarUrl: profile.avatarUrl,
    city: null,
    role: null,
    storeName: null,
    libraryName: null,
    libraryStatus: null,
  };
}

async function fetchRoleDetails(userId) {
  if (!hasDatabase()) return {};

  const [roleRows, sellerRows, libraryRows] = await Promise.all([
    query(`SELECT role FROM user_roles WHERE user_id = :userId ORDER BY id DESC LIMIT 1`, { userId }),
    query(`SELECT store_name AS storeName, city FROM seller_profiles WHERE user_id = :userId LIMIT 1`, {
      userId,
    }),
    query(
      `SELECT library_name AS libraryName, city, verification_status AS libraryStatus
       FROM library_profiles WHERE user_id = :userId LIMIT 1`,
      { userId },
    ),
  ]);

  return {
    role: roleRows[0]?.role ?? null,
    storeName: sellerRows[0]?.storeName ?? null,
    libraryName: libraryRows[0]?.libraryName ?? null,
    libraryStatus: libraryRows[0]?.libraryStatus ?? null,
    city: sellerRows[0]?.city ?? libraryRows[0]?.city ?? null,
  };
}

async function fetchProfileExtras(userId) {
  if (!hasDatabase()) {
    return {
      bio: null,
      address: null,
      addressVerified: false,
      listingCount: 0,
      mobileNumber: null,
      whatsappSame: true,
      whatsappNumber: null,
    };
  }

  const [userRows, countRows] = await Promise.all([
    query(
      `SELECT bio, address, address_verified AS addressVerified, avatar_url AS avatarUrl,
              latitude, longitude, mobile_number AS mobileNumber,
              whatsapp_same AS whatsappSame, whatsapp_number AS whatsappNumber
       FROM users WHERE id = :userId LIMIT 1`,
      { userId },
    ),
    query(`SELECT COUNT(*) AS listingCount FROM book_listings WHERE owner_id = :userId`, { userId }),
  ]);

  const row = userRows[0] ?? {};
  return {
    bio: row.bio ?? null,
    address: row.address ?? null,
    addressVerified: Boolean(row.addressVerified),
    avatarUrl: row.avatarUrl ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    mobileNumber: row.mobileNumber ?? null,
    whatsappSame: row.whatsappSame != null ? Boolean(row.whatsappSame) : true,
    whatsappNumber: row.whatsappNumber ?? null,
    listingCount: Number(countRows[0]?.listingCount ?? 0),
  };
}

// Add a one-time reminder to verify location if the address isn't verified yet.
async function maybeNudgeAddressVerification(userId) {
  if (!hasDatabase()) return;
  try {
    const rows = await query(
      `SELECT address_verified AS addressVerified FROM users WHERE id = :userId LIMIT 1`,
      { userId },
    );
    if (Boolean(rows[0]?.addressVerified)) return;

    const existing = await query(
      `SELECT id FROM notifications WHERE user_id = :userId AND type = 'verify_location' LIMIT 1`,
      { userId },
    );
    if (existing[0]) return;

    await query(
      `INSERT INTO notifications (user_id, type, title, body, is_read)
       VALUES (:userId, 'verify_location', :title, :body, false)`,
      {
        userId,
        title: "Verify your location",
        body: "Open My Profile, then Save & confirm your address. If it's wrong, search will show books, readers, libraries and sellers near the address you typed instead of where you really are.",
      },
    );
  } catch (error) {
    console.error("Could not create location nudge", error);
  }
}

app.get("/api/health", async (_req, res) => {
  const dbHealthy = await pingDatabase();
  res.json({
    ok: true,
    service: "BookHug PC server",
    database: hasDatabase() ? (dbHealthy ? "connected" : "configured_but_unreachable") : "not_configured",
    googleAuth: isGoogleConfigured() ? "configured" : "not_configured",
    publicBaseUrl: serverConfig.publicBaseUrl,
    frontendOrigin: serverConfig.frontendOrigin || null,
  });
});

app.post("/api/auth/google/start", async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({
      error: "Google OAuth is not configured yet on the PC server.",
    });
  }

  const redirectTo = typeof req.body?.redirectTo === "string" ? req.body.redirectTo : "/onboarding";
  const state = Buffer.from(JSON.stringify({ redirectTo }), "utf8").toString("base64url");
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
  });

  return res.json({ url });
});

app.get("/api/auth/google/callback", async (req, res) => {
  if (!googleClient) {
    return res.status(503).send("Google OAuth is not configured yet.");
  }

  try {
    const code = String(req.query.code ?? "");
    const state = parseState(String(req.query.state ?? ""));
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: serverConfig.google.clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      return res.status(400).send("Google did not return a valid user profile.");
    }

    const user = await upsertGoogleUser({
      googleId: payload.sub,
      email: payload.email,
      avatarUrl: payload.picture ?? "",
    });
    const roleDetails = await fetchRoleDetails(user.id);
    const sessionUser = { ...user, ...roleDetails };
    const sessionId = createSession(sessionUser);

    await maybeNudgeAddressVerification(user.id);

    res.cookie(serverConfig.sessionCookieName, sessionId, cookieOptions());
    return res.redirect(new URL(state.redirectTo || "/onboarding", serverConfig.frontendOrigin || "http://localhost:5173").toString());
  } catch (error) {
    console.error("Google callback failed", error);
    return res.status(500).send("Google login failed. Check your OAuth callback URL and secrets.");
  }
});

app.get("/api/me", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Not signed in" });
  }

  if (!session.user?.id) {
    return res.json({ user: session.user });
  }

  const [roleDetails, extras] = await Promise.all([
    fetchRoleDetails(session.user.id),
    fetchProfileExtras(session.user.id),
  ]);
  const role = roleDetails.role ?? session.user.role ?? "reader";
  return res.json({
    user: {
      ...session.user,
      ...roleDetails,
      ...extras,
      listingLimit: listingLimitFor(role),
    },
  });
});

app.post("/api/me/verify-location", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);

  if (!address) {
    return res.status(400).json({ error: "Please enter your address first." });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: "We could not read your current location. Please allow location access." });
  }

  let geocoded;
  try {
    geocoded = await geocodeAddress(address);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Address lookup failed." });
  }

  if (!geocoded) {
    return res.json({
      verified: false,
      distanceKm: null,
      geocodedLabel: null,
      message: "We couldn't find that address. Try adding your city and area.",
    });
  }

  const distanceKm = haversineKm(latitude, longitude, geocoded.latitude, geocoded.longitude);
  const verified = distanceKm <= ADDRESS_MATCH_KM;

  return res.json({
    verified,
    distanceKm: Number(distanceKm.toFixed(1)),
    geocodedLabel: geocoded.label,
    thresholdKm: ADDRESS_MATCH_KM,
    message: verified
      ? "Your address matches your current location."
      : `Your address is about ${distanceKm.toFixed(0)} km from where you are now. You can still save it, but nearby results will use this address.`,
  });
});

app.patch("/api/me/profile", (req, res) => {
  uploadAvatar(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || "Could not upload the avatar." });
    }

    const session = getAuthedUser(req);
    if (!session) {
      return res.status(401).json({ error: "Sign in first" });
    }
    if (!hasDatabase()) {
      return res.status(503).json({ error: "Database is not connected on the PC server yet." });
    }

    const bio = typeof req.body?.bio === "string" ? req.body.bio.trim().slice(0, 600) : null;
    const address = typeof req.body?.address === "string" ? req.body.address.trim().slice(0, 500) : null;
    const rawLat = Number(req.body?.latitude);
    const rawLng = Number(req.body?.longitude);
    const latitude = Number.isFinite(rawLat) ? rawLat : null;
    const longitude = Number.isFinite(rawLng) ? rawLng : null;
    const addressVerified = String(req.body?.addressVerified) === "true" ? 1 : 0;
    const avatarUrl = req.file ? await storeUploadedImage(req.file, "avatars") : null;

    const cleanPhone = (value) =>
      typeof value === "string" ? value.replace(/[^\d+]/g, "").slice(0, 20) : "";
    const mobileNumber = cleanPhone(req.body?.mobileNumber) || null;
    const whatsappSame = String(req.body?.whatsappSame) === "false" ? 0 : 1;
    const whatsappNumber = whatsappSame ? null : cleanPhone(req.body?.whatsappNumber) || null;

    await query(
      `UPDATE users
       SET bio = :bio,
           address = :address,
           latitude = :latitude,
           longitude = :longitude,
           address_verified = :addressVerified,
           mobile_number = :mobileNumber,
           whatsapp_same = :whatsappSame,
           whatsapp_number = :whatsappNumber
           ${avatarUrl ? ", avatar_url = :avatarUrl" : ""}
       WHERE id = :userId`,
      {
        bio,
        address,
        latitude,
        longitude,
        addressVerified,
        mobileNumber,
        whatsappSame,
        whatsappNumber,
        userId: session.user.id,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    );

    const [roleDetails, extras] = await Promise.all([
      fetchRoleDetails(session.user.id),
      fetchProfileExtras(session.user.id),
    ]);
    const role = roleDetails.role ?? session.user.role ?? "reader";
    const updatedUser = {
      ...session.user,
      ...roleDetails,
      ...extras,
      avatarUrl: avatarUrl ?? extras.avatarUrl ?? session.user.avatarUrl,
      listingLimit: listingLimitFor(role),
    };

    const sessionId = req.cookies?.[serverConfig.sessionCookieName];
    updateSessionUser(sessionId, updatedUser);

    return res.json({ user: updatedUser });
  });
});


app.post("/api/logout", (req, res) => {
  const sessionId = req.cookies?.[serverConfig.sessionCookieName];
  deleteSession(sessionId);
  res.clearCookie(serverConfig.sessionCookieName, cookieOptions());
  return res.json({ ok: true });
});

app.post("/api/onboarding", async (req, res) => {
  const sessionId = req.cookies?.[serverConfig.sessionCookieName];
  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  const role = typeof req.body?.role === "string" ? req.body.role : "reader";
  const petName = typeof req.body?.petName === "string" ? req.body.petName.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : null;
  const storeName = typeof req.body?.storeName === "string" ? req.body.storeName.trim() : null;
  const libraryName = typeof req.body?.libraryName === "string" ? req.body.libraryName.trim() : null;

  if (!petName) {
    return res.status(400).json({ error: "Pet name is required" });
  }

  let user = {
    ...session.user,
    petName,
    city,
    role,
    storeName: role === "seller" ? storeName : null,
    libraryName: role === "library" ? libraryName : null,
    libraryStatus: role === "library" ? "pending" : null,
  };

  if (hasDatabase()) {
    const pool = await getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE users SET pet_name = ?, location_city = ? WHERE id = ?`,
        [petName, city, session.user.id],
      );
      await connection.execute(`DELETE FROM user_roles WHERE user_id = ?`, [session.user.id]);
      await connection.execute(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`, [session.user.id, role]);

      if (role === "seller") {
        await connection.execute(`DELETE FROM seller_profiles WHERE user_id = ?`, [session.user.id]);
        await connection.execute(`INSERT INTO seller_profiles (user_id, store_name, city) VALUES (?, ?, ?)`, [
          session.user.id,
          storeName,
          city,
        ]);
        await connection.execute(`DELETE FROM library_profiles WHERE user_id = ?`, [session.user.id]);
      }

      if (role === "library") {
        await connection.execute(`DELETE FROM library_profiles WHERE user_id = ?`, [session.user.id]);
        await connection.execute(
          `INSERT INTO library_profiles (user_id, library_name, city, verification_status) VALUES (?, ?, ?, 'pending')`,
          [session.user.id, libraryName, city],
        );
        await connection.execute(`DELETE FROM seller_profiles WHERE user_id = ?`, [session.user.id]);
      }

      if (role === "reader") {
        await connection.execute(`DELETE FROM seller_profiles WHERE user_id = ?`, [session.user.id]);
        await connection.execute(`DELETE FROM library_profiles WHERE user_id = ?`, [session.user.id]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  updateSessionUser(sessionId, user);
  return res.json({ user });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const mode = String(req.query.mode ?? "all").trim();

  if (!hasDatabase()) {
    return res.json({ ...demoSearchResponse, query: q || demoSearchResponse.query, mode });
  }

  const rows = await query(
    `SELECT
      b.id,
      b.title,
      b.author,
      b.listing_type AS listingType,
      b.price,
      b.photo_path AS coverUrl,
      u.pet_name AS ownerPetName,
      u.location_city AS city,
      COALESCE(r.role, 'reader') AS ownerRole
     FROM book_listings b
     INNER JOIN users u ON u.id = b.owner_id
     LEFT JOIN user_roles r ON r.user_id = u.id
     WHERE (:q = '' OR b.title LIKE CONCAT('%', :q, '%') OR b.author LIKE CONCAT('%', :q, '%'))
     ORDER BY b.created_at DESC
     LIMIT 24`,
    { q },
  );

  const mapped = rows.map((row, index) => ({
    ...row,
    distanceKm: Number((index + 1) * 1.9).toFixed(1),
    coverUrl: row.coverUrl || "https://covers.openlibrary.org/b/isbn/0547928227-L.jpg",
  }));

  const onlinePrices = await fetchOnlinePrices(q || "books");

  return res.json({
    query: q,
    mode,
    nearby: mapped.filter((row) => row.ownerRole === "reader"),
    sellers: mapped.filter((row) => row.ownerRole === "seller"),
    libraries: mapped.filter((row) => row.ownerRole === "library"),
    onlinePrices,
  });
});

app.get("/api/users/:petName", async (req, res) => {
  const petName = String(req.params.petName ?? "");

  if (!hasDatabase()) {
    return res.json({ ...demoProfile, petName });
  }

  const users = await query(
    `SELECT id, pet_name AS petName, email, avatar_url AS avatarUrl, location_city AS city,
            bio, address
     FROM users
     WHERE pet_name = :petName
     LIMIT 1`,
    { petName },
  );

  if (!users[0]) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = users[0];
  const [roleDetails, listings] = await Promise.all([
    fetchRoleDetails(user.id),
    query(
      `SELECT id, title, author, listing_type AS listingType, price, status,
              photo_path AS coverUrl, exchange_address AS exchangeAddress
       FROM book_listings
       WHERE owner_id = :ownerId
       ORDER BY created_at DESC`,
      { ownerId: user.id },
    ),
  ]);

  return res.json({ ...user, ...roleDetails, listings });
});

app.get("/api/notifications", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  if (!hasDatabase()) {
    return res.json({ notifications: demoNotifications });
  }

  const notifications = await query(
    `SELECT n.id, n.type, n.title, n.body, n.is_read AS isRead, n.created_at AS createdAt,
            n.request_id AS requestId, r.status AS requestStatus,
            r.contact_unlocked AS contactUnlocked, r.request_type AS requestType,
            COALESCE(ro.role, 'reader') AS otherRole
     FROM notifications n
     LEFT JOIN requests r ON r.id = n.request_id
     LEFT JOIN user_roles ro ON ro.user_id = r.to_user_id
     WHERE n.user_id = :userId
     ORDER BY n.created_at DESC
     LIMIT 30`,
    { userId: session.user.id },
  );

  return res.json({
    notifications: notifications.map((n) => ({
      ...n,
      isRead: Boolean(n.isRead),
      contactUnlocked: Boolean(n.contactUnlocked),
    })),
  });
});

app.post("/api/notifications/read-all", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.json({ ok: true });
  }
  await query(`UPDATE notifications SET is_read = true WHERE user_id = :userId`, {
    userId: session.user.id,
  });
  return res.json({ ok: true });
});

app.post("/api/requests/:type", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  const type = String(req.params.type ?? "buy");
  if (!["buy", "exchange"].includes(type)) {
    return res.status(400).json({ error: "Invalid request type" });
  }

  const listingId = Number(req.body?.listingId ?? 0);
  const toPetName = typeof req.body?.toPetName === "string" ? req.body.toPetName : "";

  if (!hasDatabase()) {
    return res.json({ ok: true, mode: "demo", listingId, toPetName, type });
  }

  const listingRows = await query(
    `SELECT b.id, b.owner_id AS ownerId, b.title, u.pet_name AS toPetName,
            COALESCE(r.role, 'reader') AS ownerRole
     FROM book_listings b
     INNER JOIN users u ON u.id = b.owner_id
     LEFT JOIN user_roles r ON r.user_id = u.id
     WHERE b.id = :listingId
     LIMIT 1`,
    { listingId },
  );

  if (!listingRows[0]) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const listing = listingRows[0];

  if (Number(listing.ownerId) === Number(session.user.id)) {
    return res.status(400).json({ error: "You cannot request your own book." });
  }

  // Sellers and libraries don't need to approve — the connection is auto-accepted
  // and the requester can pay ₹5 right away to unlock contact.
  const autoAccept = listing.ownerRole === "seller" || listing.ownerRole === "library";
  const status = autoAccept ? "accepted" : "pending";

  const result = await query(
    `INSERT INTO requests (from_user_id, to_user_id, listing_id, request_type, status)
     VALUES (:fromUserId, :toUserId, :listingId, :requestType, :status)`,
    {
      fromUserId: session.user.id,
      toUserId: listing.ownerId,
      listingId: listing.id,
      requestType: type,
      status,
    },
  );
  const requestId = result.insertId;

  // Notify the owner that someone is interested.
  await query(
    `INSERT INTO notifications (user_id, type, title, body, is_read, request_id)
     VALUES (:userId, :type, :title, :body, false, :requestId)`,
    {
      userId: listing.ownerId,
      type: `${type}_request_received`,
      title: type === "buy" ? "New buy request" : "New exchange request",
      body: autoAccept
        ? `${session.user.petName} wants "${listing.title}". They can pay ₹5 to get your contact.`
        : `${session.user.petName} sent a ${type} request for "${listing.title}". Accept to let them connect.`,
      requestId,
    },
  );

  // If auto-accepted, immediately tell the requester they can pay to connect.
  if (autoAccept) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, is_read, request_id)
       VALUES (:userId, 'request_accepted', :title, :body, false, :requestId)`,
      {
        userId: session.user.id,
        title: "Ready to connect",
        body: `Pay ₹5 to unlock ${listing.toPetName}'s contact for "${listing.title}".`,
        requestId,
      },
    );
  }

  return res.json({ ok: true, requestId, toPetName: listing.toPetName, autoAccept });
});

app.get("/api/my/listings", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  if (!hasDatabase()) {
    return res.json({ listings: [] });
  }

  const listings = await query(
    `SELECT id, title, author, listing_type AS listingType, price, status,
            photo_path AS coverUrl, exchange_address AS exchangeAddress, created_at AS createdAt
     FROM book_listings
     WHERE owner_id = :ownerId
     ORDER BY created_at DESC`,
    { ownerId: session.user.id },
  );

  return res.json({ listings });
});

app.post("/api/listings", (req, res) => {
  uploadBookPhoto(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || "Could not upload the photo." });
    }

    const session = getAuthedUser(req);
    if (!session) {
      return res.status(401).json({ error: "Sign in first" });
    }

    if (!hasDatabase()) {
      return res.status(503).json({ error: "Database is not connected on the PC server yet." });
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    const listingType = req.body?.listingType === "exchange" ? "exchange" : "sell";
    const rawPrice = Number(req.body?.price);
    const price = listingType === "sell" && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;

    if (!title) {
      return res.status(400).json({ error: "Book name is required." });
    }
    if (listingType === "sell" && !price) {
      return res.status(400).json({ error: "A valid price is required to sell a book." });
    }

    // Enforce per-role book limit.
    const [roleDetails, extras] = await Promise.all([
      fetchRoleDetails(session.user.id),
      fetchProfileExtras(session.user.id),
    ]);

    // Mobile number is compulsory before listing so buyers can connect.
    if (!extras.mobileNumber) {
      return res.status(400).json({
        error: "Please add your mobile number in My Profile before listing a book.",
      });
    }
    const role = roleDetails.role ?? session.user.role ?? "reader";
    const limit = listingLimitFor(role);
    if (extras.listingCount >= limit) {
      return res.status(403).json({
        error: `You've reached your limit of ${limit} books for a ${role}. Remove a book before adding a new one.`,
      });
    }

    // Exchange books use the user's one saved address.
    let exchangeAddress = null;
    if (listingType === "exchange") {
      if (!extras.address) {
        return res.status(400).json({
          error: "Please save your address in My Profile before listing a book for exchange.",
        });
      }
      exchangeAddress = extras.address;
    }

    const coverUrl = req.file ? await storeUploadedImage(req.file, "books") : null;

    const result = await query(
      `INSERT INTO book_listings (owner_id, title, author, listing_type, price, exchange_address, photo_path, status)
       VALUES (:ownerId, :title, :author, :listingType, :price, :exchangeAddress, :photoPath, 'available')`,
      {
        ownerId: session.user.id,
        title,
        author: author || null,
        listingType,
        price,
        exchangeAddress,
        photoPath: coverUrl,
      },
    );

    return res.json({
      listing: {
        id: result.insertId,
        title,
        author: author || null,
        listingType,
        price,
        exchangeAddress,
        status: "available",
        coverUrl,
      },
      listingCount: extras.listingCount + 1,
      listingLimit: limit,
    });
  });
});

app.delete("/api/listings/:id", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }

  if (!hasDatabase()) {
    return res.status(503).json({ error: "Database is not connected on the PC server yet." });
  }

  const listingId = Number(req.params.id ?? 0);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: "Invalid listing id." });
  }

  const result = await query(
    `DELETE FROM book_listings WHERE id = :listingId AND owner_id = :ownerId`,
    { listingId, ownerId: session.user.id },
  );

  if (!result.affectedRows) {
    return res.status(404).json({ error: "Book not found or not yours." });
  }

  return res.json({ ok: true });
});


// --- Request details (used by the connect/pay page) ---
app.get("/api/requests/:id", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.status(503).json({ error: "Database is not connected on the PC server yet." });
  }

  const requestId = Number(req.params.id ?? 0);
  const rows = await query(
    `SELECT r.id, r.from_user_id AS fromUserId, r.to_user_id AS toUserId,
            r.request_type AS requestType, r.status, r.contact_unlocked AS contactUnlocked,
            b.title AS bookTitle, b.photo_path AS coverUrl,
            u.pet_name AS ownerPetName, COALESCE(ro.role, 'reader') AS ownerRole
     FROM requests r
     INNER JOIN book_listings b ON b.id = r.listing_id
     INNER JOIN users u ON u.id = r.to_user_id
     LEFT JOIN user_roles ro ON ro.user_id = r.to_user_id
     WHERE r.id = :requestId
     LIMIT 1`,
    { requestId },
  );

  const request = rows[0];
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }
  if (Number(request.fromUserId) !== Number(session.user.id)) {
    return res.status(403).json({ error: "This request isn't yours." });
  }

  const contactUnlocked = Boolean(request.contactUnlocked);
  const payload = {
    id: request.id,
    requestType: request.requestType,
    status: request.status,
    contactUnlocked,
    bookTitle: request.bookTitle,
    coverUrl: request.coverUrl,
    ownerPetName: request.ownerPetName,
    ownerRole: request.ownerRole,
    amountPaise: serverConfig.connectionFeePaise,
    razorpayConfigured: isRazorpayConfigured(),
  };

  // If already paid, include the revealed contact again so it's never lost.
  if (contactUnlocked) {
    payload.contact = await fetchUserContact(request.toUserId);
  }

  return res.json(payload);
});

// --- Accept / reject an incoming request (User B acts) ---
app.patch("/api/requests/:id", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.status(503).json({ error: "Database is not connected on the PC server yet." });
  }

  const requestId = Number(req.params.id ?? 0);
  const action = req.body?.action === "reject" ? "reject" : "accept";

  const rows = await query(
    `SELECT r.id, r.from_user_id AS fromUserId, r.to_user_id AS toUserId, r.status,
            b.title AS bookTitle
     FROM requests r
     INNER JOIN book_listings b ON b.id = r.listing_id
     WHERE r.id = :requestId LIMIT 1`,
    { requestId },
  );
  const request = rows[0];
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }
  if (Number(request.toUserId) !== Number(session.user.id)) {
    return res.status(403).json({ error: "Only the receiver can respond to this request." });
  }

  const newStatus = action === "accept" ? "accepted" : "rejected";
  await query(`UPDATE requests SET status = :status WHERE id = :requestId`, {
    status: newStatus,
    requestId,
  });

  // Tell the requester what happened.
  await query(
    `INSERT INTO notifications (user_id, type, title, body, is_read, request_id)
     VALUES (:userId, :type, :title, :body, false, :requestId)`,
    {
      userId: request.fromUserId,
      type: action === "accept" ? "request_accepted" : "request_rejected",
      title: action === "accept" ? "Request accepted 🎉" : "Request declined",
      body:
        action === "accept"
          ? `${session.user.petName} accepted your request for "${request.bookTitle}". Pay ₹5 to unlock their contact.`
          : `${session.user.petName} declined your request for "${request.bookTitle}".`,
      requestId,
    },
  );

  return res.json({ ok: true, status: newStatus });
});

// --- Create a Razorpay order for the ₹5 connection fee ---
app.post("/api/payments/order", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.status(503).json({ error: "Database is not connected on the PC server yet." });
  }
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: "Payments are not set up yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to pc-server/.env and restart.",
    });
  }

  const requestId = Number(req.body?.requestId ?? 0);
  const rows = await query(
    `SELECT r.id, r.from_user_id AS fromUserId, r.to_user_id AS toUserId, r.status,
            r.contact_unlocked AS contactUnlocked, COALESCE(ro.role, 'reader') AS ownerRole
     FROM requests r
     LEFT JOIN user_roles ro ON ro.user_id = r.to_user_id
     WHERE r.id = :requestId LIMIT 1`,
    { requestId },
  );
  const request = rows[0];
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }
  if (Number(request.fromUserId) !== Number(session.user.id)) {
    return res.status(403).json({ error: "This request isn't yours." });
  }
  if (Boolean(request.contactUnlocked)) {
    return res.status(400).json({ error: "You've already unlocked this contact." });
  }
  const payable =
    request.ownerRole === "seller" || request.ownerRole === "library" || request.status === "accepted";
  if (!payable) {
    return res.status(400).json({ error: "Wait for the owner to accept before paying." });
  }

  const amountPaise = serverConfig.connectionFeePaise;
  let order;
  try {
    order = await createRazorpayOrder({ amountPaise, receipt: `req_${requestId}_${Date.now()}` });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not start payment." });
  }

  await query(
    `INSERT INTO payments (payer_id, request_id, amount_paise, currency, razorpay_order_id, status)
     VALUES (:payerId, :requestId, :amountPaise, 'INR', :orderId, 'created')`,
    { payerId: session.user.id, requestId, amountPaise, orderId: order.id },
  );

  return res.json({
    orderId: order.id,
    amountPaise,
    currency: "INR",
    keyId: serverConfig.razorpay.keyId,
  });
});

// --- Verify the Razorpay payment and unlock the contact ---
app.post("/api/payments/verify", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.status(503).json({ error: "Database is not connected on the PC server yet." });
  }

  const orderId = String(req.body?.razorpay_order_id ?? "");
  const paymentId = String(req.body?.razorpay_payment_id ?? "");
  const signature = String(req.body?.razorpay_signature ?? "");

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: "Missing payment details." });
  }
  if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ error: "Payment could not be verified. Please contact support." });
  }

  const payments = await query(
    `SELECT id, request_id AS requestId, payer_id AS payerId FROM payments
     WHERE razorpay_order_id = :orderId AND payer_id = :payerId LIMIT 1`,
    { orderId, payerId: session.user.id },
  );
  const payment = payments[0];
  if (!payment) {
    return res.status(404).json({ error: "Payment record not found." });
  }

  await query(
    `UPDATE payments SET status = 'paid', razorpay_payment_id = :paymentId WHERE id = :id`,
    { paymentId, id: payment.id },
  );
  await query(`UPDATE requests SET contact_unlocked = 1 WHERE id = :requestId`, {
    requestId: payment.requestId,
  });

  const reqRows = await query(`SELECT to_user_id AS toUserId FROM requests WHERE id = :id LIMIT 1`, {
    id: payment.requestId,
  });
  const contact = reqRows[0] ? await fetchUserContact(reqRows[0].toUserId) : null;

  return res.json({ ok: true, contact });
});

// --- Payment history for the signed-in user ---
app.get("/api/payments/history", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.json({ payments: [] });
  }

  const rows = await query(
    `SELECT p.id, p.amount_paise AS amountPaise, p.status, p.created_at AS createdAt,
            p.request_id AS requestId, r.contact_unlocked AS contactUnlocked,
            r.to_user_id AS toUserId, b.title AS bookTitle, u.pet_name AS ownerPetName,
            u.mobile_number AS mobile, u.whatsapp_same AS whatsappSame, u.whatsapp_number AS whatsappNumber
     FROM payments p
     INNER JOIN requests r ON r.id = p.request_id
     INNER JOIN book_listings b ON b.id = r.listing_id
     INNER JOIN users u ON u.id = r.to_user_id
     WHERE p.payer_id = :payerId
     ORDER BY p.created_at DESC
     LIMIT 50`,
    { payerId: session.user.id },
  );

  const payments = rows.map((row) => {
    const unlocked = Boolean(row.contactUnlocked) && row.status === "paid";
    const whatsapp = Number(row.whatsappSame) === 1 ? row.mobile : row.whatsappNumber;
    return {
      id: row.id,
      amountPaise: row.amountPaise,
      status: row.status,
      createdAt: row.createdAt,
      requestId: row.requestId,
      bookTitle: row.bookTitle,
      ownerPetName: row.ownerPetName,
      contact: unlocked ? { petName: row.ownerPetName, mobile: row.mobile ?? null, whatsapp: whatsapp ?? null } : null,
    };
  });

  return res.json({ payments });
});

// --- Report fraud / abuse ---
app.post("/api/complaints", async (req, res) => {
  const session = getAuthedUser(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in first" });
  }
  if (!hasDatabase()) {
    return res.json({ ok: true });
  }

  const targetPetName =
    typeof req.body?.targetPetName === "string" ? req.body.targetPetName.trim().slice(0, 80) || null : null;
  const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 80) : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 2000) : "";

  if (!category) {
    return res.status(400).json({ error: "Please choose what went wrong." });
  }
  if (description.length < 10) {
    return res.status(400).json({ error: "Please describe what happened (at least 10 characters)." });
  }

  await query(
    `INSERT INTO complaints (reporter_id, target_pet_name, category, description, status)
     VALUES (:reporterId, :targetPetName, :category, :description, 'open')`,
    { reporterId: session.user.id, targetPetName, category, description },
  );

  return res.json({ ok: true });
});


app.get("/", (_req, res) => {
  res.type("text/plain").send("BookHug PC server is running.");
});

ensureSchemaUpgrades()
  .catch((error) => console.error("Schema migration failed", error))
  .finally(() => {
    app.listen(serverConfig.port, () => {
      console.log(`BookHug PC server running on ${serverConfig.publicBaseUrl}`);
      console.log(
        isS3Configured()
          ? `Photo storage: Amazon S3 bucket "${serverConfig.aws.s3Bucket}" (${serverConfig.aws.region})`
          : "Photo storage: local disk (set AWS_REGION + S3_BUCKET to use Amazon S3)",
      );
    });
  });
