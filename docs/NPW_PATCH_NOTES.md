# JUAN PROJECT Platform V1.3.3.2 — NPW Patch Notes

This patch keeps V1.3.3.2 and updates the Workspace/Online startup, finance views, payment-review workflow, historical fee handling, bank support, and client portal account reboot flow.

## Workspace database connection

- Workspace starts in **Offline / Local** mode and paints available cached data immediately.
- The first cloud connection is always manual: **Settings → Database Connection → Log In & Connect**.
- No Supabase URL or publishable/anon-key input is rendered in Workspace Settings.
- Deployment configuration is read from the existing Vercel environment through the app's server configuration endpoint; the service-role key remains server-only.
- After a successful admin login, the existing Supabase auth session is restored on refresh so the user is not asked to log in again on every reload.
- The cloud session ends after **30 minutes without Workspace activity**. Manual Disconnect also ends it.
- If cloud restoration fails, Workspace stays usable with local/cache data instead of blocking the app.

## JUAN PROJECT Online startup

- Added the missing Home renderer that could previously stop startup routing and leave the page on a blank/boot state.
- Added immediate critical boot styling and a service-worker cache bump so the user sees a branded loading state instead of a long plain white page while modules load.
- No remembered client: **Onboarding → Guest Mode → Already a Client? Log In**.
- Remembered client with a valid saved session: restores the client portal.
- A stale remembered marker without a valid session returns to onboarding.
- After login, the payment reminder modal appears only when a project has a real balance greater than zero and no payment proof for that project is currently pending review. It can be dismissed with **Maybe Later**.

## Project/payment status logic

- A project is considered active while work is unfinished **or** its remaining balance is greater than zero.
- A delivered/completed project with an unpaid balance therefore remains Active.
- A project becomes non-active only after work is complete and the balance is settled.
- When there are no Active projects, the Projects filter automatically falls back to **All**.
- When there are no Pending payment records, the Payments filter automatically falls back to **All**.

## Reports / Revenue redesign

The Reports page now follows the supplied finance-dashboard reference with:

- Total Receivables
- Collected
- Outstanding
- This Month
- 6-month Revenue Trend line chart
- Payment Status donut for Paid / Partially Paid / Unpaid / Overdue
- Revenue Milestones
- Recent Payments table

## Historical ₱25 / ₱26 maintenance fee correction

Migration `014_platform_v1_3_3_2_npw_patch.sql` removes the V1.3.3 maintenance fee only when the historical project had already paid the full pre-fee total and the injected ₱25/₱26 is the only remaining amount. Projects with a genuine unpaid base balance keep the maintenance fee.

Workspace and Online now respect the stored `system_maintenance_fee` instead of re-injecting ₱25/₱26 into an already-settled historical project during rendering.

## Payment Review table

Payment Review uses these columns:

`Project ID | Project Name | Bank / E-Wallet | Ref ID | Status | Date Submitted`

Approve / Reject / Delete actions are inside the Status-cell action menu. The table also has a mobile layout that keeps labels readable without a horizontal-scroll dependency.

## Bank / e-wallet support

Added supplied logo assets and sender validation for:

- GoTyme Bank
- MariBank

Legacy `maribank-seabank` records remain readable for compatibility.

## Client ID mapping and portal-login reboot

The authoritative historical mapping is CL-001 through CL-046 from `docs/CLIENT_ID_MAPPING_V1_3_3_2.csv`. The migration re-applies those exact IDs by normalized email, including:

- `CL-025` → `villegasnathaniel10@gmail.com`

Future unique clients continue at **CL-047+**. Duplicate projects under the same normalized email continue using that email's lifetime Client ID.

After migration 014 is applied, open **Workspace → Online Portal → Client Access** once as admin. The Client Master patch performs a versioned one-time reconciliation for each mapped non-admin client account:

- sets the login email to the mapped client email,
- resets the temporary password to the Client ID,
- sets `password_set=false`, and
- requires the client to create a new password after login.

No mass reboot button is exposed. The master version marker prevents the automatic initialization from repeating after clients change their passwords.
