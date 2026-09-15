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
  "$ROOT/online/assets/onboarding/onboarding-1.png"
  "$ROOT/online/assets/onboarding/onboarding-2.png"
  "$ROOT/online/assets/onboarding/onboarding-3.png"
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
 'Version V1.3.3.2':'Workspace version label missing',
 '<th>Project</th><th>Amount</th><th>Bank / E-Wallet</th><th>Status</th><th>Date Submitted</th>':'Payment Review table is not simplified',
 'Approve Request':'Approve Request action missing',
 'Reject Request':'Reject Request action missing',
 'Delete Request':'Delete Request action missing',
 'portalPaymentRejectModal':'Compact rejection dialog missing',
 'setReportRange':'Reports period filter missing',
 'Revenue Trend':'Reports revenue trend missing',
 'Outstanding Projects':'Reports outstanding projects missing',
 'Recent Payments':'Reports recent payments missing',
 'Reports couldn':'Reports crash fallback missing',
}
for token,msg in checks.items():
 if token not in src: raise SystemExit(msg)
for forbidden in ('portalPaymentReviewModal','View Review'):
 if forbidden in src: raise SystemExit(f'Old Payment Review modal flow still present: {forbidden}')
PY

python3 - "$ROOT/online/js/app.js" "$ROOT/online/assets/brand/juan-project.svg" "$ROOT/workspace/assets/brand/juan-project.svg" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text(); online_logo=Path(sys.argv[2]).read_text(); workspace_logo=Path(sys.argv[3]).read_text()
checks={
 "JUAN_ONBOARDING_DONE_V7":'New onboarding-first flow key missing',
 'function home(){':'Online Home renderer missing',
 'GUEST MODE':'Guest Mode missing',
 'Browse Services':'Guest browsing action missing',
 "if(!onboarded){state.onboardingStep=0;return onboardingScreen();}":'First-open onboarding routing missing',
 'portalLoadErrorScreen':'Portal load recovery screen missing',
 'Browse as Guest':'Portal failure guest fallback missing',
 'Log In as Client':'Guest login action missing',
 'V1.3.3.2':'Online version label missing',
}
for token,msg in checks.items():
 if token not in app: raise SystemExit(msg)
for forbidden in ('Create Account','Sign Up','First Access'):
 if forbidden in app: raise SystemExit(f'Public registration language remains: {forbidden}')
for name,logo in [('Online',online_logo),('Workspace',workspace_logo)]:
 if 'JUAN PROJECT' not in logo or 'viewBox="0 0 1040 190"' not in logo: raise SystemExit(f'{name} invoice logo can still clip JUAN PROJECT')
PY

EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }

if grep -Rqi "Gemini" "$ROOT/online/js" "$ROOT/online/api"; then echo "Gemini payment language remains"; exit 1; fi

echo "JUAN PROJECT Platform V1.3.3.2 verification passed."
