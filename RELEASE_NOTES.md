# JUAN PROJECT Platform V1.2 — Release Notes

## Workspace UX
- Reorganized primary navigation hierarchy.
- Standardized navigation icons, page headers, descriptions, controls, and interaction spacing.
- Added stronger new-order inline validation and consistent email validation.
- Added processing feedback for major actions.
- Improved empty-state guidance and Business Snapshot presentation.
- Added optional project Drive unlock/expiry controls inside Online Portal → Delivery Links.

## Online UX
- Redesigned Online as a mobile-first client portal.
- Added three-step onboarding.
- Improved Log In validation, show/hide password, loading, and password-change completion states.
- Added focused Home dashboard with Active Project, Next Action, and Recent Activity.
- Rebuilt project details around a vertical Order Tracker and deliverables checklist.
- Added real Locked / Available / Expired project-folder states.
- Improved Payment summary, Gemini verification messaging, manual fallback, processing, and confirmation.
- Redesigned Shop into a compact service storefront with shared catalog data.
- Standardized Account and Invoice mobile experience.

## Database
- Added migration `007_platform_v1_2.sql` for optional `drive_unlock_at` and `drive_expires_at` project fields.
- No destructive migrations.

## Compatibility
- Existing Workspace and Online deployments stay separate.
- Existing Supabase project remains the single source of truth.
- Existing UnionBank QR asset is unchanged.
