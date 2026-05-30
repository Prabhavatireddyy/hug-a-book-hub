# Build "My Books" profile page (add / sell / exchange)

## Goal

A logged-in user gets a personal **My Books** page where they can add a book (name, author, photo), mark it as **Sell** (with price) or **Exchange**, see their current books, and remove them. These books already flow into search and their public `/u/{petname}` profile automatically.

## What already exists (reused, not rebuilt)

- `book_listings` table with `title`, `author`, `listing_type` (sell/exchange/library), `price`, `photo_path`, `status`, `owner_id`.
- Public profile page `/u/$petname` already renders a user's listings.
- Search already pulls from `book_listings`.
- PC server already serves uploaded files from `/uploads`.

So this feature is mostly: an **add/manage UI** + the **write endpoints** that are currently missing.

## Backend changes (`pc-server/src/server.mjs`)

Add image upload support and three endpoints:

1. **Image uploads** — add `multer` (new dependency) to accept a book photo, save it into the existing `pc-server/uploads` folder, and store the public URL (`PUBLIC_BACKEND_URL/uploads/<file>`) in `photo_path`. Limit: images only, ~5MB.
2. `POST /api/listings` (signed-in) — multipart form: `title` (required), `author`, `listingType` (`sell` or `exchange`), `price` (required when sell), optional photo. Inserts a row owned by the current user.
3. `GET /api/my/listings` (signed-in) — returns the current user's own books.
4. `DELETE /api/listings/:id` (signed-in) — deletes a book, but only if it belongs to the current user.

All validated server-side; price ignored for exchange.

## Frontend changes

1. `**src/lib/bookhug-api.ts**` — add `createListing(formData)`, `getMyListings()`, `deleteListing(id)`. Add a `MyListing` type.
2. `**src/routes/profile.tsx**` (new route `/profile`, "My Books"):
  - Redirects to `/login` if signed out, `/onboarding` if not onboarded (same pattern as Home).
  - **Add-book form**: book name, author (optional), photo picker with preview, a Sell/Exchange toggle, and a price field shown only for Sell.
  - **My shelf grid**: cards of the user's current books with cover, type badge, price, and a delete button.
  - A "View public profile" link to `/u/{petName}`.
  - Styled with the existing BookHug cute card/rounded design tokens.
3. `**src/routes/home.tsx**` — add a header link/button to **My Books** so users can reach the page.

## Technical notes

- Photo stored as a full URL so the existing `<img src={coverUrl}>` on the public profile and search works with no change.
- `multer` is Node-only and runs only on the user's PC server — fine for this self-hosted backend (not the Lovable Worker).
- When MySQL isn't connected, the add endpoint returns a clear "database not connected" error instead of failing silently.

## After it's built

Sign in → open **My Books** → add a book as Sell or Exchange with a photo → it appears on your shelf, on your public `/u/{petname}` profile, and in search.

## Note on your local PC copy

These changes are applied here in Lovable. To run them on your PC you'll re-download/pull the updated files and run `npm install` once (for the new `multer` package) before `npm run backend`.