# Shared Architecture

```
                 ONE SUPABASE PROJECT
              Auth + PostgreSQL + Storage
                         |
          +--------------+--------------+
          |                             |
 JUAN PROJECT Workspace          JUAN PROJECT Online
 admin / seller authority        client / future client
          |                             |
          +--------- same records ------+

clients -> projects -> project_items / deliverables
                   -> payments
                   -> payment_submissions
payment_settings -> Online payment instructions
catalog_*        -> future Online Shop
```

Workspace uses authenticated browser access protected by admin RLS. Online uses Supabase Auth for sessions and Vercel server functions for scoped business data; server functions verify the token and then enforce the linked `client_id` before querying with server credentials.

This avoids exposing internal client notes or seller-only columns through a broad client-side database query.
