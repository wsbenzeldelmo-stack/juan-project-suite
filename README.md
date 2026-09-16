# JUAN PROJECT Platform V1.3.3.2

JUAN PROJECT Platform combines **JUAN PROJECT Workspace** (admin/seller) and **JUAN PROJECT Online** (client portal) on one shared Supabase database.

## V1.3.3.2 focus

This release changes Workspace database startup to **manual connection**, keeps Workspace usable with local/cache data when disconnected, simplifies Payment Reviews, fixes the first-open Online flow, and applies the authoritative Client ID mapping used for Online accounts.

### Workspace
- Opens in **Offline / Local** mode. It does not auto-connect to Supabase.
- Settings → Database Connection provides Supabase URL + Publishable Key, Test Connection, Connect Database, and Disconnect.
- Service-role/secret keys remain server-side and are never entered in the browser.
- Cached/local data remains viewable while disconnected; supported edits are queued for later sync.
- Reports retain crash-safe normalization and a compact data-viewing layout.
- Payment Reviews table: Project, Amount, Bank / E-Wallet, Status, Date Submitted, and ⋮ actions.
- Payment Review decisions are handled from the ⋮ menu: Approve Request, Reject Request, Delete Request.

### JUAN PROJECT Online
- First open starts with the 3-slide onboarding, then Guest Mode.
- Returning users without a remembered account open directly in Guest Mode.
- A remembered valid client session can restore the client portal.
- Protected features invite an existing client to Log In; there is no public sign-up.
- Initial password for a provisioned client account is the client's `CL-###` Client ID. First login requires a password change.
- The first useful UI paints before network calls, avoiding the long blank white startup screen.
- Logged-in clients with a balance can receive a dismissible friendly payment reminder.

## Database update
Run `supabase/migrations/012_platform_v1_3_3_2.sql` after migrations 001–011.

After the migration:
1. Open Workspace → Settings → Database Connection → **Connect Database**.
2. Log in with the Workspace admin account when prompted.
3. Open Online Portal → Client Access → **Sync Client Accounts** to create missing accounts and align temporary accounts with their current Client IDs.

Do not reset passwords for clients who have already changed their temporary password; the provisioning workflow preserves activated passwords.


## Client ID Identity Lock Patch

This package includes migration `013_client_id_identity_lock.sql`. Historical IDs stay CL-001..CL-046; the next new unique client is CL-047. Duplicate projects/emails reuse the original lifetime Client ID, including archived clients.
