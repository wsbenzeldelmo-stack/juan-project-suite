#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for required in \
  "$ROOT/workspace/index.html" \
  "$ROOT/workspace/css/v1-2-ux.css" \
  "$ROOT/workspace/js/v1-2-ux.js" \
  "$ROOT/workspace/api/admin-portal.js" \
  "$ROOT/online/index.html" \
  "$ROOT/online/css/app.css" \
  "$ROOT/online/js/app.js" \
  "$ROOT/online/api/portal-data.js" \
  "$ROOT/online/api/payment-submission.js" \
  "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" \
  "$ROOT/supabase/migrations/005_suite_v1_1.sql" \
  "$ROOT/supabase/migrations/006_suite_v1_1_1.sql" \
  "$ROOT/supabase/migrations/007_platform_v1_2.sql" \
  "$ROOT/docs/LEGACY_CLIENT_SEQUENCE_V1_1.csv" \
  "$ROOT/docs/V1_2_UX_STANDARD.md"; do
  test -f "$required" || { echo "Missing: $required"; exit 1; }
done

python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
p=Path(tempfile.gettempdir())/'juan-workspace-inline-v12.js'
p.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(p)],check=True)
if '<title>JUAN PROJECT Workspace</title>' not in src:
    raise SystemExit('Workspace browser title is not standardized')
if '/css/v1-2-ux.css' not in src or '/js/v1-2-ux.js' not in src:
    raise SystemExit('Workspace V1.2 UX layer is not loaded')
if 'drive_unlock_at' not in src or 'drive_expires_at' not in src:
    raise SystemExit('Workspace project-folder time controls are missing')
PY

for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js "$ROOT"/workspace/js/*.js; do
  node --check "$f"
done

python3 - "$ROOT/online/js/app.js" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text()
for forbidden in ('Create Account','Sign Up','First Access'):
    if forbidden in app: raise SystemExit(f'Public registration language remains: {forbidden}')
checks={
  'v1.2':'Online version label missing',
  'Everything about your project, in one place.':'Three-step onboarding missing',
  'Order Confirmed':'Order Tracker stages missing',
  'Ready for Delivery':'Order Tracker delivery stage missing',
  'drive_unlock_at':'Time-locked folder logic missing',
  'Checking your payment':'Payment processing UX missing',
  'Payment Submitted':'Payment success UX missing',
  'Price: Low to High':'Shop price sort missing',
  'Email or password is incorrect.':'Login validation copy missing'
}
for token,msg in checks.items():
    if token not in app: raise SystemExit(msg)
PY

if ! grep -q "drive_unlock_at" "$ROOT/supabase/migrations/007_platform_v1_2.sql"; then
  echo "V1.2 Drive unlock migration missing"; exit 1
fi
if ! grep -q "drive_expires_at" "$ROOT/supabase/migrations/007_platform_v1_2.sql"; then
  echo "V1.2 Drive expiry migration missing"; exit 1
fi

EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }

echo "JUAN PROJECT Platform V1.2 verification passed."
