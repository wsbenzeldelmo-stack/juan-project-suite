# JUAN PROJECT Suite V1

A deployment package with **two separate frontends using one shared Supabase backend**:

- **JUAN PROJECT Workspace** — admin / seller side (`workspace/`)
- **JUAN PROJECT Online** — client + future-client side (`online/`)
- **Supabase** — one PostgreSQL/Auth/Storage project (`supabase/`)

The database is **not recreated**. The included SQL is additive and extends the existing Workspace data model.

## V1 scope

### JUAN PROJECT Workspace
- Secure Supabase Auth admin gate
- Existing Workspace retained as the business authority
- `JP-###` project display numbering and `CL-###` client numbering support
- Two-column Project Data UI
- Deliverable-based project progress
- Current-project progress bars
- Simplified seller Shop tables
  - Services: Name / Category / Description / Price / Actions
  - Packages: Package Name / Package Inclusions / Original Price / New Price / Actions
  - **No Shop checkboxes or bulk selection**
- Modular payment monitoring
- Payment-history dates toward the end of the table
- Shared catalog synchronization to Supabase
- Existing local-only records can be migrated to cloud after secure admin sign-in
- Online Portal Control page for:
  - payment approval/rejection
  - Google Drive delivery links
  - client payment QR/instructions

### JUAN PROJECT Online
- Email + password sign in
- Secure First Access flow for existing clients who do not yet have a password
- Future-client account creation
- Orders / project tracking
- Deliverable countdowns and progress
- Client-visible Google Drive delivery links
- Payment QR/instructions
- Private receipt upload (JPG/PNG/PDF, max 5 MB)
- Optional Gemini receipt extraction
- Client reviews extracted payment details before submission
- Payment submission remains **Pending Approval** until Workspace approval
- Invoice view using the same project/items/payments source
- Password change
- Shop navigation included as **Coming Soon** for V1

## Shared data model

Both apps use the same Supabase project. They do not maintain separate client/project/payment/catalog databases.

```text
                       ONE SUPABASE PROJECT
                               │
                ┌──────────────┴──────────────┐
                │                             │
        JUAN PROJECT Workspace        JUAN PROJECT Online
         Admin / Seller                   Client
                │                             │
                └──────────────┬──────────────┘
                               │
        Clients ─ Projects ─ Project Items ─ Deliverables
                      │               │
                      │               └─ client-visible Drive link
                      │
                      ├─ Payments
                      ├─ Payment Submissions
                      └─ Invoice data

        Catalog Categories / Services / Packages
                    ↑ Workspace manages
                    ↓ Online will browse later
```

## Before deploying

1. **Back up the current Supabase database.**
2. If the current Workspace has records that exist only in browser localStorage, also export/retain its existing backup before changing domains or clearing browser storage.
3. Use a Supabase development branch/project first if your live schema differs from the current Workspace schema.
4. Do not commit `.env` files.

## 1. Apply Supabase migrations

In Supabase **SQL Editor**, run these in order:

```text
supabase/migrations/001_shared_database_foundation.sql
supabase/migrations/002_updated_at_triggers.sql
supabase/migrations/003_shared_sync_security.sql
supabase/migrations/004_catalog_workspace_sync.sql
```

Then:

1. Create the Workspace admin account in **Authentication > Users**.
2. Edit `supabase/bootstrap_admin.sql` and replace `YOUR_ADMIN_EMAIL@example.com`.
3. Run `bootstrap_admin.sql`.
4. Optional: edit/run `supabase/seed/002_payment_method_example.sql`.
5. `001_catalog_seed.sql` is optional. Usually skip it if the Workspace already has a catalog: on first authenticated load, Workspace can bootstrap its current local catalog into the shared catalog tables if the cloud catalog is empty.
6. Run `supabase/verify_installation.sql` to inspect the expected tables/functions after setup.

### Important schema expectation

The supplied Workspace uses text-compatible business IDs (`client_...`, legacy IDs, project IDs) while exposing standardized `CL-###` and `JP-###` display codes. The migrations preserve those primary IDs and add display-code/auth/portal fields rather than replacing the existing keys.

## 2. Configure Supabase Auth URLs

In **Authentication > URL Configuration**:

- Set the Site URL to the production JUAN PROJECT Online URL.
- Add both Online and Workspace domains to allowed Redirect URLs.
- Add Vercel preview URLs during testing if needed.

Recommended production naming:

```text
JUAN PROJECT Online
https://online.your-domain.com

JUAN PROJECT Workspace
https://workspace.your-domain.com
```

## 3. Deploy JUAN PROJECT Workspace to Vercel

Create a Vercel project and set its **Root Directory** to:

```text
workspace
```

Environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SERVICE_ROLE_OR_SECRET_KEY
```

Deploy, then sign in using the admin account added to `user_roles`.

The deployed Workspace now requires a valid Supabase admin session before cloud business data is shown. Historical client/payment datasets are **not embedded into the public HTML bundle**.

### Existing local-only Workspace data

After authenticated load, the Workspace compares the protected database with browser-local clients/projects. Records that exist locally but not in the database are migrated to the shared database. This is intended as a bridge for the old offline-first Workspace.

Still keep a backup before first production migration.

## 4. Deploy JUAN PROJECT Online to Vercel

Create a second Vercel project and set its **Root Directory** to:

```text
online
```

Environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SERVICE_ROLE_OR_SECRET_KEY
ONLINE_PUBLIC_URL=https://online.your-domain.com
GEMINI_API_KEY=OPTIONAL_FOR_RECEIPT_READING
```

`SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are used only by server functions. Never place them in browser JavaScript.

## 5. Existing-client First Access

```text
Client opens JUAN PROJECT Online
        ↓
First Access / Set Password
        ↓
Enter Workspace email
        ↓
Server checks for an existing client without revealing account existence publicly
        ↓
Supabase sends a secure email link
        ↓
Verified client signs in
        ↓
Create password
        ↓
Auth user is linked to the existing client through portal_accounts
```

A client password is never stored in the `clients` table.

## 6. Future-client sign-up

A future client can create an Online account with name, email, and password. On the first authenticated portal request, the backend links to an existing matching client record or creates one if no matching client exists.

The user may initially have no projects. When Shop/checkout is enabled later, the same client record and shared catalog are reused.

## 7. Payment flow

```text
Client scans payment QR
        ↓
Pays externally
        ↓
Uploads receipt
        ↓
Optional Gemini extraction
        ↓
Reference / amount / date / method are prefilled
        ↓
Client reviews fields
        ↓
Submit Payment
        ↓
PENDING
        ↓
Workspace admin reviews receipt
        ↓
APPROVE ──> canonical payments table updated
REJECT  ──> no financial totals are changed
```

The approval database function locks the submission and checks the live project balance to reduce double-credit/overpayment risk.

## 8. Google Drive delivery

In Workspace, open:

```text
/online-control.html
```

Use **Delivery Links** to paste a Google Drive URL on a deliverable and choose whether it is visible to the client. JUAN PROJECT Online only returns links belonging to the authenticated client's own project.

## 9. Shared Shop catalog

Workspace is the catalog authority.

On authenticated Workspace load:

- if the shared catalog already contains products, it is loaded into Workspace;
- if the cloud catalog is empty, the current Workspace catalog is uploaded;
- future edits to categories, services, packages, inclusions, active state, and prices synchronize back to the shared catalog tables.

Online V1 intentionally still displays **Shop — Coming Soon**. The shared data is already ready for the later browse/cart/checkout phase.

## 10. Security requirements before public launch

Verify all of the following:

- [ ] Admin user has `user_roles.role = admin`.
- [ ] Workspace cannot be used without an authenticated admin session.
- [ ] Client A cannot read Client B's projects, payments, submissions, or delivery links.
- [ ] Anonymous users cannot access private project/payment/receipt data.
- [ ] Client cannot approve a payment.
- [ ] Client cannot modify seller prices/catalog.
- [ ] Receipt bucket is private.
- [ ] Receipt types are restricted to JPG/PNG/PDF.
- [ ] Receipt size is limited to 5 MB.
- [ ] Gemini key is not exposed in browser source/network configuration responses.
- [ ] Supabase service/secret key is not exposed in browser source/network configuration responses.
- [ ] Persistent endpoint rate limits work after migration 003.
- [ ] First Access gives a generic response whether an email exists or not.
- [ ] Google Drive links are only returned through owned projects.
- [ ] Two separate test-client accounts pass isolation tests.
- [ ] Production backup + rollback plan exists.

See `docs/PRODUCTION_SECURITY.md` and `docs/QA_CHECKLIST.md`.

## 11. V1 intentionally does not include

- Live Shop checkout
- Automated payment approval
- Payment gateway/webhooks
- Messaging/chat
- Native Android/iOS packaging
- Automatic Google Drive uploads

These can be added without creating a second database.

## Local development

These apps use `/api/*` server functions. Use Vercel CLI for complete local behavior:

```bash
cd online
npm install
vercel dev
```

and separately:

```bash
cd workspace
npm install
vercel dev
```

Static HTML can be opened for visual inspection, but authentication, receipt reading, payment approval, and protected portal data require the server routes.

## Build verification

From the suite root:

```bash
bash scripts/verify-build.sh
```

This checks JavaScript syntax, required deployment files, and confirms the packaged Workspace contains no embedded Payment Tracker client dataset.
