# Benue Technology Registry & Compliance Platform

BTRCP is a browser-based prototype for Benue State technology licensing, device registration, compliance enforcement, public verification, warranty tracking, and account administration.

## Files

- `index.html` - application interface and modal markup
- `btrcp-app.js` - application logic, local browser storage fallback, and optional API bridge
- `server.js` - Express server, REST API, static frontend host, seed data, and security middleware
- `schema.sql` - SQLite schema and indexes
- `.env.example` - server configuration template

## Run the full-stack app

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
3. Install dependencies and start the server:

   ```bash
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

The first start creates `data/btrcp.sqlite`, applies `schema.sql`, and seeds the demo records. The API uses bcrypt password hashes, short-lived JWT bearer tokens, role-checked admin endpoints, Helmet, CORS, and rate limiting on authentication routes.

Demo accounts:

- Master admin: `admin@bitda.gov` / `admin123`
- Company: `company@ultradigital.ng` / `company123`
- Customer: `customer@demo.ng` / `customer123`

## API highlights

- `POST /api/auth/login`, `/api/auth/register`, `/api/auth/recover`, `/api/auth/change-password`
- `GET /api/bootstrap` for the authenticated registry view
- `POST /api/licenses` plus license activation and company suspension, restricted to license administrators
- `POST /api/devices`, device linking/unlinking and stolen-device flagging
- License activation and company suspension endpoints restricted to license administrators
- Master-admin-only administrator creation and role changes
- `GET /api/public/verify?q=...` for unauthenticated license/device verification

## Offline/demo fallback

Opening `index.html` directly still works as the original browser prototype. If the API cannot be reached while the app is served, the frontend falls back to its existing `localStorage` demo behavior. Payment and notification integrations remain simulated.
