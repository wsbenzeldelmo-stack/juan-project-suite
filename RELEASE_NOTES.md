# JUAN PROJECT Platform V1.3.3.2

## Payment Reviews
The full Review Payment modal has been removed. Pending requests are handled from the vertical action menu with Approve Request, Reject Request, and Delete Request. Approval still runs the existing server-side verification. Rejection opens a small searchable reason dialog with an optional client note.

## JUAN PROJECT Online
New users see the three onboarding slides first and continue into Guest Mode. Protected features ask for Log In only when needed. A missing `home()` renderer that could stop the Online client app at runtime has been restored. Portal-data failures now provide Try Again, Browse as Guest, and Log Out actions.

## Reports
Reports now prioritizes data viewing: four key totals, a period filter, one revenue trend chart, payment status counts, outstanding projects, recent payments, and compact workspace health. Malformed legacy records remain isolated so one bad row cannot stop Workspace.

## Invoice
The JUAN PROJECT invoice logo SVG has a wider viewBox to prevent the last “T” from being clipped in previews and exports.

## Database
No new SQL migration in this patch.
