
# 📚 BookHug — A Cute Book Exchange Platform

A loveable, huggable book platform where readers, sellers, and libraries connect to **buy, sell, and exchange** books with people nearby. No real names — just adorable pet usernames like `cat1`, `sunflower3`, `mango7` 🌸

---

## 🎨 Design Direction
- **Vibe**: Soft, cute, cozy — pastel palette (warm peach, soft mint, butter yellow, blush pink), rounded corners, gentle shadows, playful book/animal illustrations
- **Typography**: Friendly rounded headings (e.g. Quicksand / Fredoka), readable body
- **Micro-delight**: 🎉 Confetti ribbons shoot from the top on first landing, gentle hover bounces on book cards, heart-pulse on CTA buttons

---

## 🏠 Page 1 — Landing Page (`/`)
- **Confetti party ribbon burst** on page load (canvas-confetti)
- Cute hero: *"Find your next book hug 🤗"* + tagline + big "Get Started" button
- **"Most Read on the Internet"** carousel — curated list of ~12 famous books (covers, titles, author) hand-picked
- Three cute role cards: 📖 Reader · 🏪 Book Seller · 📚 Library Owner
- Footer with cozy "Made with ♥" note

## 🔐 Page 2 — Login & Onboarding (`/login`, `/onboarding`)
- **Sign in with Google** (single button, big and friendly)
- After Google auth → role selection screen (Reader / Seller / Library)
- **Pet username picker**:
  - Category chips: 🌸 Flowers · 🍓 Fruits · 🐱 Animals · 🌟 Other
  - Live availability check → auto-suffix unique number (`cat` → `cat12`)
  - Real name **never displayed anywhere** — only the petname
- Role-specific extra fields:
  - **Reader** → just petname
  - **Seller** → store name + city
  - **Library** → library name + city → marked **"Pending verification"** (can browse but not list books)
- **Cute location permission modal**: *"We need your location to find book buddies near you! 🗺️🐾 Pretty please?"* — required to proceed

## 🌟 Page 3 — Reader Onboarding Questions (`/onboarding/reader-questions`)
After signup, readers answer 3 sweet questions:
1. **Books to sell?** → title + photo upload + price → "Ready to sell 💸"
2. **Books to exchange?** → title + photo upload → "Ready to exchange 🔄"
3. **Looking for a book?** → search bar + radius selector (5 / 10 / 20 km)

(Skippable, can be filled later from dashboard)

## 🏡 Page 4 — Home Dashboard (`/home`)
- Header with petname + cute avatar
- Quick action tiles: "List a book", "Search a book", "My listings", "Messages (placeholder)"
- "Books near you" feed based on location

## 🔍 Page 5 — Search Results (`/search?q=...`)
Three-mode toggle at top:
1. **Buy from a nearby reader**
2. **Buy from a seller**
3. **Exchange with a nearby reader**

Layout (split view):
- **Left ~65%** — scrollable results section:
  - **Readers section** — cards with `petname · book title · ready to sell/exchange · price · photo · distance`
  - **Sellers section** — cards with store name (petname format) + price + photo
  - **Library section** — appears when no readers found
- **Right ~35%** — vertical "Online prices" sidebar:
  - Amazon — placeholder price + "View on Amazon" link
  - Flipkart — placeholder price + "View on Flipkart" link
  - (Real prices wired in a follow-up)
- Empty state: cute "No book buddies here yet 🥲" illustration + fallback to library/seller/online

## 📖 Page 6 — My Listings (`/my-books`)
- Tabs: For Sale · For Exchange · Wishlist
- Add / edit / remove listings with photo upload

## 👤 Page 7 — Public Profile (`/u/$petname`)
- Shows petname, role badge, city (sellers/libraries only), their listings
- **Zero personally identifiable info** displayed

---

## 🗄️ Data Model (Lovable Cloud)
- `profiles` — id (auth uid), petname (unique), role, city (nullable), store_name (nullable), library_name (nullable), library_status ('pending' | 'verified'), latitude, longitude, created_at
- `user_roles` — separate table (id, user_id, role: 'reader' | 'seller' | 'library' | 'admin')
- `books` — id, owner_id, title, photo_url, type ('sell' | 'exchange'), price (nullable), status ('available' | 'sold' | 'reserved'), created_at
- `wishlist` — id, user_id, book_title, search_radius_km
- **Storage bucket**: `book-photos` (public read, owner write) for real photo uploads
- **RLS**: profiles readable by all (only public fields exposed via view), books readable by all, only owner can write; libraries cannot insert into `books` until status = 'verified'

## 🔑 Auth & Security
- Google OAuth via Lovable Cloud
- `has_role()` security-definer function for role checks (no role data on profiles table)
- Petname uniqueness enforced at DB level + auto-suffix on conflict
- Real names from Google never shown — only petname displayed everywhere

## 🚦 Build Order (incremental)
1. **Phase 1**: Landing page with confetti + curated most-read books + design system
2. **Phase 2**: Lovable Cloud + Google auth + onboarding flow (role + petname + location)
3. **Phase 3**: Reader question flow + book listing (with photo upload to Cloud Storage)
4. **Phase 4**: Search page with 3 modes + nearby distance filter + split layout with online price sidebar
5. **Phase 5**: My Listings + public profile pages
6. **Phase 6**: Admin verification view for libraries (later polish)

We'll start with **Phase 1** so you can see and feel the cute landing page first 🎀
