# JUAN PROJECT Platform V1.3.3.2

Stability and navigation update after V1.3.3.1.

## Included
- Payment Reviews now use direct `⋮` actions: Approve Request, Reject Request, Delete Request.
- The large Review Payment modal was removed; rejection uses a small reason/note dialog only.
- Payment Reviews retain Project, Amount, Bank / E-Wallet, Status, Date Submitted, and the action menu.
- JUAN PROJECT Online now starts with the 3-slide onboarding, then Guest Mode; Log In is requested only for protected client features.
- Added a missing Online Home renderer that previously caused the client site to fail at runtime.
- Client portal load failures now offer Try Again, Browse as Guest, and Log Out instead of trapping the user on Login.
- Invoice JUAN PROJECT brand SVG width was corrected so the final “T” cannot be clipped.
- Reports were redesigned into a compact data-viewing page with a period filter, core KPIs, one revenue chart, payment status, outstanding projects, recent payments, and workspace health while preserving crash isolation.

No new Supabase migration is required for V1.3.3.2. Existing migration 011 from V1.3.3 remains required.
