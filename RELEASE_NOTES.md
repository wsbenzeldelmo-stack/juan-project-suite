# JUAN PROJECT Platform V1.3.3

## Stability

- Hardened Reports against malformed/legacy project and payment records.
- Added retry/error state instead of allowing Reports to crash Workspace.
- Added local offline edit queue with reconnect synchronization.
- Restored local-only-to-cloud migration on database load.
- Persisted Delivered/Completed project state to Supabase.

## Payment Reviews

- Simplified the main review table to Project, Amount, Bank / E-Wallet, Status, and `…`.
- Full details are shown in the Review Payment modal only.
- Added searchable rejection reasons, optional client note, receipt preview, and compact system checks.
- Kept Pending / Accepted / Rejected statuses.
- Fixed legacy NULL payment approval failures in migration 011.

## Payments / institutions

- Current selectable senders: BDO, GCash, BPI, Maya, Metrobank, Landbank, UnionBank, PNB, Others.
- Uses supplied sender logo assets and rounded contrast-aware tiles.
- Server and browser validation use the same sender-specific formats.

## Invoice

- Uses `JUAN PROJECT` branding on Workspace and Online invoices.
- Maintenance fee is ₱26 when a positive subtotal ends in 99; otherwise ₱25.
- Additional fees are shown transparently.
- Added/retained PDF and PNG export.
- Balance Due box is status-aware.

## Online

- Mobile-first touch sizing and responsive safe-area behavior.
- Updated 9:16 onboarding slides.
- Cloud-backed client profile photo.
- Shared delivery/payment/invoice state with Workspace.
- Friendly balance reminders and completed-and-paid thank-you message.

## Migration

- New migration: `supabase/migrations/011_platform_v1_3_3.sql`.
