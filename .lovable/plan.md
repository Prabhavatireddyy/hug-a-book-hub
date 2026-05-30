# BookHug — Profile, Books, Address & Location Verification

This app runs on your laptop: an Express + MySQL backend in `pc-server/` plus the React frontend. All backend work goes into `pc-server/`; no Lovable Cloud is involved.

## 1. Database (pc-server/schema.sql + setup-db.mjs)

Add columns (safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` style for existing installs):

- `users`: add `bio TEXT`, `address TEXT`, `address_verified TINYINT(1) DEFAULT 0`.
  (`latitude` / `longitude` already exist and will store the verified GPS point.)
- `book_listings`: add `exchange_address TEXT NULL` (snapshot of the user's saved address at the time an exchange book is added).

A small migration block will run these ALTERs on startup so your existing data is kept.

## 2. My Profile page (src/routes/profile.tsx)

Reworked into clear sections:

**a) Profile header / edit**
- Avatar with an "Change photo" upload button (image, ~5MB).
- Bio textarea ("Showcase yourself to other readers"), shown on the public profile.
- "View public profile" link (already present).

**b) Address & location verification**
- Address textarea + a "Use my current location & verify" button.
- Clicking it asks the browser for GPS, then asks the server to geocode the typed address and compare it to the GPS point.
- Result shows a clear status: ✅ Verified (within 20 km) or ⚠️ Mismatch with the measured distance.
- "Save & confirm" button stores address + GPS + verified flag.

**c) Add a book** (improved existing form)
- Book name, writer name, cover image (existing).
- Sell → price field (existing).
- Exchange → uses your one saved address automatically; if no address saved yet, it prompts you to save one first.
- A live limit banner: "Books: 4 / 20" based on role (Reader 20, Seller 100, Library 1000).
- The "Add book" button disables when the limit is reached.

**d) My shelf** (existing grid) — unchanged apart from showing the exchange address badge on exchange books.

## 3. Public profile (src/routes/u.$petname.tsx)
- Show the user's `bio` and (for exchange listings) the saved address, so other users can find them.

## 4. Backend endpoints (pc-server/src/server.mjs)

- `PATCH /api/me/profile` (multipart): update `bio`, optional new `avatar` image, `address`, `latitude`, `longitude`, `address_verified`. Returns updated session user.
- `POST /api/me/verify-location` `{ address, latitude, longitude }`: server geocodes `address` via OpenStreetMap Nominatim, computes the haversine distance to the GPS point, returns `{ verified, distanceKm, geocodedLabel }` (verified when ≤ 20 km).
- `POST /api/listings`: enforce per-role limit (Reader 20 / Seller 100 / Library 1000) before insert; for exchange books, stamp the user's saved `address` into `exchange_address`. Returns a clear error if the limit is hit.
- `GET /api/me/profile` (or extend `/api/me`): include `bio`, `address`, `addressVerified`, and current `listingCount` + `listingLimit` so the page can render the limit banner.

The avatar upload reuses the existing multer/uploads setup; a second single-file handler for the `avatar` field is added.

## 5. Notification nudge (in-app, no email)
- After login/onboarding, if a user's address is **not verified**, the server creates a one-time notification: "Please verify your location in My Profile and Save & confirm — otherwise search will show books, users, libraries and sellers near the address you typed, which may be wrong."
- This appears in the existing bell/notification panel.

## 6. API client + auth (src/lib/bookhug-api.ts, bookhug-auth.tsx)
- Add types & methods: `updateProfile(formData)`, `verifyLocation(payload)`, and extend `SessionUser`/`MyListing` with `bio`, `address`, `addressVerified`, `exchangeAddress`, plus `listingCount`/`listingLimit`.
- `bookhug-auth` exposes a way to refresh the user after profile edits.

---

## Technical notes
- **Geocoding**: PC server calls `https://nominatim.openstreetmap.org/search?format=json&q=...` with a proper `User-Agent` header (required by their policy). Distance via the haversine formula. No API key, works offline-of-Google on your laptop.
- **Verification threshold**: 20 km (your choice); easy to change in one constant.
- **Limits** are enforced server-side (authoritative) and mirrored in the UI for feedback.
- **Restart note**: after these changes you'll restart the PC server; the schema migration runs automatically. No new npm packages are required (Node 18+ `fetch` is used for Nominatim).
