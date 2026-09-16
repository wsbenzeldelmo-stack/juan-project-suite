# Apply the V1.3.3.2 NPW Patch

## Required deployment order

1. Deploy the patched Workspace and Online code.
2. In Supabase SQL Editor, run migrations in order through `013_client_id_identity_lock.sql` if they have not already been applied.
3. Run `supabase/migrations/014_platform_v1_3_3_2_npw_patch.sql` **once**.
4. Open Workspace. It should start as **Offline / Local**.
5. Go to **Settings → Database Connection → Log In & Connect** and sign in with the existing JUAN PROJECT admin account.
6. Confirm cloud data loads.
7. Open **Online Portal → Client Access** once while signed in as admin. The client master mapping is reconciled automatically and versioned so refreshes do not repeat the password initialization.
8. Client initial login is their mapped email + Client ID as the temporary password. The portal requires a password change after login.

## Existing Vercel environment

Keep the existing deployment variables. Workspace no longer shows a database URL/key form. The browser-facing app uses the deployment's public/publishable Supabase configuration; the service-role key stays server-side only.

Expected variables from the existing platform setup include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` / publishable client key used by the existing configuration endpoint
- `SUPABASE_SERVICE_ROLE_KEY` for server API actions only

Never place the service-role key in client JavaScript, HTML, or a browser form.

## Refresh / inactivity behavior

After the first explicit admin connection, refreshes restore the cloud session. Workspace ends the cloud session after 30 minutes with no user activity, or immediately when Disconnect is chosen.

## Historical maintenance-fee correction

Migration 014 removes an injected ₱25/₱26 maintenance fee only from projects that were already fully paid before that fee was added. It does not erase the fee from genuinely unpaid projects.

## Verification

From the project root:

```bash
bash scripts/verify-build.sh
```

Expected result:

```text
JUAN PROJECT Platform V1.3.3.2 Client Master UI patch verification passed.
```
