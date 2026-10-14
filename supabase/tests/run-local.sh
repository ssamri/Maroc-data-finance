#!/usr/bin/env bash
# Local-only PostgreSQL validation. Never connects to a remote database.
set -euo pipefail

task_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
task_container="maroc-finance-sql-check-$$-${RANDOM}"
task_image="postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"
task_log="$(mktemp /tmp/maroc-finance-sql-check.XXXXXX.log)"
task_created=false

cleanup() {
  if "$task_created"; then docker rm --force "$task_container" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

command -v docker >/dev/null || { echo 'Docker is required for the local SQL checks.' >&2; exit 1; }
docker run --detach --name "$task_container" --network none \
  --env POSTGRES_HOST_AUTH_METHOD=trust "$task_image" >"$task_log" 2>&1
task_created=true
task_ready=false
for ((task_attempt = 0; task_attempt < 30; task_attempt++)); do
  # The image briefly starts a socket-only bootstrap server before restarting.
  # TCP readiness avoids mistaking that transient server for the final one.
  if docker exec "$task_container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then task_ready=true; break; fi
  sleep 1
done
if ! "$task_ready"; then echo 'Local PostgreSQL did not become ready.' >&2; docker logs "$task_container" >&2; exit 1; fi

run_sql() {
  if ! docker exec -i "$task_container" psql -U postgres -v ON_ERROR_STOP=1 <"$1" >>"$task_log" 2>&1; then
    echo "SQL validation failed in $(basename -- "$1"). Log: $task_log" >&2
    tail -60 "$task_log" >&2
    exit 1
  fi
}
run_sql "$task_root/supabase/tests/local-bootstrap.sql"
for task_migration in "$task_root"/supabase/migrations/*.sql; do run_sql "$task_migration"; done
run_sql "$task_root/supabase/tests/rls.sql"
echo "Local PostgreSQL migrations and RLS checks passed. Log: $task_log"
