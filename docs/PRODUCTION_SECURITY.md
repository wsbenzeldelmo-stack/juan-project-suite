# JUAN PROJECT Suite V1.1 — Production Security

## Account provisioning

- No public Sign Up / Create Account / First Access flow.
- Admin creates/provisions client Auth accounts server-side.
- Temporary password is the current `CL-###` for newly provisioned accounts.
- The temporary password is never stored in `clients` or exposed through public APIs.
- `password_set=false` forces a password change before protected Online use.
- Activated passwords are preserved during batch provisioning.

## Secrets

Never expose:

- `SUPABASE_SECRET_KEY` / service-role key
- `GEMINI_API_KEY`

Only publishable/anon Supabase credentials may be returned to browser code.

## Authorization

Client ownership must be checked server-side for:

- projects
- deliverables
- invoices
- payments
- payment submissions
- project Drive URLs

Do not trust a client-supplied project/client ID without verifying it belongs to the authenticated portal account.

## Payment receipts

- Storage bucket remains private.
- Client uploads are scoped to the authenticated user.
- Admin receives short-lived signed receipt URLs.
- Accepted files: JPG/JPEG/PNG/PDF, max 5 MB.
- Gemini extraction is server-side and advisory only.
- Payment remains Pending until admin approval.

## Client provisioning safety

Batch creation:

- skips invalid email addresses
- reports duplicate emails
- never converts admin accounts to client accounts
- never resets already activated portal passwords
- is safe to run again

## Client IDs

V1.1 archives clients instead of hard-deleting them through Workspace. This preserves the lifetime Client-ID sequence and prevents IDs from being reused.

## Google Drive

V1.1 exposes only the authenticated client's own `projects.drive_url` values. Sharing permissions in Google Drive must still be configured correctly by the admin.
