# Workspace source

Workspace base: latest retrieved `JUAN_PROJECT_WORKSPACE_CATALOG_ITEMS_V6_3.html`, preserved and patched for shared-database deployment, admin authentication, JUAN PROJECT Online readiness, project/item/deliverable synchronization, and the approved simplified UI.

The generated suite does **not** recreate the business database. Supabase migrations are additive and retain the existing `clients`, `projects`, `project_items`, `deliverables`, and `payments` tables.
