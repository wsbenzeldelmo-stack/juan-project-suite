# JUAN PROJECT — shared test build

Workspace and Online now use **one shared, persistent test database**. They do not keep separate business-data copies in each browser. No Supabase project or admin login is needed for this test build.

## Start on your Mac

1. Extract this ZIP.
2. Open Terminal in the extracted `juan-project-suite-main` folder.
3. Run:

```sh
python3 preview/server.py
```

You can also run `bash START_TESTING.command`. On Windows, use `START_TESTING.bat` (Python 3 must be installed).

Open these two tabs:

- Workspace: http://localhost:8765
- Online: http://localhost:8766

Keep Terminal running while testing. Press Control+C to stop. Reopening the server restores your saved test records. Opening `index.html` directly or using a plain static file server will not activate shared test mode.

## Test the flow

1. Open Workspace once to load its existing services/packages into the shared catalog.
2. In Online, use **Shop / New Order**. Submit a guest order.
3. View its thermal receipt, save an image or use **Print / Save PDF**, and open its tracking link.
4. In Workspace, open **Incoming Orders → Review → Approve & Convert**.
5. The client and project are created once. Find them in the existing Clients/Projects pages.
6. Reload Online, then choose that client in the top test-client selector. This selector replaces login while testing.
7. Use **Tracking & Files** in Workspace to update milestones, nested deliverables, the Drive link and payment-lock override.
8. Submit payment proof from Online; approve or reject it in **Online Portal Tools → Payment Reviews**. Only approved payments change the balance.
9. Test Client Cards, QR Scanner, promotions, client classification, invitations and read-only client preview.

Workspace and the client portal poll for shared changes about every 1.5 seconds, then use their normal refresh flow. Some administration dialogs have a Refresh button. All browsers on this computer connect to the same data store.

## Included additions

- Guest checkout, secure token tracking, review/change request/resubmission and idempotent conversion.
- Thermal order receipt, PNG export and print-to-PDF.
- Client card, flip-to-QR, QR display and PNG export.
- Camera/image QR scanner with a bundled decoder and manual ID lookup.
- Incoming Orders entry from the New Order area; admin drafts stay separate.
- Existing Home / Orders / Payment / Shop / Account screens retained.
- Client introduction, explicit tracker stage, grouped deliverables, balance-based Drive lock and admin override.
- Existing payment reminder and sender search retained; MariBank changed to 6–12 digits.
- GCash/Maya fee defaults of PHP 10; fees stay separate from the credited amount.
- Shared payment proof review and canonical approved payment history.
- Portal tools for clients, invitations, activity, configuration and in-house ads.
- Read-only Preview as Client and New / Returning / Loyal / VIP classifications.

## Data and deployment boundary

The server creates `preview-data/suite.sqlite` and `preview-data/uploads/` when first run. Keep that folder to preserve test data. No test clients, projects, payments or proof files are bundled in this ZIP. The service catalog comes from the original Workspace defaults.

**Online Portal Tools → Portal Configuration → Export all test data** produces a JSON backup of records. Copy `preview-data/` as well to back up uploaded proofs. Importing that backup into Supabase is a later, explicit migration step; there is no automatic cloud import in this build.

This is a **functional shared test build, not a production release**. New feature UI and test APIs are supplied by `preview/server.py`; Vercel does not run this Python test server. The existing Supabase application paths remain, but the new guest/QR/administration endpoints still need a production Supabase implementation and database migrations before redeployment. Do not expect uploading only workspace/ and online/ to Vercel to enable the new test features.

The test server binds only to this computer. It is not an internet service or cross-device deployment. Production login, secure invitation delivery, RLS, Storage policies and cloud realtime must be configured and verified with your new Supabase project. Test invitations are local links; no emails are sent. QR codes point to localhost until a production URL is implemented.

Client preview uses a separate, read-only test context and does not replace the selected test client's saved session. Since test mode deliberately allows client selection without login, use it for test data, not public access.

## Verification

Automated checks completed during preparation:

- Shared-store unit tests and HTTP tests for persistence, guest submission, conversion, payment fees, authorization boundaries and file locking.
- DOM smoke test of Workspace startup, guest checkout/receipt, admin conversion and client-card flip.
- QR encoder → bundled decoder round trip.
- JavaScript syntax checks.

A live browser could not access the local server in the preparation environment. Actual mobile layout, camera hardware, PNG download and browser print/PDF output need a manual check on your computer. Supabase/cloud behavior has not been tested.

Run backend tests with:

```sh
python3 -m unittest discover -s tests -v
```

The older `scripts/verify-build.sh` checks an earlier release's text and UI assumptions. It was run and stopped at `VERSION is not 1.3.3.2`, because this package identifies itself as `1.3.3.2-shared-test.1`. It is retained as historical verification; its remaining assertions were not reached and are not the acceptance criteria for this shared test build.
