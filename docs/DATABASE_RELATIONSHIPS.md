# JUAN PROJECT Suite V1.1 — Database Relationships

```text
clients (id, client_code CL-###)
  │
  ├──< projects (id, project_code JP-###, client_id, drive_url)
  │      ├──< project_items
  │      ├──< deliverables
  │      ├──< payments
  │      └──< payment_submissions
  │
  └──1 portal_accounts (client_id, auth_user_id, password_set, portal_enabled)
          │
          └── auth.users

catalog_categories
  ├──< catalog_services
  └──< catalog_packages ──< catalog_package_items
```

## Display ID rules

- `CL-###` is a gapless lifetime sequence for unique client records.
- `JP-###` is the independent project sequence.
- Repeat projects point back to the same `clients.id` and therefore the same `CL-###`.
