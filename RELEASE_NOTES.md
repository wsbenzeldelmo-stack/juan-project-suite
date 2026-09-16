# JUAN PROJECT Platform V1.3.3.2

## Workspace
- Removed automatic database connection at startup.
- Workspace remains usable with local/cached records even when Supabase is disconnected.
- Added manual Supabase URL + Publishable Key connection controls in Settings.
- Added local-mode banner and explicit connection states.
- Simplified and hardened Reports rendering.
- Payment Reviews now use direct `⋮` actions: Approve Request, Reject Request, Delete Request.

## JUAN PROJECT Online
- Fixed blank/white startup by rendering onboarding or Guest Mode before network hydration.
- Restored missing Home/Guest Home route.
- First open: onboarding → Guest Mode → Log In only when needed.
- Added client-portal load recovery screen.
- Balance reminder is the only automatic client popup and is dismissible.
- Fixed invoice `JUAN PROJECT` branding clipping.
- Bumped service-worker cache to force fresh assets.

## Database
No new migration in this release.
