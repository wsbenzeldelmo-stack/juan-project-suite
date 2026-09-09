# QA Checklist — JUAN PROJECT Suite V1

## Database
- [ ] Production backup created before migrations.
- [ ] Migrations 001-004 run without errors.
- [ ] `verify_installation.sql` reviewed.
- [ ] Existing `clients`, `projects`, `project_items`, `deliverables`, `payments` records remain intact.
- [ ] Existing primary IDs are unchanged.
- [ ] `client_code` values are unique.
- [ ] `project_code` values are unique.

## Workspace
- [ ] Unauthenticated visitor sees Admin Sign In gate.
- [ ] Non-admin Supabase user cannot enter Workspace.
- [ ] Admin can sign in and sign out.
- [ ] Clients page displays `CL-###`.
- [ ] Projects display `JP-###`.
- [ ] Project Data is two columns on desktop.
- [ ] Current Project cards show deliverable progress.
- [ ] Payment Monitoring uses modular cards.
- [ ] Payment History order is Method / Reference / Amount / Note / Date Paid / Actions.
- [ ] Shop has no thumbnails.
- [ ] Shop has no top stats.
- [ ] Shop has no Last Updated column.
- [ ] Shop has no row checkbox/select-all/bulk actions.
- [ ] Service table columns are Name / Category / Description / Price / Actions.
- [ ] Package table columns are Package Name / Package Inclusions / Original Price / New Price / Actions.
- [ ] Catalog changes persist after page reload and are present in shared catalog tables.
- [ ] Existing local-only project migration is tested on a backup copy/browser profile first.

## Online authentication
- [ ] Existing client receives First Access email.
- [ ] Public First Access response does not reveal whether an email exists.
- [ ] Magic link signs existing client in.
- [ ] Existing client is prompted to create password when `password_set=false`.
- [ ] New password works on next login.
- [ ] Future client can create an account.
- [ ] Unauthenticated user cannot load `/api/portal-data`.

## Client isolation
- [ ] Client A sees only Client A projects.
- [ ] Client B sees only Client B projects.
- [ ] Modifying request project IDs cannot expose another client's data.
- [ ] Private receipts cannot be read by another client.

## Orders / deliverables
- [ ] Online Orders lists linked projects.
- [ ] Progress is based on completed deliverables, not payment percentage.
- [ ] Countdown is derived from due date.
- [ ] Drive icon only appears when a shared URL exists.
- [ ] Hidden deliverable/link does not appear for client.

## Payments
- [ ] QR/payment instructions load from Workspace settings.
- [ ] JPG upload succeeds under 5 MB.
- [ ] PNG upload succeeds under 5 MB.
- [ ] PDF upload succeeds under 5 MB.
- [ ] Oversize upload is rejected.
- [ ] Unsupported MIME type is rejected.
- [ ] Gemini extraction is optional.
- [ ] Extracted fields remain editable before submission.
- [ ] Submitted payment status is Pending.
- [ ] Pending payment does not change Amount Paid.
- [ ] Approval adds one canonical payment.
- [ ] Second approval attempt is rejected.
- [ ] Rejection leaves canonical payment totals unchanged.
- [ ] Payment amount above live balance is rejected.

## Invoice
- [ ] Invoice total matches Workspace project total.
- [ ] Amount Paid equals approved canonical payments only.
- [ ] Balance Due equals Total - Amount Paid.

## Responsive
- [ ] Online tested at 320px, 375px, 430px widths.
- [ ] Workspace tested at desktop, tablet, and narrow mobile widths.
- [ ] Wide tables scroll rather than compressing into unreadable text.

## Deployment
- [ ] Workspace Vercel project Root Directory = `workspace`.
- [ ] Online Vercel project Root Directory = `online`.
- [ ] Both use the same `SUPABASE_URL`.
- [ ] Both use the same Supabase project.
- [ ] Server secrets are configured only as server environment variables.
- [ ] Auth redirect URLs include production domains.
- [ ] `bash scripts/verify-build.sh` passes before ZIP/release.
