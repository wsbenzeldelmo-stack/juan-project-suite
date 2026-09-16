#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

required=(
  "$ROOT/VERSION"
  "$ROOT/README.md"
  "$ROOT/RELEASE_NOTES.md"
  "$ROOT/workspace/index.html"
  "$ROOT/workspace/js/v1-3-ux.js"
  "$ROOT/workspace/css/v1-3-ux.css"
  "$ROOT/workspace/sw.js"
  "$ROOT/workspace/api/admin-portal.js"
  "$ROOT/workspace/api/_payment-verification.js"
  "$ROOT/online/index.html"
  "$ROOT/online/css/app.css"
  "$ROOT/online/js/app.js"
  "$ROOT/online/js/auth.js"
  "$ROOT/online/js/payment-institutions.js"
  "$ROOT/online/sw.js"
  "$ROOT/supabase/migrations/012_platform_v1_3_3_2.sql"
  "$ROOT/supabase/migrations/013_client_id_identity_lock.sql"
  "$ROOT/supabase/migrations/014_platform_v1_3_3_2_npw_patch.sql"
  "$ROOT/docs/CLIENT_ID_MAPPING_V1_3_3_2.csv"
  "$ROOT/docs/V1_3_3_2_UPDATE_NOTES.md"
  "$ROOT/docs/CLIENT_ID_SYSTEM_PATCH.md"
  "$ROOT/online/assets/onboarding/onboarding-1.png"
  "$ROOT/online/assets/onboarding/onboarding-2.png"
  "$ROOT/online/assets/onboarding/onboarding-3.png"
  "$ROOT/online/assets/payment-institutions/gotyme.png"
  "$ROOT/online/assets/payment-institutions/maribank.png"
  "$ROOT/workspace/assets/payment-institutions/gotyme.png"
  "$ROOT/workspace/assets/payment-institutions/maribank.png"
)
for f in "${required[@]}"; do test -f "$f" || { echo "Missing: $f"; exit 1; }; done
[[ "$(tr -d '\r\n' < "$ROOT/VERSION")" == "1.3.3.2" ]] || { echo "VERSION is not 1.3.3.2"; exit 1; }

