#!/usr/bin/env bash
# 用環境變數中的 DATABASE_URL、DIRECT_URL 覆寫 Vercel，並觸發 Production redeploy。
#
# 用法：
#   export VERCEL_TOKEN=...          # https://vercel.com/account/tokens
#   export VERCEL_PROJECT_ID=prj_eDlebDCQOJp9wl65O5zpASoLj1f9
#   export VERCEL_TEAM_ID=team_...   # 可選
#   # DATABASE_URL / DIRECT_URL 已在環境中
#   bash scripts/sync-vercel-db-env.sh
set -euo pipefail

: "${VERCEL_TOKEN:?missing VERCEL_TOKEN}"
: "${VERCEL_PROJECT_ID:?missing VERCEL_PROJECT_ID}"
: "${DATABASE_URL:?missing DATABASE_URL}"
: "${DIRECT_URL:?missing DIRECT_URL}"

API="https://api.vercel.com"
TEAM_QS=""
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  TEAM_QS="?teamId=${VERCEL_TEAM_ID}"
fi

auth_hdr=(-H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json")

upsert_env() {
  local key="$1"
  local value="$2"
  echo "Upsert ${key} → production+preview…"
  curl -sS -X POST "${auth_hdr[@]}" \
    "${API}/v10/projects/${VERCEL_PROJECT_ID}/env${TEAM_QS}" \
    --data "$(KEY="$key" VALUE="$value" python3 - <<'PY'
import json, os
print(json.dumps({
  "key": os.environ["KEY"],
  "value": os.environ["VALUE"],
  "type": "encrypted",
  "target": ["production", "preview"],
  "upsert": True,
}))
PY
)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  →', d.get('created',{}).get('key') or d.get('key') or d.get('error') or 'done')"
}

upsert_env DATABASE_URL "$DATABASE_URL"
upsert_env DIRECT_URL "$DIRECT_URL"

echo "Redeploy Production from main…"
curl -sS -X POST "${auth_hdr[@]}" \
  "${API}/v13/deployments${TEAM_QS}" \
  --data "{\"name\":\"furmosa-db\",\"project\":\"${VERCEL_PROJECT_ID}\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"org\":\"aa89976566\",\"repo\":\"furmosa-DB\",\"ref\":\"main\"}}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  →', d.get('url') or d.get('id') or d.get('error') or d)"

echo "Check: https://furmosa-db.vercel.app/api/health"
