#!/usr/bin/env bash
# 用臨時 Postgres 驗證店家身分寫入，結束後刪除容器。
# 不連正式 LINE、綠界或排程；正式庫代號出現就立刻停止。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OFFICIAL_REF="ukjjopridghvwzobrsus"
CONTAINER="furmosa-identity-tmp"
PASSWORD="persist-only"
USE_DOCKER=1
if [[ "${1:-}" == "--no-docker" ]]; then
  USE_DOCKER=0
fi

url_has_official() {
  local value="${1:-}"
  [[ "$value" == *"$OFFICIAL_REF"* ]] || [[ "$value" == *supabase.co* ]]
}

if url_has_official "${DATABASE_URL:-}" || url_has_official "${DIRECT_URL:-}"; then
  echo "拒絕：連線指向正式庫，停止臨時寫入測試。"
  exit 1
fi

unset LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN LINE_CHANNEL_ID
unset ECPAY_HASH_KEY ECPAY_HASH_IV ECPAY_MERCHANT_ID
unset CRON_SECRET

cleanup() {
  if [[ "$USE_DOCKER" -eq 1 ]]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}

if [[ "$USE_DOCKER" -eq 1 ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "這台機器沒有 Docker。請在 CI 跑，或先安裝 Docker。"
    exit 1
  fi
  trap cleanup EXIT
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD="$PASSWORD" \
    -e POSTGRES_USER=persist \
    -e POSTGRES_DB=persist \
    -p 55432:5432 \
    postgres:16 >/dev/null
  for _ in $(seq 1 40); do
    if docker exec "$CONTAINER" pg_isready -U persist -d persist >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  export DATABASE_URL="postgresql://persist:${PASSWORD}@127.0.0.1:55432/persist"
  export DIRECT_URL="$DATABASE_URL"
fi

: "${DATABASE_URL:?missing DATABASE_URL}"
: "${DIRECT_URL:=$DATABASE_URL}"
export DIRECT_URL

if url_has_official "$DATABASE_URL" || url_has_official "$DIRECT_URL"; then
  echo "拒絕：連線指向正式庫，停止臨時寫入測試。"
  exit 1
fi

export IDENTITY_PERSIST_TEST=1
unset VERCEL_ENV

npx prisma migrate deploy >/dev/null
node --import tsx --test lib/jar-exchange/__tests__/partner-store-identity-persist.test.ts
if [[ "$USE_DOCKER" -eq 1 ]]; then
  echo "臨時庫寫入測試完成。Docker 容器會自動刪除。"
else
  echo "臨時庫寫入測試完成。此模式不建立、也不刪除外部 Postgres。"
fi
