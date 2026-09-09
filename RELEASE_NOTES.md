# JUAN PROJECT Suite V1.1 — Release Notes

## Added
- Integrated Online Portal management inside the main Workspace.
- Client Accounts administration and batch account provisioning.
- Portal enable/disable and forced password-change controls.
- Project-level Google Drive URL management.
- V1.1 Supabase migration and verification SQL.
- Strict JUAN PROJECT Online UI reference packaged under `docs/reference/`.
- Legacy unique-client sequence reference from the latest tracker.
- Online Shop search and compact category filters.

## Changed
- Client IDs are resequenced as gapless unique-client IDs, independent from project IDs.
- New client creation reuses an existing client when the email already exists.
- Client removal is now archive behavior so Client IDs are not reused.
- Public Sign Up / Create Account / First Access is disabled.
- Client login is email + temporary Client ID password for newly provisioned accounts.
- First login requires a password change.
- Online project files now use one Google Drive link per project.
- Online Shop uses the shared Workspace catalog and the approved no-image mobile layout.
- Legacy `/online-control.html` redirects to the integrated Workspace module.

## Preserved
- One Supabase database for Workspace and Online.
- Canonical Workspace invoice/payment calculations.
- Pending client payments do not affect financial totals until approved.
- Private receipt storage and signed receipt review links.
- Existing activated client passwords are not reset by batch provisioning.
- UnionBank QR asset is preserved byte-for-byte.
