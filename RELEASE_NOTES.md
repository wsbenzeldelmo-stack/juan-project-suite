# JUAN PROJECT Platform V1.3.2

- Shared Supabase source of truth for Workspace profile/settings, projects, clients, payments, and Online Portal records.
- Skeleton loading state for Workspace cloud data.
- Searchable sender bank/e-wallet selector with local SVG previews.
- Deterministic reference validation for the 10 supplied UnionBank/InstaPay sender formats.
- Mandatory payment Reference Number and receipt, duplicate-reference protection, and server-side revalidation.
- Payment processing/success timeline retained and expanded.
- Workspace Payment Reviews now show system checks before approval and use rejection reasons + optional notes.
- Legacy/incomplete submissions no longer fail with an unexplained NULL approval path; they are blocked with actionable validation.
- Contextual guest Log In Required modals and guest Help/About.
- Updated 9:16 onboarding graphics with safe margins for varied phone sizes.
- Database migration: `009_platform_v1_3_2.sql`.

# JUAN PROJECT Platform V1.3.1

- Adds browser/PWA site icons for Workspace and Online using the supplied JUAN PROJECT branding.
- Invoice issue date is always the current viewing date.
- Invoice now shows Subtotal, a conditional Additional Fees section, Additional Fees Total, Discount, Total, Amount Paid, and Balance Due. Zero-value additional fees are omitted entirely.
- Workspace and Online invoices can be saved directly as PNG images in addition to PDF/print.
- Workspace Mobile is intentionally limited to Home, Projects, Payments & Approvals, Reports, and Settings with a floating iPhone-style capsule navigation.
- Mobile Payments surfaces pending Online payment approvals directly above payment records.
- JUAN PROJECT Online onboarding now uses the three supplied visual introduction screens instead of generic icon slides.
- Settings/About identifies Version V1.3.1 and Developed by BENZEL DELMO · JUAN PROJECT Management System.
- No database migration is required for V1.3.1.

# JUAN PROJECT Platform V1.3


- Draft Orders replace Load Template.
- Payment history supports edit/delete with audit logging.
- Google Drive time-lock controls moved into Project → Deliverables.
- Online Portal reduced to Client Access, Portal Activity, Payment Reviews, and Portal Configuration.
- Workspace mobile layout prioritizes Home, Projects, Payments, Clients, and More.
- Gemini removed from all payment flows; payment submission is manual + admin-reviewed.
- Login endpoints are rate limited server-side.
- Invoice hierarchy remains Subtotal → Additional Fees → Total → Amount Paid → Balance Due.


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

### V1.3.2 UI & Payment Review Hotfix
Brand/icon refresh, final onboarding assets, mobile-first JPO polish, searchable sender selector, receipt preview, compact payment-review modal, Pending/Accepted/Rejected statuses, review deletion, and rejection-reason controls.
