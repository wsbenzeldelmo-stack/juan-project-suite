# V1.3.3.2 Update Notes

This release changes Workspace from automatic database startup to explicit manual connection while preserving local/offline access. It also repairs JUAN PROJECT Online startup routing and restores its missing Home/Guest Mode renderer.

### Workspace startup
1. Load local/cached records.
2. Render Workspace immediately as `Offline / Local`.
3. User optionally opens Settings → Database Connection.
4. User tests and connects using Supabase URL + public publishable key.
5. Admin authentication is requested only when cloud data is requested.
6. Successful connection loads and merges shared Supabase data.

### Online startup
- First open → onboarding.
- Finish/skip onboarding → Guest Mode.
- Returning guest → Guest Home immediately.
- Returning authenticated client → Guest-safe first paint, then client portal after session/data hydration.
- Portal load failure never traps the user on a blank/login screen.
