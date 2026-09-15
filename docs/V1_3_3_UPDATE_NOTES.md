# JUAN PROJECT Platform V1.3.3

V1.3.3 is a stability, synchronization, offline-resilience, payment-review, invoice, and client-experience release for JUAN PROJECT Workspace, Workspace Mobile, and JUAN PROJECT Online.

## Stability and shared data

- Supabase remains the authoritative source of truth for business records.
- Workspace keeps a local cache and an offline sync queue so supported edits can be made while disconnected and synced when internet access returns.
- Project Data autosave distinguishes `Saving`, `Saved`, `Saved offline`, `Syncing`, and sync-failure states.
- Local-only records from older builds are migrated to Supabase when possible instead of being silently replaced by cloud data.
- Project `Completed` / `Delivered` state is persisted with `delivery_status`, `archived_at`, and `updated_at`, preventing delivered projects from reappearing as current after reload or cross-device sync.
- Reports normalize legacy project/payment arrays and use a guarded renderer with a retry state so malformed records cannot crash the whole Workspace.

## Payment Reviews

- The Payment Reviews table is intentionally compact: Project, Amount, Bank / E-Wallet, Status, and a vertical `…` action menu.
- Client identity and full payment details are shown only in the Review Payment modal.
- Review statuses are `Pending`, `Accepted`, and `Rejected`.
- The modal includes receipt preview, current balance, system verification, searchable rejection reason, optional client note, and Accept / Reject actions.
- NULL / incomplete legacy submissions are blocked with an actionable verification message instead of being sent to the approval RPC.
- Migration 011 makes accepted-payment insertion NULL-safe for legacy `payments.id` schemas that have no default.

## Bank / e-wallet sender list

The V1.3.3 selector exposes only:

1. BDO Unibank
2. GCash
3. Bank of the Philippine Islands (BPI)
4. Maya
5. Metrobank
6. Landbank
7. UnionBank
8. Philippine National Bank (PNB)
9. Others

Uploaded logo assets are used in rounded 1:1 tiles with institution-aware backgrounds. Legacy GoTyme and MariBank/SeaBank sender codes remain accepted only for old pending submissions so historical reviews are not broken.

Reference validation remains sender-specific. PNB and Others use the generic 14–15 digit InstaPay trace fallback supplied for the project.

## Invoice

- Invoice wordmark is always `JUAN PROJECT` in Workspace and Online.
- The same invoice calculation hierarchy is used on both surfaces.
- System Maintenance Fee rule: positive subtotal ending in `99` = ₱26; otherwise = ₱25.
- Workload Surcharge remains included in the displayed Rush Fee.
- Additional Fees are shown transparently and never silently folded into Total.
- Balance Due styling reflects Paid, Partially Paid, Unpaid, or Overdue state.
- Workspace and Online support PDF/print and PNG image export.

## JUAN PROJECT Online

- Mobile-first sizing, safe areas, larger touch targets, and rounded-system typography are applied.
- Three 9:16 onboarding slides cover app function, login, and adding JUAN PROJECT Online to Android/iPhone home screens.
- Project status, payment status, invoices, deliverables, delivery status, and files are loaded from the shared database.
- Delivered projects stop appearing as In Progress.
- Clients can upload a private profile photo.
- Balance reminders and one-time thank-you messages use friendly client-facing language.

## Database migration

Run `supabase/migrations/011_platform_v1_3_3.sql` after migrations 001–010.
