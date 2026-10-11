# Vedant Adenium — custom plant catalogue

A responsive public storefront plus a password-protected nursery admin page. Customers browse plants and order through WhatsApp; the owner can upload plant photos and manage names, descriptions, prices and availability.

## Included

- Premium botanical responsive storefront
- Plant catalogue loaded from Supabase
- WhatsApp order buttons with plant name, variety and price prefilled
- Admin login, add/edit/delete plant listings
- Upload JPG, PNG or WebP plant photos to Supabase Storage
- Server-side input validation, session cookie, login rate limit and basic security headers
- No online payment or checkout backend (orders are handled manually on WhatsApp)

## Requirements

- Node.js 20+
- A Supabase project
- A business WhatsApp number in international format, digits only (for example `91XXXXXXXXXX`)

## Run locally

1. Install Node.js from https://nodejs.org/ and Git from https://git-scm.com/ if needed.
2. Copy `.env.example` to `.env`.
3. In Supabase, create a project. Open SQL Editor and run `supabase-schema.sql`.
4. In Supabase Storage, create a bucket named `plant-photos` and set it to **Public** so plant photos can be displayed on the public website. Only server-side admin uploads are implemented in this app. Do not store private files in this bucket.
5. In `.env`, fill in:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, never commit it)
   - `WHATSAPP_NUMBER` (digits only, including country code)
   - `SESSION_SECRET` (long random string)
   - `ADMIN_PASSWORD` (unique strong password)
6. Run in the project folder:

   ```bash
   npm install
   npm run dev
   ```

7. Open http://localhost:3000 for the storefront and http://localhost:3000/admin for the admin dashboard.
8. Add a plant from the admin dashboard and check that it appears on the homepage. Click Order on WhatsApp to test the prefilled message.

## Generate a strong session secret

In PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into `SESSION_SECRET` in `.env`. Use a separate strong admin password.

## Deploy (simple single-service approach)

This app serves the storefront and admin from the same Node.js server. You can deploy the entire repository to Render as a Web Service:

1. Push the project to a private GitHub repository.
2. In Render, create a new Web Service from that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the environment variables from `.env` to Render's Environment settings. Do not upload `.env`.
6. Use a paid service for a production shop where you want to avoid free-tier sleeping.
7. Add a custom domain in Render and follow its DNS/HTTPS instructions, or keep the generated service URL for testing.
8. Test the public site, admin login, adding/editing/deleting plants, image upload, and WhatsApp links on mobile.

## Important production notes

- This starter uses Express's default in-memory session store. It is acceptable for local testing, but **not recommended for a production multi-instance deployment**. Configure a persistent session store (for example, a compatible Redis store) before scaling or running multiple instances. Sessions can be lost on restart.
- The Supabase service-role key bypasses RLS and must remain private in server environment variables. Never put it in frontend JavaScript, expose it in a public repository, or return it from an API.
- Use a long unique admin password and session secret. Restrict access to the hosting account and enable MFA.
- Configure Supabase backups and verify recovery before relying on it for business records.
- This starter is for catalogue management and WhatsApp ordering; it does not store customer orders or process payments.
- Public image bucket URLs are intentionally public. Only upload images you have rights to use.
- Add an appropriate privacy policy, delivery terms, replacement policy and contact details before launch.
- Do not store payment card data. If online payments are added later, implement Razorpay order creation and signature verification on the server plus verified webhooks.
- Review and update dependencies periodically.

## API overview

- `GET /api/health` — health check
- `GET /api/config` — public site config
- `GET /api/plants` — public plant catalogue
- `POST /api/admin/login` — admin login
- `POST /api/admin/logout` — admin logout
- `GET /api/admin/session` — admin session status
- `POST /api/admin/plants` — create plant (admin only)
- `PUT /api/admin/plants/:id` — update plant (admin only)
- `DELETE /api/admin/plants/:id` — delete plant (admin only)
- `POST /api/admin/upload` — upload plant photo (admin only)
