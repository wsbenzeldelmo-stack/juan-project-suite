# JUAN PROJECT V1.3.3.2 — Client Master + UI Patch

Source of truth for historical client identities: `JUAN_PROJECT_Client_ID_Mapping_UPDATED(5).xlsx` (SHA-256 `556584cf3e027ffc515346964c19370f33032c60d00df0bea5935c158645976f`).

The uploaded workbook contains Client ID, email, first project, and project count. It does **not** contain a client-name column, so this patch deliberately preserves existing database client names rather than guessing names from project titles or email addresses.

## Changes
- Historical Client ID + email mapping is prioritized in Client Directory and Online Portal.
- The first authenticated admin load of Online Portal silently initializes the mapped portal accounts once for this master version. Each mapped client receives its Client ID as the temporary password and is required to change it after login. A metadata version marker prevents repeated resets on refresh.
- Removed the visible Sync Client Accounts / Reboot Client Logins controls and the initial-password explanatory copy.
- Revenue Trend now supports This Month, Last Month, Last 6 Months, and Last Year.
- Shop Services columns use 10/22/20/30/12/6 percent widths.
- Tables grow with the page on desktop; row action popovers render above table/card layers.
- Fixed Online receiving-account spacing.
- Invoice wordmark is rendered as full `JUAN PROJECT` text and brand SVG viewBox is widened.
- Report UI replaces emoji glyphs with vector UI icons.
