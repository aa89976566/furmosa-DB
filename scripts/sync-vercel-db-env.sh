#!/usr/bin/env bash
# 依 TARGET 把 DATABASE_URL／DIRECT_URL 寫入「單一」Vercel 環境。
#
#   TARGET=production  → 只接受正式庫 ukjjopridghvwzobrsus，只寫 Production
#   TARGET=preview     → 只接受與正式庫不同的 Preview 庫，只寫 Preview
#
# 兩者專案代號相同時立即停止。不輸出密碼或完整連線。
# 此腳本不會自動部署 Production。
#
# 用法：
#   export VERCEL_TOKEN=...
#   export VERCEL_PROJECT_ID=prj_eDlebDCQOJp9wl65O5zpASoLj1f9
#   export VERCEL_TEAM_ID=team_...   # 可選
#   export TARGET=preview            # 或 production
#   # DATABASE_URL / DIRECT_URL 已在環境中
#   bash scripts/sync-vercel-db-env.sh
set -euo pipefail

: "${VERCEL_TOKEN:?missing VERCEL_TOKEN}"
: "${VERCEL_PROJECT_ID:?missing VERCEL_PROJECT_ID}"
: "${DATABASE_URL:?missing DATABASE_URL}"
: "${DIRECT_URL:?missing DIRECT_URL}"
: "${TARGET:?missing TARGET（production 或 preview）}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUARD="$ROOT/scripts/lib/db-url-target-guard.py"

decision="$(
  python3 "$GUARD" \
    --target "$TARGET" \
    --database-url "$DATABASE_URL" \
    --direct-url "$DIRECT_URL"
)" || {
  echo "拒絕同步：$decision"
  exit 1
}

echo "通過隔離檢查：$decision"

API="https://api.vercel.com"
TEAM_QS=""
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  TEAM_QS="?teamId=${VERCEL_TEAM_ID}"
fi

auth_hdr=(-H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json")

upsert_env() {
  local key="$1"
  local value="$2"
  echo "Upsert ${key} → ${TARGET} only"
  curl -sS -X POST "${auth_hdr[@]}" \
    "${API}/v10/projects/${VERCEL_PROJECT_ID}/env${TEAM_QS}" \
    --data "$(KEY="$key" VALUE="$value" TARGET="$TARGET" python3 - <<'PY'
import json, os
print(json.dumps({
  "key": os.environ["KEY"],
  "value": os.environ["VALUE"],
  "type": "encrypted",
  "target": [os.environ["TARGET"]],
  "upsert": True,
}))
PY
)" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  →', d.get('created',{}).get('key') or d.get('key') or d.get('error') or 'done')"
}

guard_optional() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "未提供 ${key}，此腳本不會改後台現有值。請人工確認 Preview 的 ${key} 不是正式庫。"
    return 0
  fi
  python3 "$GUARD" \
    --target "$TARGET" \
    --database-url "$value" \
    --direct-url "$value" >/dev/null || {
    echo "拒絕同步：${key} 與 TARGET=${TARGET} 不符，或與正式庫代號相同。"
    exit 1
  }
  upsert_env "$key" "$value"
}

upsert_env DATABASE_URL "$DATABASE_URL"
upsert_env DIRECT_URL "$DIRECT_URL"
guard_optional POSTGRES_PRISMA_URL
guard_optional POSTGRES_URL

echo "完成。未部署 Production。若 TARGET=preview，請只重新部署該 Preview。"
