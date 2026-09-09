# Rollback Guide

## Before migration

1. Export/backup the Supabase database.
2. Keep the previous deployed Workspace build available in Vercel deployment history.
3. If important records still exist only in the old Workspace browser, export its existing application backup before clearing storage or changing domains.

## Application rollback

Vercel keeps previous deployments. If a frontend regression occurs, promote the previous known-good deployment while leaving the database intact.

## Database rollback principle

Migrations in this package are additive and intentionally do not drop the existing business tables. If rollback is required, prefer leaving the added columns/tables unused rather than immediately dropping them during an incident.

Do not drop `clients`, `projects`, `project_items`, `deliverables`, or `payments` as part of rollback.

If a schema removal is later desired, prepare and test a separate explicit down-migration after data has been backed up.
