# JUAN PROJECT Suite V1.1 Architecture

```text
                         ONE SUPABASE PROJECT
                                 │
               ┌─────────────────┴─────────────────┐
               │                                   │
       JUAN PROJECT Workspace              JUAN PROJECT Online
        Seller / Admin UI                    Client / Guest UI
               │                                   │
               ├── Clients                          ├── Public Shop
               ├── Projects                         ├── Own Projects
               ├── Deliverables                     ├── Own Invoices
               ├── Payments                         ├── Own Payments
               ├── Catalog                          └── Own project Drive links
               └── Online Portal controls
                      ├── Client Accounts
                      ├── Payment Reviews
                      ├── Delivery Links
                      └── Payment Setup
```

## Identity

- `clients.id` remains the business/database primary key.
- `clients.client_code` is the public display ID `CL-###`.
- `projects.id` remains the database primary key.
- `projects.project_code` is the public display ID `JP-###`.
- Client and Project numbering are independent.
- A repeat client keeps one Client record and one Client ID across multiple projects.

## Auth

Supabase Auth owns passwords.

`portal_accounts` links:

```text
auth.users.id → portal_accounts.auth_user_id
clients.id    → portal_accounts.client_id
```

`password_set=false` forces the first-login password-change screen.
`portal_enabled=false` blocks protected Online access server-side.

## Project delivery

`projects.drive_url` is the V1.1 client-facing Drive link. One project has one Drive URL.
Older deliverable-level links are retained for backward compatibility but are no longer the Online source of truth.

## Catalog

Workspace and Online both use `catalog_*` tables. Online has no duplicate product database.

## Payment

Client submission → `payment_submissions` → admin review → canonical `payments` only after approval.
