
## Goal
Set up a real self-hosted backend on your PC for BookHug, connect it to a MySQL database, and prepare the frontend to talk to that backend while keeping Google/Gmail login as part of the architecture.

## Important architecture decision
Because you want to host from your own PC, the clean setup is:

```text
BookHug frontend (this TanStack app)
        |
        | HTTPS API requests
        v
Your PC backend server
(Node.js + Express)
        |
        v
MySQL on your PC
        |
        v
Local uploads folder for book photos
```

Google login needs backend because the backend must:
- receive the Google OAuth callback
- verify Google tokens safely
- create/login users in your database
- create a session or issue an auth token
- protect private routes and actions

So yes: if you want Google login with your own PC-hosted app, your PC server is the right place for it.

## What to build

### Phase A — Backend foundation on your PC
Create a separate backend service for local hosting:
- Node.js + Express API
- MySQL connection layer
- environment/config support for local machine setup
- CORS support so the Lovable frontend can call your PC API
- health-check route to confirm the connection works

Backend endpoints to add first:
- `GET /api/health`
- `POST /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/me`
- `POST /api/logout`

## Phase B — MySQL database design
Create database tables for your planned app.

### Core tables
- `users`
  - id
  - google_id
  - email
  - pet_name
  - avatar_url
  - location_city
  - latitude
  - longitude
  - created_at
- `user_roles`
  - id
  - user_id
  - role (`reader`, `seller`, `library`, `admin`)
- `seller_profiles`
  - user_id
  - store_name
  - city
- `library_profiles`
  - user_id
  - library_name
  - city
  - verification_status (`pending`, `approved`, `rejected`)
- `book_listings`
  - id
  - owner_id
  - title
  - author
  - category
  - condition
  - listing_type (`sell`, `exchange`)
  - price
  - photo_path
  - status
  - created_at
- `notifications`
  - id
  - user_id
  - type
  - title
  - body
  - is_read
  - created_at
- `requests`
  - id
  - from_user_id
  - to_user_id
  - listing_id
  - request_type (`buy`, `exchange`)
  - status
  - created_at

### Security rule
Roles will be stored in `user_roles`, not on the profile row.

## Phase C — Google login on your PC backend
Implement Google OAuth in the backend:
- redirect user from frontend to backend Google login start route
- backend sends user to Google consent page
- Google redirects back to your PC backend callback URL
- backend creates or finds the user in MySQL
- backend creates session cookie or returns secure token
- frontend uses that authenticated session to load profile data

### Required setup outside code
You will need:
- Google Cloud Console OAuth client
- authorized redirect URL pointing to your PC backend public HTTPS URL
- a public HTTPS tunnel/domain to your PC backend

## Phase D — Make your PC reachable from the internet
Since your frontend is not running inside your home network, your backend must be public.

Recommended:
- use Cloudflare Tunnel for HTTPS access to your PC backend

This gives:
- a stable HTTPS URL
- no raw port exposure
- a URL Google OAuth can use for callback

Without this, Google login and frontend-to-backend connection will not work reliably.

## Phase E — Frontend integration in this TanStack app
Add frontend app wiring for the self-hosted backend:
- API base URL config
- auth client helper for calling your PC backend
- login page button: “Continue with Google”
- route guards / session bootstrap
- onboarding flow submits to MySQL backend instead of mock state

### Frontend routes to wire next
- `/login`
- `/onboarding`
- `/home`
- `/u/$petname`
- notification panel data source

## Phase F — Onboarding data flow
After Google login:
1. user lands on role selection
2. chooses Reader / Seller / Library
3. chooses pet username
4. grants location
5. backend saves profile to MySQL
6. if Library: mark verification as `pending`
7. user enters app

### Role behavior
- Reader: basic pet profile
- Seller: store name + city
- Library: library name + city + pending verification
- Library users can browse immediately but cannot create listings until approved

## Phase G — Photos stored on your PC
For book photos:
- backend accepts image upload
- save file in local folder on your PC
- store relative file path in MySQL
- expose uploaded images through backend static route

Example:
```text
/uploads/book-photos/abc123.jpg
```

Later, if needed, this can be swapped to S3 or cloud storage.

## Phase H — Search and notifications backend
Prepare API routes for the pages you already want:
- `GET /api/search`
- `GET /api/users/:petName`
- `GET /api/notifications`
- `POST /api/requests/buy`
- `POST /api/requests/exchange`

Search response should support:
- nearby readers
- sellers
- libraries fallback
- right-side placeholder Amazon/Flipkart pricing data

## Files and areas to add in this project later
Frontend app:
- new route files in `src/routes/` for login, onboarding, home, profile
- reusable UI components for onboarding, split search layout, notifications
- client-side API helper module
- local session/auth state provider in `src/`

Separate backend project/service:
- server entry file
- auth routes
- user/profile routes
- listings routes
- notification routes
- MySQL schema/migrations
- uploads middleware

## Implementation order
1. Create backend folder/service structure
2. Connect MySQL on your PC
3. Create schema and tables
4. Add health endpoint and frontend API config
5. Add Google OAuth backend flow
6. Add session handling
7. Connect login/onboarding UI to backend
8. Add listings, search, profile, notifications APIs
9. Add local file upload handling
10. Test end-to-end with your public tunnel URL

## Technical notes
- The current Lovable app has only the landing page route so far; login, home, profile, and notification views still need to be added.
- The frontend is already styled for the cute pastel BookHug theme, so new pages should follow the existing design tokens in `src/styles.css`.
- Since this project currently has no backend integration, the PC-hosted server should be treated as a separate API service rather than trying to connect MySQL directly from browser code.
- Browser code must never connect directly to MySQL; only the backend server should talk to MySQL.
- If you later want the whole app hosted from your PC, we can also move the frontend build output behind the same server/tunnel.

## Result after this phase
You will have:
- a real MySQL-backed backend running on your PC
- a public HTTPS URL pointing to your PC server
- Google login architecture ready for self-hosting
- frontend pages ready to connect to your own backend instead of Lovable Cloud
- a clean path to build listings, search, profiles, and notifications on top of your own infrastructure
