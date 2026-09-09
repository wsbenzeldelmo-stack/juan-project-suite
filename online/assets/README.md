# JUAN PROJECT payment QR asset

`unionbank-bankqr-placeholder.jpg` is the default QR image used by JUAN PROJECT Online when no `qr_image_url` is configured in Payment Setup.

To replace the bank QR later:

1. Export your new QR image as JPG.
2. Name it exactly `unionbank-bankqr-placeholder.jpg`.
3. Replace this file in `online/assets/`.
4. Commit and push to GitHub; Vercel will redeploy automatically.

You can also override the bundled image from Workspace → Online Portal Control → Payment Setup by saving a `QR Image URL`.

The QR image included with this patch is an exact byte-for-byte copy of the user-supplied `UNIONBANK.JPG`; it was not resized, compressed, recolored, cropped, or otherwise altered.
