#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
W="$ROOT/workspace/index.html"
O="$ROOT/online/js/app.js"
M="$ROOT/supabase/migrations/015_realtime_sync_bus.sql"
[[ -f "$W" && -f "$O" && -f "$M" ]] || { echo "Realtime sync patch files are missing"; exit 1; }
grep -q "table:'juan_sync_events'" "$W" || { echo "Workspace realtime subscription missing"; exit 1; }
grep -q "table:'juan_sync_events'" "$O" || { echo "Online realtime subscription missing"; exit 1; }
grep -q "startWorkspaceRealtimeSync" "$W" || { echo "Workspace realtime startup missing"; exit 1; }
grep -q "startPortalRealtimeSync" "$O" || { echo "Online realtime startup missing"; exit 1; }
grep -q "alter publication supabase_realtime add table public.juan_sync_events" "$M" || { echo "Realtime publication migration missing"; exit 1; }
grep -q "juan_sync_events_client_read" "$M" || { echo "Client-scoped realtime RLS missing"; exit 1; }
grep -q "payment_submissions" "$M" || { echo "Portal-to-Workspace event trigger coverage missing"; exit 1; }
grep -q "catalog_package_items" "$M" || { echo "Catalog realtime trigger coverage missing"; exit 1; }
grep -q "platform-update-v134" "$ROOT/workspace/sw.js" || { echo "Workspace cache bump missing"; exit 1; }
grep -q "platform-update-v134" "$ROOT/online/sw.js" || { echo "Online cache bump missing"; exit 1; }
node --check "$O" >/dev/null
python - "$W" <<'PY'
import re, subprocess, sys, tempfile, pathlib
p=pathlib.Path(sys.argv[1])
s=p.read_text()
blocks=[x for x in re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',s,re.S|re.I) if x.strip()]
for i,b in enumerate(blocks):
    path=pathlib.Path(tempfile.gettempdir())/f'juan-workspace-inline-{i}.js'
    path.write_text(b)
    r=subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
    if r.returncode:
        print(r.stderr,file=sys.stderr);sys.exit(r.returncode)
PY
echo "JUAN PROJECT realtime sync patch verification passed."
