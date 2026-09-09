# JUAN PROJECT Platform V1.2

JUAN PROJECT Platform is one connected business system with two interfaces backed by the same Supabase project:

- `workspace/` — **JUAN PROJECT Workspace**, seller/admin operations
- `online/` — **JUAN PROJECT Online**, mobile-first client portal
- `supabase/` — shared data, security, and additive migrations

V1.2 is a coordinated UX update. It does **not** create a second database or duplicate client/project/payment/catalog records.

## V1.2 focus

### JUAN PROJECT Workspace

- clearer navigation hierarchy grouped into Work, Finance, Operations, and System
- **New Order** is visually treated as a primary action instead of another equal-priority destination
- one consistent line-icon language across main navigation
- standardized page header, description, toolbar, filter, form, table, and modal treatment
- more consistent inline validation for critical new-order fields and email inputs
- visible processing states for important save/create/payment/export actions
- improved empty states and clearer operational copy
- decision-focused Business Snapshot styling
- Online Portal remains integrated into Workspace
- Delivery Links now support optional **Unlock** and **Expiry** timestamps for one Google Drive folder per project

### JUAN PROJECT Online

V1.2 reframes Online as a standard mobile-first client portal with five consistent destinations:

```text
Home
Orders
Payment
Shop
Account
```

Key changes:

- three-screen value-led onboarding
- **Log In** terminology; no public Sign Up/Create Account/First Access
- inline email/password validation and generic wrong-credential feedback
- show/hide password controls
- clearer first-login password-change flow and success state
- Home emphasizes Active Project, Next Action, and Recent Activity
- Order Tracker uses a vertical parcel-style project journey
- deliverables checklist lives under the tracker
- project folder always appears at the bottom of Order Tracker with Locked / Available / Expired states
- one Google Drive URL remains attached to one project
- payment page has project total, amount paid, balance due, secure receipt verification, processing, and confirmation states
- Gemini-read payment fields remain locked unless Gemini is unavailable/rate-limited
- Shop is a compact mobile storefront with search, service IDs, and price sorting
- Account page uses grouped client-portal settings
- invoice remains a JUAN PROJECT document and supports Save / Print from mobile
- lightweight activity/notification sheet

## Shared business rules preserved

- one Supabase project
- one clients table
- one projects table
- one payment source of truth
- one catalog managed from Workspace
- one invoice/calculation source of truth
- Client IDs remain unique-client counters
- project files are one Drive link per project
- payment submissions remain Pending until admin approval
- only approved payments affect Amount Paid / Balance Due / revenue
- UnionBank QR asset remains unchanged

## V1.2 migration

After backing up Supabase, run:

```text
supabase/migrations/007_platform_v1_2.sql
```

This adds only:

```text
projects.drive_unlock_at
projects.drive_expires_at
```

These fields are optional. Existing Drive links continue to work. If no unlock timestamp is set, a valid Drive link is immediately available. If no expiry timestamp is set, it does not automatically expire.

## Environment variables

No new environment variables are required.

Workspace:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Online:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
ONLINE_PUBLIC_URL
GEMINI_API_KEY
```

Keep Supabase secret/service credentials and Gemini keys server-side only.

## Deployment

The deployment architecture remains unchanged:

```text
GitHub repository
├── workspace/ → JUAN PROJECT Workspace Vercel project
└── online/    → JUAN PROJECT Online Vercel project

Both → same Supabase project
```

Run `scripts/verify-build.sh` before pushing.
