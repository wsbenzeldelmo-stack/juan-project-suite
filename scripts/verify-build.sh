#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for required in \
  "$ROOT/workspace/index.html" \
  "$ROOT/workspace/online-control.html" \
  "$ROOT/workspace/api/supabase-config.js" \
  "$ROOT/workspace/api/admin-portal.js" \
  "$ROOT/online/index.html" \
  "$ROOT/online/css/app.css" \
  "$ROOT/online/js/app.js" \
  "$ROOT/online/api/portal-data.js" \
  "$ROOT/online/api/payment-submission.js" \
  "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" \
  "$ROOT/supabase/migrations/001_shared_database_foundation.sql" \
  "$ROOT/supabase/migrations/002_updated_at_triggers.sql" \
  "$ROOT/supabase/migrations/003_shared_sync_security.sql" \
  "$ROOT/supabase/migrations/004_catalog_workspace_sync.sql" \
  "$ROOT/supabase/migrations/005_suite_v1_1.sql" \
  "$ROOT/supabase/verify_v1_1.sql" \
  "$ROOT/docs/reference/JUAN_PROJECT_ONLINE_UI_REFERENCE.png" \
  "$ROOT/docs/LEGACY_CLIENT_SEQUENCE_V1_1.csv"; do
  test -f "$required" || { echo "Missing: $required"; exit 1; }
done

python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
if not blocks: raise SystemExit('No Workspace inline JavaScript found')
p=Path(tempfile.gettempdir())/'juan-workspace-inline-v11.js'
p.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(p)],check=True)
if 'imahemultimediaproductions@gmail.com' in src or 'trishakayemesana@gmail.com' in src:
    raise SystemExit('Historical client data is embedded in Workspace HTML')
if 'data-view="online-portal"' not in src or 'id="view-online-portal"' not in src:
    raise SystemExit('Integrated Online Portal Workspace view is missing')
PY

for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js; do
  node --check "$f"
done

python3 - "$ROOT/online/js/app.js" "$ROOT/docs/LEGACY_CLIENT_SEQUENCE_V1_1.csv" <<'PY'
from pathlib import Path
import csv,sys
app=Path(sys.argv[1]).read_text()
if 'Create Account' in app or 'Sign Up' in app or 'First Access' in app:
    raise SystemExit('Public registration language remains in Online UI')
if "v1.1.0" not in app:
    raise SystemExit('Online UI version is not V1.1')
if 'shop-filters' not in app or 'shop-search' not in app:
    raise SystemExit('V1.1 Shop standardization is missing')
rows=list(csv.DictReader(open(sys.argv[2], newline='')))
if len(rows)!=45:
    raise SystemExit(f'Expected 45 legacy unique-client reference rows, found {len(rows)}')
PY

if ! grep -q "drive_url" "$ROOT/supabase/migrations/005_suite_v1_1.sql"; then
  echo "V1.1 project Drive migration missing"; exit 1
fi
if ! grep -q "portal_enabled" "$ROOT/supabase/migrations/005_suite_v1_1.sql"; then
  echo "V1.1 portal access field missing"; exit 1
fi
if ! grep -q "#online-portal" "$ROOT/workspace/online-control.html"; then
  echo "Legacy Online Portal Control redirect missing"; exit 1
fi

# The supplied UnionBank QR must remain byte-for-byte identical to the approved asset.
EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo "UnionBank QR asset was altered"; exit 1; }

echo "JUAN PROJECT Suite V1.1 verification passed."
