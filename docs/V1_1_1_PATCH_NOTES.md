# V1.1.1 Patch Notes

## Workload surcharge
The user specified that workload (example: 9 simultaneous projects and a 5-day deadline) must be considered, but did not specify a peso amount. This patch therefore stores `workload_surcharge`, records workload context, and flags high-workload cases without inventing a charge. Admin may set a business-approved surcharge later.

## System maintenance
From JP-052 onward, projects containing a package receive ₱21 system maintenance; other projects receive ₱20.

## Secure receipt input
Gemini-extracted Amount Paid, Mode of Payment, Reference Number, and Date are authoritative and read-only. If Gemini returns a limit/not-configured response, Online temporarily exposes manual fields. Visible transfer fees are deducted server-side from the gross receipt amount.
