#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  "$ROOT/VERSION"
  "$ROOT/workspace/index.html"
  "$ROOT/workspace/css/v1-3-ux.css"
  "$ROOT/workspace/sw.js"
  "$ROOT/online/index.html"
  "$ROOT/online/css/app.css"
  "$ROOT/online/js/app.js"
  "$ROOT/online/js/payment-institutions.js"
  "$ROOT/online/sw.js"
  "$ROOT/supabase/migrations/011_platform_v1_3_3.sql"
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
 'Database Connection':'Manual database settings missing',
 'Connect Database':'Manual Connect Database action missing',
 'Test Connection':'Manual database test missing',
 'Continue Offline':'Offline continuation missing',
 '○ OFFLINE / LOCAL':'Offline/local status missing',
 'Workspace opens in Local mode':'Manual-connect explanation missing',
 'function renderReportsView()':'Crash-safe Reports renderer missing',
 'Recent Payments':'Simplified Reports recent payments missing',
 'Approve Request':'Direct Payment Review approval missing',
 'Reject Request':'Direct Payment Review rejection missing',
 'Delete Request':'Direct Payment Review delete missing',
 'quickRejectReasonOptions':'Searchable rejection reason missing',
 '<th>Project</th><th>Amount</th><th>Bank / E-Wallet</th><th>Status</th><th>Date Submitted</th>':'Payment review table columns missing',
}
for token,msg in checks.items():
 if token not in src: raise SystemExit(msg)
if 'id="portalPaymentReviewModal"' in src: raise SystemExit('Legacy full Payment Review modal still present')
PY

python3 - "$ROOT/online/js/app.js" "$ROOT/online/index.html" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text();html=Path(sys.argv[2]).read_text()
checks={
 "JUAN_ONBOARDING_DONE_V7":'New onboarding routing key missing',
 'function home()':'Online Home/Guest Home function missing',
 'Guest Mode':'Guest Mode label missing',
 'Already a Client? Log In':'Guest login CTA missing',
 'portalLoadErrorScreen':'Portal load fallback missing',
 'Browse as Guest':'Guest fallback missing',
 'You still have ${peso(p.balance||0)} left to pay.':'Balance reminder missing',
 'JUAN PROJECT</div>':'Invoice JUAN PROJECT branding missing',
 'V1.3.3.2':'Online version label missing',
}
for token,msg in checks.items():
 if token not in app: raise SystemExit(msg)
if 'Thank you for working with JUAN PROJECT.' in app: raise SystemExit('Completion popup should not be part of startup notifications')
if 'boot-shell' not in html: raise SystemExit('Immediate Online boot shell missing')
PY

# Ensure startup does not auto-connect Workspace.
python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import sys,re
src=Path(sys.argv[1]).read_text()
m=re.search(r'async function initWorkspace\(\) \{(.*?)\n      \}',src,re.S)
if not m: raise SystemExit('initWorkspace not found')
body=m.group(1)
if 'await initSupabase()' in body or 'showWorkspaceAuthGate("Checking secure admin session' in body:
 raise SystemExit('Workspace still auto-connects on startup')
PY

echo "JUAN PROJECT Platform V1.3.3.2 verification passed."
