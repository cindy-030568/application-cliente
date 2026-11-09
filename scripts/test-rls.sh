#!/usr/bin/env bash
# Lance les migrations + les tests de sécurité sur un Postgres local jetable.
# Usage : npm run test:rls   (nécessite Postgres 15+ installé localement)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=""
if [ "$(id -u)" = "0" ]; then chown postgres "$DIR"; RUN="runuser -u postgres --"; fi
cleanup() { $RUN "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
$RUN "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_simulation_supabase.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "→ migration $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
for f in "$ROOT"/supabase/tests/[0-9]*_rls_*.sql; do echo "→ tests $(basename "$f")"; "${PSQL[@]}" -f "$f" 2>&1 | sed -n 's/.*NOTICE:  //p'; done
echo "✅ Tous les tests de sécurité sont passés."
