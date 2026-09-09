# Shared Database Relationships

The existing Workspace tables remain the core business records. Portal tables extend them.

```text
auth.users
   │
   ├── user_roles ------------------------ admin authorization
   │
   └── portal_accounts
          │
          └── client_id
                 │
              clients
                 │ 1
                 │
                 │ many
              projects
          ┌──────┼───────────────┐
          │      │               │
    project_items deliverables  payments
                    │
                    └── shared_drive_url

projects + clients
      │
      └── payment_submissions
             │
             └── receipt_path -> private Storage bucket

catalog_categories
    │
    ├── catalog_services
    │
    └── catalog_packages
            │
            └── catalog_package_items ── optional link to catalog_services
```

## Source-of-truth rules

- Client identity: `clients`
- Authentication identity: `auth.users`
- Auth-to-client mapping: `portal_accounts`
- Project production truth: `projects` + `deliverables`
- Order item snapshot/history: existing `project_items` for current V1 Workspace projects
- Approved financial truth: existing `payments`
- Client-submitted proof waiting for review: `payment_submissions`
- Seller payment instructions: `payment_settings`
- Future storefront source: `catalog_*`

## Important separation

`payment_submissions` is not revenue. Only approved entries become canonical `payments`.

A project's production progress is derived from deliverables. It is not derived from payment percentage.
