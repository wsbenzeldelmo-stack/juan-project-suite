# JUAN PROJECT Suite V1.1

JUAN PROJECT Suite has two frontends backed by **one shared Supabase project**:

- `workspace/` — JUAN PROJECT Workspace, seller/admin side
- `online/` — JUAN PROJECT Online, client side
- `supabase/` — additive migrations, verification SQL, and seeds

V1.1 is a full-suite patch. It preserves the existing business database and updates account provisioning, Online Portal administration, project delivery links, and the JUAN PROJECT Online UI/UX.

## V1.1 highlights

### Workspace

- Online Portal controls are integrated into the main Workspace navigation.
- The old `/online-control.html` now redirects to `/#online-portal`.
- Integrated Online Portal tabs:
  - Client Accounts
  - Payment Reviews
  - Delivery Links
  - Payment Setup
- Admin-only **Create Missing Accounts** batch action.
- New clients are provisioned for Online automatically when possible.
- New-order flow reuses an existing client when the entered email already belongs to a saved client.
- Client removal is changed to archive behavior so lifetime Client IDs are not reused.
- Google Drive delivery is managed **one link per project**.

### Client IDs

`CL-###` tracks **unique clients**, independently from `JP-###` projects.

- Client IDs are gapless after the V1.1 migration.
- IDs are ordered by the client's first recorded project.
- Repeat projects do not generate new Client IDs.
- New unique clients receive the next Client ID.
- Valid archived clients keep their Client ID so the lifetime client count is preserved.
- Obvious spreadsheet placeholder rows such as a literal `Name` row are archived and excluded from the client counter.

The legacy reference derived from the supplied current tracker is stored at:

```text
docs/LEGACY_CLIENT_SEQUENCE_V1_1.csv
```

### Client account model

There is **no public Sign Up / Create Account / First Access** flow.

For a newly provisioned client:

```text
Login email        = client's registered email
Temporary password = Client ID, e.g. CL-017
```

The temporary password exists only in Supabase Auth. It is never stored in the public `clients` table.

First login flow:

```text
Email + temporary CL-### password
        ↓
Change Your Password
        ↓
portal_accounts.password_set = true
        ↓
normal Online access
```

Batch provisioning is idempotent and does not reset activated client passwords. Accounts still in temporary-password state may be synchronized to their current Client ID after the V1.1 Client ID resequence.

### JUAN PROJECT Online

The approved UI storyboard is included at:

```text
docs/reference/JUAN_PROJECT_ONLINE_UI_REFERENCE.png
```

It is the strict visual reference for the Online app.

Online V1.1 includes:

- Welcome
- two-step onboarding
- Sign In
- forced first-login password change
- client Dashboard
- My Projects
- Project Details
- Payment
- Invoice
- Settings
- guest-accessible Shop
- standardized Sign In Required modal for protected pages

Guests may browse Home and Shop. Projects, payments, invoices, settings, and private project files require authentication.

### Shop

Online Shop uses the **same shared catalog managed by Workspace**.

The V1.1 Online Shop is intentionally simple:

- no product thumbnails
- compact text-only rows
- search
- All / Services / Packages / Tutorials filters
- title, category, short description, price, View action

There is no second Online catalog database.

### Project Google Drive links

V1.1 changes delivery-link ownership to:

```text
Client
├── JP-001 → Drive folder A
├── JP-004 → Drive folder B
└── JP-009 → Drive folder C
```

One URL belongs to one project. Repeat clients may therefore have different Drive folders for different projects.

### Payment

Payment remains approval-based:

```text
Client uploads receipt
        ↓
Pending
        ↓
Workspace → Online Portal → Payment Reviews
        ↓
Approved / Rejected
```

Only approved payments affect Amount Paid, Balance Due, revenue, and canonical payment history.

The bundled UnionBank asset is:

```text
online/assets/unionbank-bankqr-placeholder.jpg
```

It is packaged byte-for-byte from the supplied bank QR image. Leave the Payment Setup QR URL blank to use this bundled file.

## Required migration for V1.1

Back up Supabase first. Then run the existing migrations if they are not already installed:

```text
001_shared_database_foundation.sql
002_updated_at_triggers.sql
003_shared_sync_security.sql
004_catalog_workspace_sync.sql
```

For this update, run:

```text
supabase/migrations/005_suite_v1_1.sql
```

Then run:

```text
supabase/verify_v1_1.sql
```

Migration 005:

- adds `projects.drive_url`
- adds `clients.archived_at`
- adds `portal_accounts.portal_enabled`
- backfills project Drive URLs where an older project had exactly one visible deliverable Drive URL
- resequences valid Client IDs gaplessly by first project
- updates future Client-ID allocation

## After migration

Deploy/push the updated suite, sign in to Workspace, and open:

```text
Online Portal → Client Accounts
```

Click:

```text
Create Missing Accounts
```

Review the result summary. Records with missing/invalid emails or duplicate emails are not silently provisioned.

## Environment variables

### Workspace

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

### Online

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
ONLINE_PUBLIC_URL
GEMINI_API_KEY    # optional, receipt reading only
```

Never expose the Supabase secret/service key or Gemini API key in browser JavaScript.

## Deployment

The architecture remains unchanged:

```text
GitHub: juan-project-suite
        │
        ├── workspace/ → Vercel Workspace project
        └── online/    → Vercel Online project
                         │
                         └── SAME Supabase project
```

## Local/build verification

From the suite root:

```bash
bash scripts/verify-build.sh
```

Expected output:

```text
JUAN PROJECT Suite V1.1 verification passed.
```

## Recommended deployment order

1. Export/backup the current Supabase database.
2. Run `005_suite_v1_1.sql`.
3. Run `verify_v1_1.sql`.
4. Apply this code patch locally.
5. Run `bash scripts/verify-build.sh`.
6. Commit and push to GitHub.
7. Wait for Workspace and Online Vercel deployments to become Ready.
8. Workspace → Online Portal → Client Accounts → Create Missing Accounts.
9. Test one past client with their email + current `CL-###` temporary password.
10. Confirm first login forces Change Password.
11. Verify Client A cannot access Client B's data.
12. Verify project Drive URLs and payment approval.

See `docs/QA_CHECKLIST.md`, `docs/PRODUCTION_SECURITY.md`, and `docs/ARCHITECTURE.md` for more detail.
