# Database Notes

The suite deliberately **does not recreate the existing JUAN PROJECT business database**.

Existing Workspace tables remain authoritative:

- `clients`
- `projects`
- `project_items`
- `deliverables`
- `payments`

The migrations add only the fields needed for standardized display IDs, client delivery, portal access, and shared catalog behavior.

Supporting tables:

- `user_roles` — admin/client role support
- `portal_accounts` — Auth user -> existing client relationship
- `payment_settings` — payment method / account / QR / instructions
- `payment_submissions` — client proof awaiting admin review
- `security_rate_limits` — server-only abuse throttling
- `catalog_categories`
- `catalog_services`
- `catalog_packages`
- `catalog_package_items`

## Canonical rules

- Approved payments remain in the existing `payments` table.
- `payment_submissions` is a review queue only.
- Project production progress comes from deliverables.
- Client passwords live in Supabase Auth, never `clients`.
- Workspace is the shared Shop catalog authority.
- Online will consume the same `catalog_*` records when Shop is enabled.

## Display IDs

Primary keys are preserved. Display codes are additive:

- `clients.client_code` -> `CL-###`
- `projects.project_code` -> `JP-###`

Triggers allocate new display codes for future inserted clients/projects when a code is absent.

## Catalog bridge

Migration 004 adds stable `product_code` fields to shared services/packages and a package category relationship. Workspace's existing `SRV-###` / `PKG-###` codes are used to synchronize seller catalog edits without creating a separate Online catalog.
