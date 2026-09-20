# JUAN PROJECT Platform V1.3.3.2

## New since the last deployed Payment Review layout hotfix

- Workspace starts locally and connects to Supabase only when the admin explicitly chooses **Connect Database**.
- Added Settings → Database Connection with URL, publishable key, connection test, connect, and disconnect controls.
- Preserved offline/local Workspace access and pending-sync behavior.
- Simplified Payment Reviews to a non-horizontal-scroll table with Project, Amount, Bank / E-Wallet, Status, Date Submitted, and ⋮.
- Removed the large Payment Review modal from the review flow. Approve / Reject / Delete live in the ⋮ menu; Reject uses a compact reason dialog.
- Preserved background/server payment verification and exact approval failure messages.
- JUAN PROJECT Online now starts with onboarding on first open, then Guest Mode. It no longer requires login before public browsing.
- Returning guests open directly to Guest Mode; remembered valid client sessions can restore in the background.
- Portal-load failures offer Try Again, Browse as Guest, and Log Out.
- Deferred Supabase startup and added an immediate boot shell to prevent a long blank white screen.
- Client initial password is the authoritative `CL-###` Client ID, followed by required first-login password change.
- Added the authoritative 46-client ID mapping supplied for this release and made future IDs allocate by MAX+1.
- Fixed invoice brand clipping so `JUAN PROJECT` is fully visible.
- Preserved the crash-safe simplified Reports renderer.


## Client ID Identity Lock Patch

This package includes migration `013_client_id_identity_lock.sql`. Historical IDs stay CL-001..CL-046; the next new unique client is CL-047. Duplicate projects/emails reuse the original lifetime Client ID, including archived clients.

## V1.3.3.2 NPW Patch

- Manual-first Workspace cloud connection with refresh persistence and a 30-minute inactivity sign-out.
- Removed database URL/key fields from Workspace UI.
- Fixed Online first-paint/startup routing and onboarding/guest/client flow.
- Added balance-only payment reminder modal.
- Corrected active-project semantics for unpaid delivered projects.
- Redesigned Reports / Revenue dashboard.
- Updated Payment Review columns and mobile behavior.
- Added GoTyme and MariBank assets/validation.
- Added migration 014 to re-assert CL-001..CL-046, continue CL-047+, and remove retroactive ₱25/₱26-only balances from already-settled historical projects.
- Added one-click client login reboot: initial temporary password = Client ID, then forced password change.

## Client Master + UI hotfix — 2026-09-16

- Prioritizes the uploaded CL-001–CL-046 email mapping for Client Directory and JUAN PROJECT Online. Existing client names are preserved because the source workbook does not include a name column.
- Portal temporary login details are initialized silently once per master-data version; no mass sync/reboot controls are shown in the UI.
- Revenue timeline selector, natural table sizing, top-layer action menus, Shop service column proportions, payment account spacing, and invoice wordmark fixes.


## 2026-09-20 — Unified Settings and Online Flow Update

- Restored segmented Workspace Settings with persistent keyboard-accessible section navigation.
- Removed the visible Command Center helper while keeping the keyboard shortcut; successful commands now close after execution.
- Fixed In-House Ads navigation so the existing campaign manager remains the source of truth.
- Fixed Recent Projects overflow and constrained Reports to a viewport dashboard with an internally scrollable Recent Payments area.
- Confirmed Client ID remains system-controlled in client editing; edit payloads do not expose or rewrite the client code.
- Simplified JUAN PROJECT Online guest entry, Shop categories, package-first ordering, cart presentation, requested-date guidance, and membership card details.
- Expanded client project tracking through the Delivered stage and aligned the Supabase tracker constraint to 0–7.
- Added browser notification delivery for live new-order/payment-submission events and foreground deadline reminders when permission is enabled.
- Passkey/biometric UI now accurately reports unavailable until the Supabase authentication runtime is upgraded; password fallback remains intact.
