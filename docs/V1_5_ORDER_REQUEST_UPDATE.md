# JUAN PROJECT Order Request Update

This release introduces the public Shop → Order Request → Workspace Review → Project workflow.

## JUAN PROJECT Online
- First-open storefront with Shop Now, existing-client login, and Order Request tracking.
- Guest catalog/cart checkout requiring name and email.
- Persistent guest cart.
- Thermal-style Order Request receipt with secure QR tracking.
- Save receipt as PNG and share the image when Web Share is available.
- Track by secure QR link or Order Request ID + email.
- Revised-offer tracking and client acceptance.
- Existing-client Home, Orders, Payment, Shop, and Account experience.
- Bronze, Silver, Gold, and Platinum membership presentation based on completed and fully settled projects.

## JUAN PROJECT Workspace
- Order Requests and Scan QR actions alongside New Order.
- Order Request review before Project ID creation.
- Editable request items, quantities, prices, discounts, review notes, and rush fees.
- Save review, send revised offer, request changes, reject, or approve.
- Project ID is created only by Approve & Create Project.
- QR scanner supports camera, uploaded QR images, client IDs, Order Request IDs, and secure tracking links.

## Data model
- Incoming orders now support discounts, original request snapshots, revised-offer timestamps, acceptance timestamps, and approval timestamps.
- Order Request revisions are stored separately for review history.
- New guest request IDs use the OR-### prefix.
