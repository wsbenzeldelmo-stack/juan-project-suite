#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=(
  "$ROOT/VERSION"
  "$ROOT/workspace/index.html"
  "$ROOT/workspace/css/v1-3-ux.css"
  "$ROOT/workspace/api/admin-portal.js"
  "$ROOT/workspace/api/_payment-verification.js"
  "$ROOT/workspace/sw.js"
  "$ROOT/online/index.html"
  "$ROOT/online/css/app.css"
  "$ROOT/online/js/app.js"
  "$ROOT/online/js/payment-institutions.js"
  "$ROOT/online/api/portal-data.js"
  "$ROOT/online/api/payment-submission.js"
  "$ROOT/online/api/account.js"
  "$ROOT/online/sw.js"
  "$ROOT/supabase/migrations/011_platform_v1_3_3.sql"
  "$ROOT/docs/V1_3_3_UPDATE_NOTES.md"
  "$ROOT/online/assets/onboarding/onboarding-1.png"
  "$ROOT/online/assets/onboarding/onboarding-2.png"
  "$ROOT/online/assets/onboarding/onboarding-3.png"
)
for f in "${required[@]}"; do test -f "$f" || { echo "Missing: $f"; exit 1; }; done
[[ "$(tr -d '\r\n' < "$ROOT/VERSION")" == "1.3.3" ]] || { echo "VERSION is not 1.3.3"; exit 1; }

for logo in bdo.png gcash.png bpi.png maya.png metrobank.png landbank.png unionbank.png pnb.png others.svg; do
  test -f "$ROOT/online/assets/payment-institutions/$logo" || { echo "Missing Online institution logo: $logo"; exit 1; }
  test -f "$ROOT/workspace/assets/payment-institutions/$logo" || { echo "Missing Workspace institution logo: $logo"; exit 1; }
done

# 9:16 onboarding images and expected V1.3.3 content hashes.
python3 - "$ROOT" <<'PY'
from pathlib import Path
import hashlib,sys
root=Path(sys.argv[1])
expected={
 'onboarding-1.png':'6b7616544b8a79e2ba5cecc6fe0a638f7a9dd797480a62a148f7de8f03e93dbd',
 'onboarding-2.png':'edfe3a8c217ca743b475cba0f17037ea76f25092d569dffe3baeca8b51c92bac',
 'onboarding-3.png':'10760405500d6543946848169b0ae46c1eaa547bce549f349fecfce754605128',
}
for name,sha in expected.items():
 p=root/'online/assets/onboarding'/name
 got=hashlib.sha256(p.read_bytes()).hexdigest()
 if got!=sha: raise SystemExit(f'Unexpected onboarding asset: {name}')
PY

# Parse every JavaScript file and Workspace inline scripts.
for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js "$ROOT"/workspace/js/*.js; do node --check "$f"; done
python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
out=Path(tempfile.gettempdir())/'juan-workspace-inline-v133.js';out.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(out)],check=True)
checks={
 'Version V1.3.3':'Workspace V1.3.3 label missing',
 'Colorful Mode':'Colorful Mode missing',
 'renderReportsView':'Reports renderer missing',
 'Reports couldn':'Reports error state missing',
 'queueOfflineProject':'Offline project queue missing',
 'flushOfflineSyncQueue':'Offline reconnect sync missing',
 'Saved offline':'Offline save feedback missing',
 'delivery_status':'Persistent delivery status missing',
 'System Maintenance Fee':'Maintenance fee invoice line missing',
 'saveInvoiceImage':'Workspace invoice image export missing',
 '<th>Project</th><th>Amount</th><th>Bank / E-Wallet</th><th>Status</th>':'Simplified Payment Reviews table missing',
 'openPortalPaymentReview':'Payment Review modal missing',
 'delete-payment-review':'Payment Review delete action missing',
 'paymentRejectReasonOptions':'Searchable rejection reason missing',
}
for token,msg in checks.items():
 if token not in src: raise SystemExit(msg)
PY

python3 - "$ROOT/online/js/app.js" "$ROOT/online/js/payment-institutions.js" "$ROOT/online/api/portal-data.js" <<'PY'
from pathlib import Path
import sys,re
app=Path(sys.argv[1]).read_text();reg=Path(sys.argv[2]).read_text();portal=Path(sys.argv[3]).read_text()
for forbidden in ('Create Account','Sign Up','First Access'):
 if forbidden in app: raise SystemExit(f'Public registration language remains: {forbidden}')
checks={
 'V1.3.3':'Online version label missing',
 '/assets/onboarding/onboarding-1.png':'Onboarding 1 missing',
 '/assets/onboarding/onboarding-2.png':'Onboarding 2 missing',
 '/assets/onboarding/onboarding-3.png':'Onboarding 3 missing',
 'Type to search bank or e-wallet':'Searchable sender control missing',
 'institution-logo-tile':'Institution logo tile missing',
 'Preview Receipt':'Receipt preview missing',
 'System verification':'Client payment verification missing',
 'Payment Submitted':'Payment success state missing',
 'Save as Image':'Online invoice PNG export missing',
 'Save / Print PDF':'Online invoice PDF/print missing',
 'System Maintenance Fee':'Online invoice maintenance fee missing',
 'profilePhotoInput':'Client profile photo UI missing',
 'Thank you for working with JUAN PROJECT':'Completion thank-you missing',
 'Make a Payment':'Balance reminder action missing',
}
for token,msg in checks.items():
 if token not in app: raise SystemExit(msg)
expected=['bdo','gcash','bpi','maya','metrobank','landbank','unionbank','pnb','others']
codes=re.findall(r"\{code:'([^']+)'",reg)
if codes!=expected: raise SystemExit(f'Unexpected current sender list: {codes}')
if 'delivery_status' not in portal or 'profile_photo_url' not in portal: raise SystemExit('Online shared project/profile fields missing')
PY

# Exercise the client-side validation registry with known valid/invalid examples.
node --input-type=module - "$ROOT/online/js/payment-institutions.js" <<'NODE'
const mod=await import('file://'+process.argv[2]);
const valid={bdo:'MA_PC-A1B2C3D4-123456',gcash:'1002345678901',bpi:'BPI1234567890',maya:'MAYA12345678',metrobank:'123456789012',landbank:'12345678901234',unionbank:'UBP20260910123',pnb:'12345678901234',others:'123456789012345'};
for(const [code,ref] of Object.entries(valid)){const x=mod.validatePaymentReference(code,ref);if(!x.ok)throw new Error(`${code} valid sample failed: ${x.message}`)}
if(mod.validatePaymentReference('gcash','2026-09-10-123').ok)throw new Error('Invalid GCash reference accepted');
if(mod.validatePaymentReference('bdo','FT123456789').ok)throw new Error('Invalid BDO reference accepted');
NODE

MIG="$ROOT/supabase/migrations/011_platform_v1_3_3.sql"
for token in \
  "delivery_status" \
  "profile_photo_path" \
  "is_valid_juan_payment_reference" \
  "review_juan_payment_submission" \
  "payments.id" \
  "juan-profile-images" \
  "when 'pnb'" \
  "when 'others'"; do
  grep -q "$token" "$MIG" || { echo "Migration 011 missing: $token"; exit 1; }
done

# Preserve the supplied UnionBank QR bytes.
EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }

if grep -Rqi "Gemini" "$ROOT/online/js" "$ROOT/online/api"; then echo "Gemini payment language remains"; exit 1; fi

echo "JUAN PROJECT Platform V1.3.3 verification passed."
