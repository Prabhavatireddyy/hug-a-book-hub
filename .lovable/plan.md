# BookHug — Payments, Notifications, Maps, Contacts & SEO

Backend stays in `pc-server/` (Express + MySQL on your laptop). Frontend is the TanStack Start app. New laptop secrets go in `pc-server/.env`: `GOOGLE_MAPS_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a books-price API key (see §6).

## 1. Google geocoding (replace OpenStreetMap)
- In `server.mjs`, rewrite `geocodeAddress()` to call Google Geocoding API (`maps/api/geocode/json`) using `GOOGLE_MAPS_API_KEY` from config. Keep the same return shape (`latitude`, `longitude`, `label`) so verify-location logic and the 20 km haversine check are unchanged.
- Add `GOOGLE_MAPS_API_KEY` to `pc-server/src/lib/config.mjs`. Geocoding only — no visible map.
- If the key is missing, return a clear error telling you to set it in `.env`.

## 2. Mobile number + WhatsApp (My Profile)
- DB: add `users.mobile_number VARCHAR(20)`, `users.whatsapp_same TINYINT(1) DEFAULT 1`, `users.whatsapp_number VARCHAR(20)` via the existing idempotent migration block.
- Profile page: mobile number field + a "Same as WhatsApp" tick. When unticked, a second WhatsApp number field appears. Mobile is **compulsory** (same enforcement as address) — saving and listing books are blocked until it's filled, with inline helper text explaining why ("Buyers reach you on this number after a confirmed, paid request").
- Extend `PATCH /api/me/profile`, `fetchProfileExtras`, and `SessionUser` type with these fields.

## 3. Notifications bell (top of screen)
- Replace the floating bell with a header bell + unread badge on Home, Profile, and public profile (shared header). It opens the existing notification sheet.
- Each request notification becomes interactive:
  - **For User B (receiver):** "Accept" / "Decline" buttons inline → calls `PATCH /api/requests/:id` (status accepted/rejected).
  - **For User A (sender):** when B accepts, A gets a notification "✅ B accepted — pay ₹5 to get their contact" with a "Connect & pay" button opening the payment page.
- Add `GET /api/notifications` already exists; add `PATCH /api/requests/:id` to accept/reject and create the follow-up notification to the sender.
- Add a "Mark all read" action and persist `is_read`.

## 4. Connection flow + Razorpay ₹5 payment
Flow rules:
- **User → Seller / Library:** no approval needed. A clicks "Connect" → pays ₹5 → instantly gets the owner's mobile + WhatsApp.
- **User A → User B (reader, buy or exchange):** A sends request → B notified → B Accepts → A notified → A pays ₹5 → A gets B's mobile + WhatsApp. (Address stays private, per your choice.)
- New `/connect/$requestId` payment page: shows the book, who you're connecting with, ₹5 amount, and a Razorpay checkout (UPI + auto QR + cards built in).
- Backend endpoints:
  - `POST /api/payments/order` `{ requestId }` → validates the request is payable (seller/library always; reader only after `accepted`), creates a Razorpay order (₹5 = 500 paise), inserts a `payments` row (`status='created'`).
  - `POST /api/payments/verify` → verifies Razorpay signature (HMAC with secret), marks payment `paid`, marks the request `contact_unlocked`, and returns the revealed contact (mobile + WhatsApp).
  - Razorpay SDK added to `pc-server` (`npm i razorpay`); checkout script loaded on the frontend page.
- DB: new `payments` table (id, payer_id, request_id, amount_paise, currency, razorpay_order_id, razorpay_payment_id, status, created_at) with proper indexes/FKs; add `requests.contact_unlocked TINYINT(1) DEFAULT 0`.
- After payment, a "Contact unlocked" card shows B's mobile + a one-tap WhatsApp link (`https://wa.me/<number>`), with a clear note on respectful use.

## 5. Payment history
- New `/payments` page + header link: lists all the user's payments (book title, who, amount, date, status) from `GET /api/payments/history`.
- Each paid row re-shows the unlocked contact so they never lose it.

## 6. Live online prices (right panel)
- `server.mjs`: add `fetchOnlinePrices(title)` calling a books price API (Amazon/Flipkart via a real-time product-data provider) using an env key. Returns `[{ store, price, url, image? }]`.
- `GET /api/search` calls it for the query (with a short in-memory cache + timeout) and returns real `onlinePrices`. If the key is missing or the call fails, it **gracefully falls back to smart pre-searched links** (Amazon.in / Flipkart / etc. for the title) so the panel never breaks.
- Home right panel updated to show live price + store, and works for the current search term (not a fixed demo).
- I'll tell you exactly which API key to obtain and where to paste it; Amazon's own PA-API needs sales history, so a third-party real-time provider is the practical route.

## 7. Help & Complaint pages
- `/help`: friendly, self-explaining guide — how search, requests, payments, contact reveal, roles, limits, and location verification work. Written in plain language with sections and FAQs.
- `/complaint`: form to report fraud/abuse (target pet name, category, description, optional screenshot) → `POST /api/complaints` storing to a new `complaints` table; confirmation + "we review within 48h" message.
- Both linked from the header/footer.

## 8. Polish, cleanup & SEO
- **Smoothness:** shared header/footer component, consistent rounded cards, subtle transitions, loading skeletons, and inline explanatory microcopy throughout (your main focus — explain things in-place).
- **Cleanup:** consolidate duplicated header code from Home/Profile into one component; remove unused demo paths and dead placeholder copy; keep `index.tsx` as the landing page.
- **SEO / AI-search:** per-route `head()` titles + descriptions + canonical (Home, Profile, Help, Complaint, Payments, public profiles), Organization + WebSite JSON-LD in `__root.tsx`, BreadcrumbList + Person schema on public profiles, `public/robots.txt`, and a dynamic `src/routes/sitemap[.]xml.ts`. Semantic headings, single H1 per page, alt text, lazy images.

## Technical notes
- All money/role/contact checks are enforced server-side (authoritative); the UI mirrors state.
- Contact (mobile + WhatsApp) is revealed **only** after a `paid` payment on a valid request — never before.
- Restart the PC server after changes; schema migrations run automatically on startup. New npm package: `razorpay` (server) only.
- Secrets to add to `pc-server/.env`: `GOOGLE_MAPS_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the price-API key. I'll point you to each.
