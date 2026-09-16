# V1.3.3.2 Update Notes

## Manual database connection
Workspace no longer auto-connects to Supabase on startup. It renders local/cache data first and remains usable offline. Cloud data is loaded only after the admin opens Settings → Database Connection and explicitly connects.

A browser form accepts only the Supabase URL and publishable key. Service-role/secret credentials remain server-side.

## Client ID / portal login
`docs/CLIENT_ID_MAPPING_V1_3_3_2.csv` is the authoritative mapping for the historical client set supplied with this release. Migration 012 applies those IDs to matching existing client emails, moves unmatched active clients after CL-046, and changes future Client ID allocation to MAX+1.

Client portal username remains the registered email. The initial password for newly provisioned or still-temporary accounts is the current Client ID (for example `CL-006`). The client must change it on first login. Existing activated passwords are not overwritten by the migration.

After migration, use Online Portal → Client Access → **Sync Client Accounts**.

## JUAN PROJECT Online entry flow
- First open: 3-slide onboarding → Guest Mode.
- Returning guest: Guest Mode.
- Remembered valid client session: Guest shell appears first, then the portal can restore in the background.
- Protected actions prompt existing clients to Log In.
- Portal loading errors never trap the user; Guest Mode remains available.

## Payment Reviews
The main table is intentionally compact and non-scrollable horizontally:
`PROJECT | AMOUNT | BANK / E-WALLET | STATUS | DATE SUBMITTED | ⋮`

Pending rows expose Approve Request, Reject Request, and Delete Request through the ⋮ menu. Rejection uses a compact reason dialog. Approval still runs server-side verification before recording a payment.

## Reports
Reports continue to normalize legacy/malformed project and payment records before calculation. A bad record produces a retryable Reports error state instead of stopping Workspace.
