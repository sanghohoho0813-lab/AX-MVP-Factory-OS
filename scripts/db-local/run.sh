#!/bin/bash
# 로컬 PostgreSQL 16 에 시험 DB(axqa)를 새로 만들고 마이그레이션을 차례로 적용한 뒤 보안 시험(test-*.sql)을 모두 돌린다.
# 운영 DB 와 상관없다. 사용: sudo bash scripts/db-local/run.sh   (pg_ctlcluster 16 main start 먼저)
# 결과: PASS/FAIL 줄. FAIL 이 하나라도 있으면 끝 코드 1.
set -u
cd "$(dirname "$0")/../.."
DIR=scripts/db-local
DB=${AXQA_DB:-axqa}
psqlq() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
psqlq < $DIR/supabase-shim.sql > /dev/null || exit 1
for f in supabase/migrations/*.sql; do
  if ! psqlq < "$f" > /dev/null 2> /tmp/db-local-err.txt; then echo "적용 실패: $f"; cat /tmp/db-local-err.txt; exit 1; fi
done
echo "마이그레이션 $(ls supabase/migrations/*.sql | wc -l)개 적용"
out=$(for t in $DIR/test-*.sql; do su postgres -c "psql -d $DB" < "$t" 2>&1; done | grep -E "PASS|FAIL|ERROR" | sed 's/^NOTICE:  //')
# 대표가 운영에서 맨 먼저 실행할 읽기 전용 점검(check_applied_0026_0028.sql) — 마이그레이션을 전부 넣은 DB 에서는 여덟 줄 모두 '들어감'
chk=$(su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/check_applied_0026_0028.sql)\"" 2>&1)
got="$(echo "$chk" | grep -cE '^1 먼저\|.*\|들어감$') $(echo "$chk" | grep -cE '^2 이번\|.*\|들어감$') $(echo "$chk" | grep -E '^2 이번' | grep -oE '[0-9]+/[0-9]+' | tr '\n' ' ')"
if [ "$got" = "5 3 12/12 8/8 10/10 " ]; then out="$out
PASS  점검 SQL(0026~0028 · 전부 넣은 DB): 먼저 5줄 · 이번 3줄 모두 '들어감'(12/12 · 8/8 · 10/10)"; else out="$out
FAIL  점검 SQL(0026~0028 · 전부 넣은 DB): $got (기대 5 3 12/12 8/8 10/10)"; fi
# D-635 0029 점검(check_applied_0029.sql) — 전부 넣은 DB 에서는 먼저 5줄 · 이번 1줄 '들어감'(7/7)
chk=$(su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/check_applied_0029.sql)\"" 2>&1)
got="$(echo "$chk" | grep -cE '^1 먼저\|.*\|들어감$') $(echo "$chk" | grep -cE '^2 이번\|.*\|들어감$') $(echo "$chk" | grep -E '^2 이번' | grep -oE '[0-9]+/[0-9]+' | tr '\n' ' ')$(echo "$chk" | grep -E '^0 확인' | cut -d'|' -f5)"
if [ "$got" = "5 1 7/7 on" ]; then out="$out
PASS  점검 SQL(0029 · 전부 넣은 DB): 읽기 전용 on · 먼저 5줄 · 이번 1줄 '들어감'(7/7)"; else out="$out
FAIL  점검 SQL(0029 · 전부 넣은 DB): $got (기대 5 1 7/7 on)"; fi
vfy=$(su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/verify_after_0029.sql)\"" 2>&1)
got="$(echo "$vfy" | grep -cE '^[1-5]\|.*\|좋음$') $(echo "$vfy" | grep -E '^8\|' | cut -d'|' -f3) $(echo "$vfy" | grep -c ERROR)"
if [ "$got" = "5 꺼짐 0" ]; then out="$out
PASS  확인 SQL(0029 · 전부 넣은 DB): 1~5 '좋음' · 0028 꺼짐 · 오류 0"; else out="$out
FAIL  확인 SQL(0029 · 전부 넣은 DB): $got (기대 5 꺼짐 0)"; fi
# D-638 0030 점검(check_applied_0030.sql) — 전부 넣은 DB: 읽기 전용 on · '들어감'(5/5) → 되돌리기 → '꺼짐(되돌림)' → 0030 다시 → '들어감'
c30() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/check_applied_0030.sql)\"" 2>&1 | tr '\n' ' '; }
a=$(c30); psqlq < supabase/manual/rollback_0030.sql > /dev/null 2>&1; b=$(c30); psqlq < supabase/migrations/20261119000030_ai_assist_results.sql > /dev/null 2>&1; c=$(c30)
if echo "$a" | grep -q '0 확인|0|읽기 전용 거래|on|on' && echo "$a" | grep -q '5/5|들어감' && echo "$b" | grep -q '꺼짐(되돌림)' && echo "$c" | grep -q '5/5|들어감'; then out="$out
PASS  점검 SQL(0030): 읽기 전용 on · '들어감'(5/5) → 되돌리기 → '꺼짐(되돌림)' → 다시 실행 → '들어감'"; else out="$out
FAIL  점검 SQL(0030): [$a] [$b] [$c]"; fi
echo "$out"
pass=$(echo "$out" | grep -c '^PASS'); bad=$(echo "$out" | grep -cE '^FAIL|ERROR')
echo "통과 $pass · 실패 $bad"
[ "$bad" -eq 0 ]
