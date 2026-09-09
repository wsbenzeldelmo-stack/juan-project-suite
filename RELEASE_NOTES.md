# JUAN PROJECT Suite V1 — Release Notes

## Naming
- **JUAN PROJECT Workspace** — admin/seller application
- **JUAN PROJECT Online** — client and future-client application

Both applications use the same Supabase project and the same business records.

## Included in this release

### Workspace
- Existing seller Workspace retained and production-gated with Supabase Auth.
- Standardized project/client display IDs.
- Approved simplified Shop table layout with no Shop checkboxes.
- Shared catalog synchronization to Supabase.
- Deliverable/project synchronization for Online tracking.
- Online Portal Control for payment review, Drive links, and payment setup.
- Local-only legacy migration bridge after secure admin login.
- Public HTML no longer embeds historical Payment Tracker client records.

### Online
- Sign in / secure First Access / future-client sign-up.
- Orders and deliverable tracking.
- Due countdowns.
- Admin-shared Google Drive links.
- Payments and private receipt upload.
- Optional Gemini receipt field extraction.
- Pending approval workflow.
- Invoice view.
- Password change.
- Shop placeholder for V1.

### Backend
- Additive Supabase migrations.
- Auth roles and portal-account mapping.
- RLS foundation.
- Private receipt Storage policies.
- Rate limiting.
- Atomic payment approval.
- Stable future `CL-###`, `JP-###`, `SRV-###`, and `PKG-###` support.

## Not yet enabled
- Online Shop/cart/checkout.
- Messaging.
- Automated payment gateway.
- Auto-approved AI payments.

The database structure is already designed so these can be added without creating another database.
