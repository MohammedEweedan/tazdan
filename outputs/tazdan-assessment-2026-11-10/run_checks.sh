#!/usr/bin/env bash
set -euo pipefail
project_root=/Users/moe/Downloads/promrkts
assessment_dir="$project_root/outputs/tazdan-assessment-2026-11-10"
pg_bin=/Applications/Postgres.app/Contents/Versions/18/bin
pg_data="$(mktemp -d /private/tmp/tazdan-assessment-pg.XXXXXX)"
pg_port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
stop_assessment_db() {
  "$pg_bin/pg_ctl" -D "$pg_data/data" -m fast stop > "$assessment_dir/postgres-stop.log" 2>&1 || true
}
trap stop_assessment_db EXIT
"$pg_bin/initdb" -D "$pg_data/data" -U assessment --auth=trust --locale=C > "$assessment_dir/postgres-init.log" 2>&1
"$pg_bin/pg_ctl" -D "$pg_data/data" -l "$assessment_dir/postgres.log" -o "-p $pg_port -h 127.0.0.1 -k $pg_data" start > "$assessment_dir/postgres-start.log" 2>&1
"$pg_bin/createdb" -h 127.0.0.1 -p "$pg_port" -U assessment tazdan_assessment
export DATABASE_URL="postgresql://assessment@127.0.0.1:$pg_port/tazdan_assessment"
export RUN_DB_TESTS=1 NODE_ENV=test CI=true
cd "$project_root/server"
npx prisma migrate deploy > "$assessment_dir/migrations.log" 2>&1
npx jest --runInBand --json --outputFile="$assessment_dir/server-tests.json" --forceExit > "$assessment_dir/server-tests.log" 2>&1
