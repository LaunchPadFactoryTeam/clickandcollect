#!/usr/bin/env bash
# Tests de base de données (pgTAP) de @launchpadfactoryteam/db.
# - PGHOST défini (CI : `supabase db start`, avec PGPORT, PGUSER, PGPASSWORD, PGDATABASE) :
#   la base existe déjà, les migrations ont été appliquées par Supabase.
# - Sinon : un cluster Postgres jetable est créé, les migrations y sont appliquées, puis détruit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS="$ROOT/packages/db/supabase/migrations"
TESTS="$ROOT/packages/db/test"

if [[ -z "${PGHOST:-}" ]]; then
  PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
  [[ -x "$PGBIN/initdb" ]] || { echo "Postgres introuvable : définir PGHOST ou PGBIN" >&2; exit 2; }
  WORK="$(mktemp -d)"
  PORT="${PGPORT:-54399}"
  RUN=()
  if [[ "$(id -u)" == "0" ]]; then chown postgres "$WORK"; RUN=(runuser -u postgres --); fi
  cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
  trap cleanup EXIT
  "${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -w start >/dev/null
  export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
  # Postgres simple : rôles et schéma auth de Supabase reproduits avant les migrations.
  psql -q -v ON_ERROR_STOP=1 -f "$TESTS/support/supabase-shim.psql"
  for f in $(ls "$MIGRATIONS"/*.sql 2>/dev/null | sort); do
    psql -q -v ON_ERROR_STOP=1 -f "$f"
  done
fi

psql -q -v ON_ERROR_STOP=1 -c "create extension if not exists pgtap;"
pg_prove --ext .sql -r "$TESTS"
# Numérotation concurrente : plusieurs connexions simultanées, hors de portée de pgTAP.
node "$ROOT/packages/db/test/concurrency.mjs"
