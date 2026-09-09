# Production Security — JUAN PROJECT Suite V1

## Security boundary

JUAN PROJECT Workspace is the seller/admin authority. JUAN PROJECT Online is a client-facing application with access limited to the authenticated client's own data.

The UI is not the security boundary. Supabase Auth, server-side session verification, Row Level Security, private Storage, and server-only service credentials are the security boundary.

## Secrets

Server-only:
- `SUPABASE_SECRET_KEY` / service-role equivalent
- `GEMINI_API_KEY`

Browser-safe:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` / anon key

Never commit `.env` files. Never copy the service-role key or Gemini key into HTML/JS served to the browser.

## Authentication

### Workspace
- Requires Supabase email/password authentication.
- The signed-in Auth user must also have `user_roles.role = 'admin'`.
- The Workspace's old local UI gate is not treated as authorization.

### Online
- Existing clients use First Access, where a secure email link verifies ownership before a password is created.
- Future clients can sign up with email/password.
- Passwords are owned by Supabase Auth; no password column is added to `clients`.
- Minimum password length enforced by the UI is 10 characters. Configure equal or stronger password policy in Supabase Auth.

## Account enumeration

`/api/start-access` deliberately returns a generic success response whether or not the email exists as a JUAN PROJECT client. Do not change this to messages such as "client not found" on the public First Access route.

## Rate limiting

Migration 003 adds a server-only persistent rate-limit table and function. The included APIs use it for:
- First Access requests
- Gemini receipt extraction
- Payment submission

For login/sign-up abuse, also configure Supabase Auth rate limits and CAPTCHA/anti-bot controls when moving from limited client rollout to a public storefront.

## Client isolation

Before launch, use two real test Auth accounts linked to two different client rows.

Client A must fail to access:
- Client B profile
- Client B projects
- Client B project items
- Client B deliverables
- Client B payment submissions
- Client B private receipts
- Client B Drive links

The Online APIs resolve ownership from the authenticated user -> `portal_accounts.client_id`; do not trust a client-supplied `client_id`.

## Payments

A receipt upload is not an approved payment.

Flow:
1. Client uploads private proof.
2. Gemini may extract fields.
3. Client reviews and submits.
4. `payment_submissions.status = 'pending'`.
5. Admin approves/rejects.
6. Only approval inserts into canonical `payments`.

Migration 003 provides `review_juan_payment_submission`, which locks the submission and checks the live project balance before crediting it.

Never auto-approve based on Gemini output.

## Receipt Storage

Bucket: `payment-receipts`

Expected controls:
- private bucket
- max 5 MB
- `image/jpeg`, `image/png`, `application/pdf`
- client path starts with their Auth user ID
- admin receives only short-lived signed URLs for review

## Google Drive links

Drive URLs are treated as delivery references, not as authorization by themselves.

The API only returns a link when:
- the deliverable belongs to a project owned by the authenticated client; and
- `client_visible` is not false.

The Google Drive file/folder itself should also have appropriate sharing permissions. Avoid publishing confidential project folders to "Anyone on the internet" unless intentionally required.

## Admin catalog

Catalog write policies are admin-only. Online clients/anonymous users may only read active catalog rows when Shop is enabled later.

## Public Workspace bundle

Production `workspace/index.html` intentionally does not embed the historical Payment Tracker client dataset. Client/project data must come from protected Supabase or existing browser localStorage behind the auth gate during migration.

## Recommended prelaunch settings

- Enable email verification for new future-client sign-ups.
- Configure Supabase SMTP/custom email sender when ready.
- Configure Auth password policy >= 10 characters.
- Configure CAPTCHA/Turnstile before opening self-service sign-up broadly.
- Enable Supabase database backups/PITR according to plan availability.
- Use separate Vercel Production and Preview environment variables.
- Keep preview URLs out of search indexing.
- Test account recovery before launch.
- Periodically rotate service/API credentials.
