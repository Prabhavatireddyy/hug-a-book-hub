import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { demoNotifications, demoProfile, demoSearchResponse } from "./lib/demo-data.mjs";
import { getPool, hasDatabase, pingDatabase, query } from "./lib/db.mjs";
import { isGoogleConfigured, serverConfig } from "./lib/config.mjs";
import { createSession, deleteSession, getSession, updateSessionUser } from "./lib/session-store.mjs";

mkdirSync(serverConfig.uploadsDir, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, serverConfig.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = (extname(file.originalname || "") || ".jpg").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadBookPhoto = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
}).single("photo");

function photoUrlFor(filename) {
  return `${serverConfig.publicBaseUrl.replace(/\/$/, "")}/uploads/${filename}`;
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

    res.cookie(serverConfig.sessionCookieName, sessionId, cookieOptions());
    return res.redirect(new URL(state.redirectTo || "/onboarding", serverConfig.frontendOrigin || "http://localhost:3000").toString());
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

  const roleDetails = session.user?.id ? await fetchRoleDetails(session.user.id) : {};
  return res.json({ user: { ...session.user, ...roleDetails } });
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

  return res.json({
    query: q,
    mode,
    nearby: mapped.filter((row) => row.ownerRole === "reader"),
    sellers: mapped.filter((row) => row.ownerRole === "seller"),
    libraries: mapped.filter((row) => row.ownerRole === "library"),
    onlinePrices: demoSearchResponse.onlinePrices,
  });
});

app.get("/api/users/:petName", async (req, res) => {
  const petName = String(req.params.petName ?? "");

  if (!hasDatabase()) {
    return res.json({ ...demoProfile, petName });
  }

  const users = await query(
    `SELECT id, pet_name AS petName, email, avatar_url AS avatarUrl, location_city AS city
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
      `SELECT id, title, author, listing_type AS listingType, price, status, photo_path AS coverUrl
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
    `SELECT id, type, title, body, is_read AS isRead, created_at AS createdAt
     FROM notifications
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT 20`,
    { userId: session.user.id },
  );

  return res.json({ notifications });
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
    `SELECT b.id, b.owner_id AS ownerId, u.pet_name AS toPetName
     FROM book_listings b
     INNER JOIN users u ON u.id = b.owner_id
     WHERE b.id = :listingId
     LIMIT 1`,
    { listingId },
  );

  if (!listingRows[0]) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const listing = listingRows[0];
  const result = await query(
    `INSERT INTO requests (from_user_id, to_user_id, listing_id, request_type, status)
     VALUES (:fromUserId, :toUserId, :listingId, :requestType, 'pending')`,
    {
      fromUserId: session.user.id,
      toUserId: listing.ownerId,
      listingId: listing.id,
      requestType: type,
    },
  );

  await query(
    `INSERT INTO notifications (user_id, type, title, body, is_read)
     VALUES (:userId, :type, :title, :body, false)`,
    {
      userId: listing.ownerId,
      type: `${type}_request_received`,
      title: type === "buy" ? "New buy request" : "New exchange request",
      body: `${session.user.petName} sent you a ${type} request.`,
    },
  );

  return res.json({ ok: true, requestId: result.insertId, toPetName: listing.toPetName });
});

app.get("/", (_req, res) => {
  res.type("text/plain").send("BookHug PC server is running.");
});

app.listen(serverConfig.port, () => {
  console.log(`BookHug PC server running on ${serverConfig.publicBaseUrl}`);
});
