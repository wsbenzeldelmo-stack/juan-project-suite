# JUAN PROJECT Platform V1.3.3.1 Stability Hotfix

This hotfix addresses the three live failures reported after V1.3.3:

- Reports no longer depends on fragile legacy helpers or animated chart calculations. Malformed legacy records are normalized and isolated instead of crashing Workspace.
- Review Payment modal is flex-based with a scrollable body and persistent action footer so Cancel / Reject / Approve Payment never disappear below the modal. Verification rows use a single safe column to prevent clipped Passed badges.
- JUAN PROJECT Online now keeps guest browsing available even if Supabase auth/config is temporarily unavailable, loads catalog independently, uses a fresh service-worker cache, and the portal API tolerates databases where newer optional columns have not yet been added.
- Catalog API falls back to the public Supabase client when a service-role key is unavailable.

Database: no new migration. Keep migrations through 011_platform_v1_3_3.sql applied. Migration 011 is still required for the NULL-safe Payment Review approval function.
