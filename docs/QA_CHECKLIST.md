# JUAN PROJECT Suite V1.1 — QA Checklist

## Migration
- [ ] Database backup completed.
- [ ] `005_suite_v1_1.sql` succeeds.
- [ ] `verify_v1_1.sql` returns valid Client IDs and portal fields.
- [ ] Placeholder `Name` rows are not counted as Client IDs.
- [ ] Legitimate clients without an email remain in the client count but are flagged for account setup.

## Workspace
- [ ] Admin login works.
- [ ] Online Portal appears inside the main Workspace navigation.
- [ ] `/online-control.html` redirects to the integrated Online Portal.
- [ ] Client Accounts loads.
- [ ] Payment Reviews loads.
- [ ] Delivery Links shows one row per project.
- [ ] Payment Setup loads and saves.
- [ ] Creating a new project for an existing email reuses the existing Client ID.
- [ ] Archiving a client preserves the Client ID.

## Client accounts
- [ ] Create Missing Accounts creates only missing valid client Auth accounts.
- [ ] New account login email equals the saved client email.
- [ ] New account temporary password equals the current Client ID.
- [ ] First login forces Change Your Password.
- [ ] Existing activated account password is not reset by batch provisioning.
- [ ] Duplicate emails are reported.
- [ ] Missing emails are reported.
- [ ] Disabled Online access is rejected by protected API routes.

## Online UI
- [ ] Welcome matches the approved reference structure.
- [ ] Onboarding is two simple slides and can be skipped.
- [ ] No Create Account / Sign Up / First Access UI exists.
- [ ] Guest can browse Home and Shop.
- [ ] Protected bottom-nav items show Sign In Required when logged out.
- [ ] Dashboard uses real client data.
- [ ] My Projects uses real project data.
- [ ] Project Details uses a vertical deliverable timeline.
- [ ] One project Drive button opens that project's Drive URL.
- [ ] Shop has no product thumbnails.
- [ ] Shop search and filters work.
- [ ] Mobile layout has no horizontal overflow or bottom-nav overlap.

## Payments
- [ ] Supplied UnionBank QR renders without distortion.
- [ ] Receipt upload enforces supported file types/size.
- [ ] Submitted payment is Pending.
- [ ] Pending payment does not change Amount Paid or Balance Due.
- [ ] Admin can approve/reject from integrated Online Portal.
- [ ] Approved payment updates canonical payments exactly once.

## Security
- [ ] Client A cannot load Client B projects by changing IDs.
- [ ] Client A cannot load Client B Drive URL.
- [ ] Client cannot call admin-portal endpoints successfully.
- [ ] Supabase secret key is absent from browser responses/source.
- [ ] Gemini key is absent from browser responses/source.
