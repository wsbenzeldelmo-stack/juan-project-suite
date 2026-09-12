#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for required in \
  "$ROOT/workspace/index.html" \
  "$ROOT/workspace/css/v1-2-ux.css" \
  "$ROOT/workspace/css/v1-3-ux.css" \
  "$ROOT/workspace/js/v1-2-ux.js" \
  "$ROOT/workspace/js/v1-3-ux.js" \
  "$ROOT/workspace/api/admin-portal.js" \
  "$ROOT/workspace/api/_payment-verification.js" \
  "$ROOT/online/index.html" \
  "$ROOT/online/css/app.css" \
  "$ROOT/online/js/app.js" \
  "$ROOT/online/js/payment-institutions.js" \
  "$ROOT/online/api/portal-data.js" \
  "$ROOT/online/api/payment-submission.js" \
  "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" \
  "$ROOT/online/assets/onboarding/onboarding-1.png" \
  "$ROOT/online/assets/onboarding/onboarding-2.png" \
  "$ROOT/online/assets/onboarding/onboarding-3.png" \
  "$ROOT/online/assets/payment-institutions/gcash.svg" \
  "$ROOT/online/assets/payment-institutions/bpi.svg" \
  "$ROOT/online/assets/payment-institutions/bdo-mobile.svg" \
  "$ROOT/online/assets/payment-institutions/bdo-web.svg" \
  "$ROOT/online/assets/payment-institutions/maya.svg" \
  "$ROOT/online/assets/payment-institutions/metrobank.svg" \
  "$ROOT/online/assets/payment-institutions/landbank.svg" \
  "$ROOT/online/assets/payment-institutions/unionbank.svg" \
  "$ROOT/online/assets/payment-institutions/gotyme.svg" \
  "$ROOT/online/assets/payment-institutions/maribank-seabank.svg" \
  "$ROOT/supabase/migrations/008_platform_v1_3.sql" \
  "$ROOT/supabase/migrations/009_platform_v1_3_2.sql" \
  "$ROOT/supabase/migrations/010_platform_v1_3_2_payment_review_ui.sql" \
  "$ROOT/online/assets/brand/j-mark.svg" \
  "$ROOT/online/assets/brand/juan-project-online.svg" \
  "$ROOT/online/assets/brand/juan-project.svg" \
  "$ROOT/workspace/assets/brand/j-mark.svg" \
  "$ROOT/workspace/assets/brand/juan-project.svg" \
  "$ROOT/docs/V1_3_2_UPDATE_NOTES.md"; do
  test -f "$required" || { echo "Missing: $required"; exit 1; }
done

python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
p=Path(tempfile.gettempdir())/'juan-workspace-inline-v132.js'
p.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(p)],check=True)
checks={
  '<title>JUAN PROJECT Workspace</title>':'Workspace title missing',
  'workspaceLoadingSkeleton':'Workspace skeleton loading missing',
  'workspace_settings':'Shared workspace settings sync missing',
  'openPortalPaymentReview':'Payment review modal logic missing',
  'delete-payment-review':'Payment review delete action missing',
  'Payment Details':'Compact payment review details missing',
  'Version V1.3.2':'Workspace version label missing',
  'Additional Fees Total':'Workspace invoice additional-fee transparency missing',
  'saveInvoiceImage':'Workspace PNG invoice export missing'
}
for token,msg in checks.items():
    if token not in src: raise SystemExit(msg)
PY

for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js "$ROOT"/workspace/js/*.js; do
  node --check "$f"
done

python3 - "$ROOT/online/js/app.js" "$ROOT/online/js/payment-institutions.js" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text(); reg=Path(sys.argv[2]).read_text()
for forbidden in ('Create Account','Sign Up','First Access'):
    if forbidden in app: raise SystemExit(f'Public registration language remains: {forbidden}')
checks={
  'V1.3.2':'Online version label missing',
  '/assets/onboarding/onboarding-1.png':'Onboarding 1 missing',
  '/assets/onboarding/onboarding-2.png':'Onboarding 2 missing',
  '/assets/onboarding/onboarding-3.png':'Onboarding 3 missing',
  'Type to search bank or e-wallet':'Searchable sender field missing',
  'paymentInstitutionDropdown':'Custom sender dropdown missing',
  'Preview Receipt':'Receipt preview control missing',
  'invoiceBrand()':'Shared invoice JUAN PROJECT wordmark missing',
  'System verification passed':'Client system verification missing',
  'Processing your payment':'Payment processing UX missing',
  'Payment Submitted':'Payment success UX missing',
  'Continue as Guest':'Guest browsing gate missing',
  'Additional Fees Total':'Online invoice transparency missing',
  'Save as Image':'Online image export missing'
}
for token,msg in checks.items():
    if token not in app: raise SystemExit(msg)
for code in ('gcash','bpi','bdo-mobile','bdo-web','maya','metrobank','landbank','unionbank','gotyme','maribank-seabank'):
    if f"code:'{code}'" not in reg: raise SystemExit(f'Missing sender validation: {code}')
PY

if ! grep -q "workspace_settings" "$ROOT/supabase/migrations/009_platform_v1_3_2.sql"; then echo "Shared settings migration missing"; exit 1; fi
if ! grep -q "is_valid_juan_payment_reference" "$ROOT/supabase/migrations/009_platform_v1_3_2.sql"; then echo "Payment reference validation migration missing"; exit 1; fi
if ! grep -q "sender_institution" "$ROOT/supabase/migrations/009_platform_v1_3_2.sql"; then echo "Payment sender migration missing"; exit 1; fi

if ! grep -q "status='accepted'" "$ROOT/supabase/migrations/010_platform_v1_3_2_payment_review_ui.sql"; then echo "Accepted payment review status migration missing"; exit 1; fi
if ! grep -q "payment_submissions_status_check" "$ROOT/supabase/migrations/010_platform_v1_3_2_payment_review_ui.sql"; then echo "Payment review status constraint migration missing"; exit 1; fi
if ! grep -q "delete-payment-review" "$ROOT/workspace/api/admin-portal.js"; then echo "Payment review delete API missing"; exit 1; fi

EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }

if grep -Rqi "Gemini" "$ROOT/online/js" "$ROOT/online/api"; then echo "Gemini payment language remains"; exit 1; fi

echo "JUAN PROJECT Platform V1.3.2 verification passed."