# Parse every JavaScript source and Workspace inline JavaScript.
for f in "$ROOT"/online/js/*.js "$ROOT"/online/api/*.js "$ROOT"/workspace/api/*.js "$ROOT"/workspace/js/*.js; do
  node --check "$f"
done
python3 - "$ROOT/workspace/index.html" "$ROOT/workspace/css/v1-3-ux.css" <<'PY'
from pathlib import Path
import re,sys,tempfile,subprocess
src=Path(sys.argv[1]).read_text(); css=Path(sys.argv[2]).read_text()
blocks=[m.group(2) for m in re.finditer(r'<script([^>]*)>(.*?)</script>',src,re.S|re.I) if 'src=' not in m.group(1)]
out=Path(tempfile.gettempdir())/'juan-workspace-inline-v1332-npw.js'
out.write_text('\n'.join(blocks))
subprocess.run(['node','--check',str(out)],check=True)
checks={
 'Version V1.3.3.2':'Workspace version label missing',
 'Database Connection':'Manual Database Connection UI missing',
 'connectDatabaseManually':'Manual Connect Database action missing',
 'disconnectDatabase':'Disconnect Database action missing',
 'Continue Offline':'Continue Offline action missing',
 '○ OFFLINE · LOCAL':'Offline/local startup state missing',
 'WORKSPACE_IDLE_MS = 30 * 60 * 1000':'30-minute Workspace idle timeout missing',
 'restoreWorkspaceCloudConnectionIfEligible':'Manual-session refresh restoration missing',
 'renderReportsView':'Reports renderer missing',
 'Reports couldn’t be loaded.':'Reports crash-safe fallback missing',
 'Revenue Trend':'Reports revenue trend missing',
 'Revenue Milestones':'Reports milestone section missing',
 '<th>Project ID</th><th>Project Name</th><th>Bank / E-Wallet</th><th>Ref ID</th><th>Status</th><th>Date Submitted</th>':'Payment Review table columns are wrong',
 'Approve Request':'Approve Request action missing',
 'Reject Request':'Reject Request action missing',
 'Delete Request':'Delete Request action missing',
 'paymentRejectQuickModal':'Compact rejection dialog missing',
 'CLIENT_MASTER_VERSION':'Client master version missing',
 'CLIENT_ID_BY_EMAIL':'Authoritative Client ID mapping missing from local Workspace',
 'setReportsRange':'Reports timeline selector logic missing',
 'This Month</option><option value="last-month">Last Month':'Reports timeline options missing',
 'CLIENT_ID_FLOOR = 46':'Client ID historical floor missing',
 'nextLocalClientCode':'Local next Client ID allocator missing',
 'findLocalClientByEmail':'Duplicate-email local identity lookup missing',
 'projectIsActiveByPayment':'Balance-aware active project logic missing',
 'JUAN PROJECT':'Invoice brand missing',
 'portal-client-access-table':'Client Access table sizing class missing',
 'v1332-static-table-final-override':'Static table final override missing',
 'workspace-loader-card':'Improved Workspace loading state missing',
 '<th class="table-actions-col" aria-label="Actions"></th>':'Payment Review trailing action column missing',
}
for token,msg in checks.items():
    if token not in src: raise SystemExit(msg)
for forbidden in ('Sync Client Accounts','Reboot Client Logins','Initial portal password = Client ID'):
    if forbidden in src: raise SystemExit(f'Removed client-account UI remains: {forbidden}')
if re.search(r'id=["\']manualSupabase(?:Key|Url)["\']',src,re.I) or 'Publishable Key' in src or '<label class="form-label">Supabase URL</label>' in src:
    raise SystemExit('Database credentials are still displayed in Workspace Settings')
# Offline action must clear in-memory database client.
m=re.search(r'function continueWorkspaceOffline\(\)\s*\{(.*?)\n\s*\}',src,re.S)
if not m or 'supabaseClient = null' not in m.group(1):
    raise SystemExit('Offline action does not clear the database client')
if 'id="portalPaymentReviewModal"' in src:
    raise SystemExit('Legacy full Payment Review modal still exists')
if 'NPW patch — Payment Review columns + mobile readability' not in css or '.portal-status-action' not in css:
    raise SystemExit('Payment Review responsive CSS missing')
PY

python3 - "$ROOT/online/js/app.js" "$ROOT/online/index.html" "$ROOT/online/css/app.css" <<'PY'
from pathlib import Path
import sys
app=Path(sys.argv[1]).read_text(); html=Path(sys.argv[2]).read_text(); css=Path(sys.argv[3]).read_text()
for forbidden in ('Create Account','Sign Up','First Access'):
    if forbidden in app: raise SystemExit(f'Public registration language remains: {forbidden}')
checks={
 'V1.3.3.2':'Online version label missing',
 "const REMEMBERED_CLIENT_KEY='JUAN_REMEMBERED_CLIENT'":'Remembered client routing key missing',
 'function home()':'Online Home renderer missing',
 'onboardingScreen()':'First-open onboarding missing',
 'Already a Client? Log In':'Guest-to-client login call-to-action missing',
 'Continue as Guest':'Guest-mode continuation missing',
 'Browse as Guest':'Portal-load Guest fallback missing',
 "We couldn't load your portal.":'Friendly portal-load error missing',
 "localStorage.setItem(REMEMBERED_CLIENT_KEY,'1')":'Persistent Online login is not forced on',
 'Your login stays saved on this device.':'Persistent login notice missing',
 'Make a Payment':'Balance reminder missing',
 'remaining balance':'Balance reminder amount label missing',
 '/assets/onboarding/onboarding-1.png':'Onboarding slide 1 missing',
 '/assets/onboarding/onboarding-2.png':'Onboarding slide 2 missing',
 '/assets/onboarding/onboarding-3.png':'Onboarding slide 3 missing',
}
for token,msg in checks.items():
    if token not in app: raise SystemExit(msg)
if 'Your initial password is your Client ID' in app or 'Initial portal password = Client ID' in app:
    raise SystemExit('Initial-password guidance is still displayed in Online UI')
if 'id="rememberLogin"' in app:
    raise SystemExit('Optional Remember Me checkbox remains; Online should persist login automatically')
if 'jp-boot-card' not in html:
    raise SystemExit('Improved Online loading card missing')
if 'storage:window.localStorage' not in Path(str(Path(sys.argv[1]).parent/'auth.js')).read_text():
    raise SystemExit('Online Supabase session is not explicitly persisted in localStorage')
if 'invoice-brand-wordmark' not in app:
    raise SystemExit('Plain JUAN PROJECT invoice wordmark missing')
if 'Thank you for working with JUAN PROJECT' in app:
    raise SystemExit('Automatic completion thank-you popup should not be active in this release')
if 'defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js' not in html:
    raise SystemExit('Supabase client script is still blocking first paint')
if 'jp-boot-shell' not in html or 'jp-boot-shell' not in css:
    raise SystemExit('Immediate Online boot shell missing')
PY

# Validate the authoritative Client ID mapping artifact and both identity migrations.
python3 - "$ROOT/docs/CLIENT_ID_MAPPING_V1_3_3_2.csv" "$ROOT/supabase/migrations/012_platform_v1_3_3_2.sql" "$ROOT/supabase/migrations/014_platform_v1_3_3_2_npw_patch.sql" <<'PY'
from pathlib import Path
import csv,sys
csvp=Path(sys.argv[1]); sql12=Path(sys.argv[2]).read_text(); sql14=Path(sys.argv[3]).read_text()
rows=list(csv.DictReader(csvp.open()))
if len(rows)!=46: raise SystemExit(f'Expected 46 mapped clients, found {len(rows)}')
expected=[f'CL-{i:03d}' for i in range(1,47)]
got=[r['Client ID'] for r in rows]
if got!=expected: raise SystemExit('Client IDs are not contiguous CL-001 through CL-046')
if len({r['Email'].strip().lower() for r in rows})!=46: raise SystemExit('Duplicate email exists in authoritative mapping')
for r in rows:
    if r['Client ID'] not in sql14 or r['Email'].lower() not in sql14.lower():
        raise SystemExit(f"Migration 014 missing mapping {r['Client ID']} {r['Email']}")
for token in ('assign_juan_client_code','max((substring(client_code','must_change_password','password_set'):
    if token not in sql12: raise SystemExit(f'Migration 012 missing {token}')
for token in ('greatest(','46,','system_maintenance_fee=0',"when 'gotyme'", "when 'maribank'"):
    if token not in sql14: raise SystemExit(f'Migration 014 missing {token}')
PY

python3 - "$ROOT/supabase/migrations/013_client_id_identity_lock.sql" "$ROOT/workspace/api/admin-portal.js" <<'PY'
from pathlib import Path
import sys
sql=Path(sys.argv[1]).read_text(); api=Path(sys.argv[2]).read_text()
for token in ('greatest(','46,','max((substring(client_code','enforce_juan_client_email_identity','juan-project-client-email:','23505'):
    if token not in sql: raise SystemExit(f'Migration 013 missing {token}')
for token in ('CLIENT_MASTER_VERSION','CLIENT_MASTER_BY_EMAIL','synchronizeClientMaster','juan_master_login_version','password:client.client_code','password_set:false','must_change_password:true'):
    if token not in api: raise SystemExit(f'Client master portal flow missing {token}')
if ".ilike('email',email).is('archived_at',null)" in api:
    raise SystemExit('Admin reconcile still ignores archived lifetime client identities')
PY

# Confirm bank/e-wallet support and service-worker cache bump.
grep -q "code:'gotyme'" "$ROOT/online/js/payment-institutions.js" || { echo 'GoTyme missing'; exit 1; }
grep -q "code:'maribank'" "$ROOT/online/js/payment-institutions.js" || { echo 'MariBank missing'; exit 1; }
grep -q "juan-online-v1.3.3.2-static-tables-loading2" "$ROOT/online/sw.js" || { echo 'Online SW cache version stale'; exit 1; }
grep -q "juan-workspace-v1.3.3.2-static-tables-loading2" "$ROOT/workspace/sw.js" || { echo 'Workspace SW cache version stale'; exit 1; }

# Preserve the supplied UnionBank QR bytes.
EXPECTED_QR_SHA="330adb858996ce52aebdb21ce0776da360533d6047620343b2afc000fb732d51"
ACTUAL_QR_SHA="$(sha256sum "$ROOT/online/assets/unionbank-bankqr-placeholder.jpg" | awk '{print $1}')"
[[ "$ACTUAL_QR_SHA" == "$EXPECTED_QR_SHA" ]] || { echo 'UnionBank QR asset was altered'; exit 1; }

if grep -Rqi 'Gemini' "$ROOT/online/js" "$ROOT/online/api"; then echo 'Gemini payment language remains'; exit 1; fi

echo 'JUAN PROJECT Platform V1.3.3.2 Static Tables + Loading patch verification passed.'
