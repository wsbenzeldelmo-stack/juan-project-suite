# JUAN PROJECT V1.3.3.2 — Requested Data Flow Patch

- Package order items expand into individual deliverables and persist package/source linkage.
- Client Access now uses the active Client Directory as its source, so clients such as CL-012 are not hidden solely because they lack a project link.
- Client edits synchronize project snapshots and request portal-account reconciliation.
- Approved Workspace/Online brand assets and app icons are used consistently.
- Email fields suggest @gmail.com and @deped.gov.ph.
- Phone number and location/address are optional, including legacy database rows.
- Online Portal Client Access table removes the Client Name column.
- Shop service table uses fixed full-width columns without internal scrolling/blank spacer area.
- Migration: supabase/migrations/012_client_portal_deliverables_integrity.sql
