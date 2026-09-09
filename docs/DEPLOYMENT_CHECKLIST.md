# Deployment Checklist

1. Create a Supabase production backup.
2. Preserve/export any important browser-local Workspace backup.
3. Test migrations in a Supabase branch/dev project when possible.
4. Run migrations `001`, `002`, `003`, `004` in order.
5. Run `supabase/verify_installation.sql` and review results.
6. Create the admin Supabase Auth account.
7. Replace the email in `bootstrap_admin.sql` and run it.
8. Configure Supabase Site URL and redirect URLs for Online + Workspace.
9. Deploy `workspace/` as its own Vercel project.
10. Configure Workspace environment variables.
11. Verify unauthenticated Workspace shows the admin sign-in gate.
12. Sign in as admin and confirm existing data loads.
13. Confirm any local-only records migrate to the shared database before clearing browser storage.
14. Open Workspace Shop and verify current catalog synchronizes to `catalog_*` tables.
15. Deploy `online/` as its own Vercel project.
16. Configure Online environment variables, including `ONLINE_PUBLIC_URL`.
17. Configure Gemini only if receipt extraction is wanted.
18. Open `/online-control.html` in Workspace and save payment instructions/QR information.
19. Test an existing client's First Access flow.
20. Test a future-client sign-up.
21. Test Client A cannot see Client B data.
22. Submit a test receipt and verify it remains Pending.
23. Verify Pending does not change Amount Paid/Balance.
24. Approve the test payment in Workspace and verify Online balance updates once.
25. Attempt to approve the same submission again and confirm it is rejected.
26. Add a Google Drive delivery link and verify only the owning client sees it.
27. Test password change.
28. Test Online at mobile widths and Workspace at desktop/tablet/mobile widths.
29. Run `bash scripts/verify-build.sh`.
30. Only then connect/promote production domains.
