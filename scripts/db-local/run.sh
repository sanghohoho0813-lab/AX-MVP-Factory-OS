#!/bin/bash
# 로컬 PostgreSQL 16 에 시험 DB(axqa)를 새로 만들고 마이그레이션을 차례로 적용한 뒤 보안 시험(test-*.sql)을 모두 돌린다.
# 운영 DB 와 상관없다. 사용: sudo bash scripts/db-local/run.sh   (pg_ctlcluster 16 main start 먼저)
# 결과: PASS/FAIL 줄. FAIL 이 하나라도 있으면 끝 코드 1.
set -u
cd "$(dirname "$0")/../.."
DIR=scripts/db-local
psqlq() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d axqa"; }
su postgres -c "dropdb --if-exists axqa; createdb axqa" || exit 1
psqlq < $DIR/supabase-shim.sql > /dev/null || exit 1
for f in supabase/migrations/*.sql; do
  if ! psqlq < "$f" > /dev/null 2> /tmp/db-local-err.txt; then echo "적용 실패: $f"; cat /tmp/db-local-err.txt; exit 1; fi
done
echo "마이그레이션 $(ls supabase/migrations/*.sql | wc -l)개 적용"
out=$(for t in $DIR/test-*.sql; do su postgres -c "psql -d axqa" < "$t" 2>&1; done | grep -E "PASS|FAIL|ERROR" | sed 's/^NOTICE:  //')
echo "$out"
pass=$(echo "$out" | grep -c '^PASS'); bad=$(echo "$out" | grep -cE '^FAIL|ERROR')
echo "통과 $pass · 실패 $bad"
[ "$bad" -eq 0 ]
