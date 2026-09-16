#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  "$ROOT/VERSION"
  "$ROOT/workspace/index.html"
  "$ROOT/workspace/css/v1-3-ux.css"
  "$ROOT/workspace/api/admin-portal.js"
  "$ROOT/workspace/sw.js"
  "$ROOT/online/index.html"
  "$ROOT/online/css/app.css"
  "$ROOT/online/js/app.js"
  "$ROOT/online/js/payment-institutions.js"
  "$ROOT/online/api/portal-data.js"
  "$ROOT/online/sw.js"
  "$ROOT/supabase/migrations/011_platform_v1_3_3.sql"
  "$ROOT/docs/V1_3_3_2_UPDATE_NOTES.md"
)
for f in "${required[@]}"; do test -f "$f" || { echo "Missing: $f"; exit 1; }; done
[[ "$(tr -d '\r\n' < "$ROOT/VERSION")" == "1.3.3.2" ]] || { echo "VERSION is not 1.3.3.2"; exit 1; }
for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js "$ROOT"/workspace/js/*.js; do node --check "$f"; done
python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
out=Path(tempfile.gettempdir())/'juan-workspace-inline-v1332.js';out.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(out)],check=True)
checks={
 'OFFLINE / LOCAL':'Offline/local startup missing',
 'Database Connection':'Database settings card missing',
 'Test Connection':'Manual test button missing',
 'Connect Database':'Manual connect button missing',
 'Disconnect':'Manual disconnect button missing',
 'function renderReportsView':'Safe reports renderer missing',
 'Approve Request':'Payment approve menu action missing',
 'Reject Request':'Payment reject menu action missing',
 'Delete Request':'Payment delete menu action missing',
 'Date Submitted':'Payment submitted date missing',
 'paymentRejectQuickModal':'Compact rejection UI missing',
}
for token,msg in checks.items():
 if token not in src: raise SystemExit(msg)
if 'portalPaymentReviewModal' in src: raise SystemExit('Large Payment Review modal still present')
PY
python3 - "$ROOT/online/js/app.js" "$ROOT/online/index.html" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text();html=Path(sys.argv[2]).read_text()
checks={
 "ONBOARDING_KEY='JUAN_ONBOARDING_DONE_V7'":'New onboarding route missing',
 'function home(){':'Online Home/Guest renderer missing',
 'Already a Client? Log In':'Guest login CTA missing',
 'portalLoadErrorScreen':'Portal load fallback missing',
 'Browse as Guest':'Guest fallback missing',
 'FRIENDLY REMINDER':'Balance reminder missing',
 'function pickClientMessage':'Balance reminder logic missing',
 'V1.3.3.2':'Online version missing',
}
for token,msg in checks.items():
 if token not in app: raise SystemExit(msg)
if 'Thank you for working with JUAN PROJECT' in app: raise SystemExit('Automatic completion popup should not remain in V1.3.3.2')
if 'Opening JUAN PROJECT Online' not in html: raise SystemExit('Immediate first-paint shell missing')
PY
for svg in "$ROOT/workspace/assets/brand/juan-project.svg" "$ROOT/online/assets/brand/juan-project.svg"; do
  grep -q 'viewBox="0 0 1020 190"' "$svg" || { echo "Invoice logo viewBox fix missing: $svg"; exit 1; }
done
# Preserve the supplied UnionBank QR bytes.
EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }
echo "JUAN PROJECT Platform V1.3.3.2 verification passed."
