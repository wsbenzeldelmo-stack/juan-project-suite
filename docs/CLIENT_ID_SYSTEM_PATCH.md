# Client ID System Patch — V1.3.3.2

## Authoritative historical sequence

The historical mapping remains `CL-001` through `CL-046` exactly as listed in `CLIENT_ID_MAPPING_V1_3_3_2.csv`. Nathaniel Villegas (`villegasnathaniel10@gmail.com`) is `CL-025`.

## Permanent rule

- One normalized email address = one lifetime Client ID.
- A second project using the same email reuses the first Client ID.
- Archived clients keep their Client ID and are reactivated when the same email is used again.
- New unique clients continue from the highest existing Client ID. The first new ID after this historical set is `CL-047`.
- Client IDs are never reused.

## Patch behavior

Migration `013_client_id_identity_lock.sql` keeps MAX+1 allocation, sets CL-046 as the minimum historical floor, normalizes client emails to lowercase on write, and blocks duplicate-email identities at the database layer. Workspace also checks local/cloud client identity before creating a new client, keeps a local last-assigned counter so offline IDs are not reused after archiving, and blocks editing a client email to an email already owned by another Client ID.

## Deployment

Apply migrations in order through `013_client_id_identity_lock.sql`, then redeploy Workspace. Service-worker cache names were bumped with a client-ID patch suffix so deployed browsers fetch the new logic.
