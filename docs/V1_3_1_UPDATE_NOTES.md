# JUAN PROJECT Platform V1.3.1 Update Notes

## Invoices
- Issued date is generated from the viewer's current local date every time the invoice is opened/rendered.
- Additional Fees only appears when at least one fee is greater than zero.
- Supported fee rows include Rush Fee, Workload Surcharge, System Maintenance Fee, plus any `additional_fees` entries already present in project data.
- Additional Fees Total is shown before Total.
- Workspace and Online can export the visible invoice as PNG without an external screenshot service.

## Workspace Mobile
- Floating capsule navigation: Home, Projects, Payments, Reports, Settings.
- Focus is intentionally limited to viewing/project updates, payment records, Online payment approvals, and financial reporting.
- Pending Online payment submissions can be approved or rejected from the mobile Payments screen.
- Touch targets and safe-area spacing are tuned for modern iPhone displays.

## Online Onboarding
- Uses the three supplied 9:16 JUAN PROJECT Online visuals.
- Supports Next, Skip, and horizontal swipe navigation.

## Branding / Metadata
- Browser favicon, Apple touch icon, and PWA icons are included.
- Current release: V1.3.1.
- Developed by BENZEL DELMO · JUAN PROJECT Management System.

No Supabase migration is required.
