# JUAN PROJECT Platform V1.3

## Workspace
- Load Template removed from New Order. Drafts is a button beside Save Draft and stores server-side admin drafts.
- Payment History: Edit and Delete; deletion recalculates balances; edit/delete writes audit logs.
- Project Files controls now live at Project Details → Deliverables and remain connected to JUAN PROJECT Online.
- Online Portal is limited to Client Access, Portal Activity, Payment Reviews, Portal Configuration.
- Mobile Workspace uses Home / Projects / Payments / Clients / More.
- UI removes decorative gradients and equal-weight template cards in favor of hierarchy and contextual content.

## Online
- Gemini removed from payment and shop payment flows.
- Payment receipt + manually entered transaction details, processing state, pending-review confirmation.
- Log In terminology and password visibility retained.
- Server-side login rate limiting.

## Fees
- JP-040 and JP-041 receive ₱21 System Maintenance Fee only.
- JP-052 receives ₱21 System Maintenance Fee and is the cutover example for Base Rush Fee + workload surcharge. The workload amount remains configurable because no peso rule was specified.
- Future projects continue using the current maintenance/workload logic.

## Invoice
Display Subtotal, then Additional Fees (Rush, Workload, System Maintenance, others), then Additional Fees Total, then Discount/Tax, Total, Amount Paid, Balance Due.
