# JUAN PROJECT Suite V1.1 — Deployment Checklist

1. Back up the existing Supabase project.
2. Keep the previous Vercel deployments available for rollback.
3. Run `supabase/migrations/005_suite_v1_1.sql` in SQL Editor.
4. Run `supabase/verify_v1_1.sql`.
5. Apply the V1.1 code patch locally.
6. Run `bash scripts/verify-build.sh`.
7. Commit and push to GitHub.
8. Wait for both Vercel projects to become Ready.
9. Open Workspace → Online Portal → Client Accounts.
10. Click Create Missing Accounts.
11. Review Missing Email / Duplicate Email / Needs Attention records.
12. Test a real client login with email + temporary `CL-###`.
13. Confirm forced first-login password change.
14. Test a repeat client's multiple projects.
15. Save a different Drive URL on two projects belonging to the same client and confirm each opens correctly.
16. Submit a test payment and approve it from Workspace.
17. Run the isolation/security QA checklist before client rollout.
