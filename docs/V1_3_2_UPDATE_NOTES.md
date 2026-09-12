# JUAN PROJECT Platform V1.3.2

V1.3.2 is a reliability and payment-verification release.

## Shared cloud data
- Supabase is the source of truth for Workspace projects, clients, payments, portal records, and owner/business settings.
- Successful cloud loads no longer merge stale browser-only client/project rows over Supabase data.
- Browser storage remains a cache/offline fallback.
- Workspace owner name, address, phone, email, profile image, business name, and theme sync through `workspace_settings`.

## Loading experience
- Workspace uses skeleton loading while shared data is fetched.
- The skeleton represents cards and table rows instead of showing a blank page.

## JUAN PROJECT Online payments
- JUAN PROJECT continues receiving through UnionBank.
- The client selects the sending bank/e-wallet using a type-to-search field.
- Selected institutions show a local SVG logo/identifier.
- Reference validation changes dynamically by institution and runs again on the server.
- Supported senders: GCash, BPI, BDO Mobile, BDO Online, Maya, Metrobank, Landbank, UnionBank, GoTyme, MariBank/SeaBank.
- Reference Number and receipt are mandatory.
- Duplicate references are rejected.
- Existing processing and success feedback is preserved and expanded into a payment timeline.

## Payment Reviews
- Workspace displays a system-check result before approval.
- Missing/invalid legacy submissions show Needs Attention instead of causing an unexplained NULL failure.
- Approval is disabled until system checks pass.
- Rejection requires a pre-templated reason and supports an optional admin note.
- Clients can see the rejection reason in payment history.

## Online guest experience
- Guests may browse Home, Shop, service details, and Help/About.
- Orders and Payment use contextual Log In Required bottom sheets.
- No public account creation is introduced.

## Onboarding
- Three 9:16 visual onboarding slides are replaced with the latest safe-margin layouts:
  1. JUAN PROJECT Online introduction
  2. Features
  3. Logging in
- Slides use `object-fit: contain` and reserve control space so content is not cropped on short/narrow phones.

## Database
Run `supabase/migrations/009_platform_v1_3_2.sql` after migrations 001–008.

## V1.3.2 UI & Payment Review Hotfix
- Replaced external website/app icons with the standalone JUAN PROJECT **J** mark.
- Added dedicated `JUAN PROJECT Online` and `JUAN PROJECT` brand assets.
- JPO invoices now use the same **JUAN PROJECT**-only invoice wordmark as Workspace.
- Replaced the three onboarding slides with the supplied 9:16 onboarding graphics in the intended order: portal overview, features, login.
- Strengthened mobile-first sizing and safe-area handling for JPO.
- Replaced the native datalist sender selector with an actual searchable bank/e-wallet combobox with logo previews.
- Receiving UnionBank account name and account number now use a single-column layout.
- Added local receipt preview for JPG/PNG/PDF before payment submission.
- Standardized payment review statuses to **Pending / Accepted / Rejected**.
- Added a vertical three-dot action menu and protected Delete Review action. Deleting an Accepted review does not reverse the canonical payment.
- Added migration `010_platform_v1_3_2_payment_review_ui.sql` to migrate `approved` review records to `accepted` and update the review RPC.
- Reworked the Review Payment modal into a compact, low-height layout with table-like payment details, two-column system checks, rejection reason dropdown, optional client note, and responsive collapse on smaller screens.
