# JUAN PROJECT Platform V1.3.3.1

Stability hotfix for V1.3.3. See RELEASE_NOTES.md.

# JUAN PROJECT Platform V1.3.3

JUAN PROJECT Platform contains two interfaces backed by the same Supabase project:

- **JUAN PROJECT Workspace** — seller/admin operations, including the simplified mobile Workspace.
- **JUAN PROJECT Online** — mobile-first client portal.

## V1.3.3 highlights

- resilient Reports rendering instead of full-page crashes
- Supabase-first autosave plus offline cache/sync queue
- persistent Completed / Delivered project state
- compact Payment Reviews with system verification and NULL-safe approval
- revised bank/e-wallet list and uploaded institution logos
- transparent ₱25 / ₱26 System Maintenance Fee logic
- consistent JUAN PROJECT invoices with PDF and image export
- status-aware Balance Due box
- Colorful Mode
- synchronized Online project/payment/invoice/delivery data
- client profile photos, reminders, and completion thank-you message
- updated three-slide mobile onboarding

See `docs/V1_3_3_UPDATE_NOTES.md` for the full release scope.

## Upgrade

1. Back up your current project and Supabase database.
2. Apply the V1.3.3 patch.
3. In Supabase SQL Editor, run `supabase/migrations/011_platform_v1_3_3.sql` after migrations 001–010.
4. Run `bash scripts/verify-build.sh`.
5. Redeploy both Workspace and Online using the same Supabase environment values.

## Security

Keep `SUPABASE_SECRET_KEY` and other service credentials server-side only. Client-facing payment submissions remain pending until an admin accepts them.
