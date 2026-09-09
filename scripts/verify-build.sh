#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for required in \
  "$ROOT/workspace/index.html" \
  "$ROOT/workspace/api/supabase-config.js" \
  "$ROOT/workspace/api/admin-portal.js" \
  "$ROOT/online/index.html" \
  "$ROOT/online/api/portal-data.js" \
  "$ROOT/online/api/payment-submission.js" \
  "$ROOT/supabase/migrations/001_shared_database_foundation.sql" \
  "$ROOT/supabase/migrations/002_updated_at_triggers.sql" \
  "$ROOT/supabase/migrations/003_shared_sync_security.sql" \
  "$ROOT/supabase/migrations/004_catalog_workspace_sync.sql"; do
  test -f "$required" || { echo "Missing: $required"; exit 1; }
done

python3 - "$ROOT/workspace/index.html" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
if not blocks: raise SystemExit('No Workspace inline JavaScript found')
p=Path(tempfile.gettempdir())/'juan-workspace-inline.js'
p.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(p)],check=True)
if 'imahemultimediaproductions@gmail.com' in src or 'trishakayemesana@gmail.com' in src:
    raise SystemExit('Historical client data is embedded in Workspace HTML')
PY

for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js; do
  node --check "$f"
done

echo "JUAN PROJECT Suite verification passed."
