# JUAN PROJECT Platform V1.3.3.2

Stability and startup hotfix for JUAN PROJECT Workspace and JUAN PROJECT Online.

## What changed

- Workspace now opens immediately in **Offline / Local** mode using the latest cached data.
- Supabase connection is **manual only** from Settings → Database Connection.
- Manual connection supports Test Connection, Connect Database, Disconnect, and Continue Offline.
- Reports uses a simpler crash-safe data view with summary, revenue trend, payment status, recent payments, and workspace health.
- Payment Reviews no longer use the large review modal. The vertical action menu now contains Approve Request, Reject Request, and Delete Request.
- Rejection uses a small searchable-reason dialog with an optional client note.
- JUAN PROJECT Online now paints immediately instead of waiting on network requests.
- First open starts with the 3-slide onboarding; after onboarding the user enters Guest Mode.
- Returning users without a remembered client session open Guest Mode; client-only features request Log In.
- A valid remembered client session opens the client portal after hydration.
- Client portal load failures offer Try Again, Browse as Guest, or Log Out.
- The missing Online `home()` route was restored.
- Balance reminder popup appears only for signed-in clients with a remaining balance and can be dismissed.
- Online invoice branding renders `JUAN PROJECT` as text so the final T cannot be clipped.

No new Supabase migration is required. Keep migrations through `011_platform_v1_3_3.sql` applied.
