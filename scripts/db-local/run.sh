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
# D-652 0031 점검(check_applied_0031.sql) — 전부 넣은 DB: 읽기 전용 on · 먼저 3줄 · '들어감'(7/7) → 되돌리기 → '꺼짐(되돌림)' → 0031 다시 → '들어감' · 확인 SQL 1~5 '좋음'
c31() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/check_applied_0031.sql)\"" 2>&1 | tr '\n' ' '; }
a=$(c31); psqlq < supabase/manual/rollback_0031.sql > /dev/null 2>&1; b=$(c31); psqlq < supabase/migrations/20261123000031_upload_links.sql > /dev/null 2>&1; c=$(c31)
v31=$(su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/verify_after_0031.sql)\"" 2>&1 | grep -cE '^[1-5]\|.*\|좋음$')
if echo "$a" | grep -q '0 확인|0|읽기 전용 거래|on|on' && [ "$(echo "$a" | grep -o '|들어감' | wc -l)" = "4" ] && echo "$a" | grep -q '7/7|들어감' && echo "$b" | grep -q '꺼짐(되돌림)' && echo "$c" | grep -q '7/7|들어감' && [ "$v31" = "5" ]; then out="$out
PASS  점검 SQL(0031): 읽기 전용 on · 먼저 3줄 · '들어감'(7/7) → 되돌리기 → '꺼짐(되돌림)' → 다시 실행 → '들어감' · 확인 SQL 1~5 '좋음'"; else out="$out
FAIL  점검 SQL(0031): [$a] [$b] [$c] 확인 $v31/5"; fi
# D-675 0032 확인(verify_after_0032.sql) — 전부 넣은 DB: 1~5 '좋음' → 대표가 켠 뒤 되돌리기 → 켜진 0 · 앱이 못 켬 → 0032 다시 → 다시 켤 수 있음
v32() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/verify_after_0032.sql)\"" 2>&1; }
on32() { su postgres -c "psql -At -d $DB" 2>&1 <<SQL
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select coalesce((public.view_always_set((select w.id from public.workspaces w where w.owner_id = '19000000-0000-0000-0000-0000000000b1' limit 1), $1)->'always') is not null, false);
SQL
}
a=$(v32 | grep -cE '^[1-5]\|.*\|좋음$'); t=$(on32 true | tail -1); n1=$(v32 | grep -E '^6\|' | cut -d'|' -f3)
psqlq < supabase/manual/rollback_0032.sql > /dev/null 2>&1; n2=$(v32 | grep -E '^6\|' | cut -d'|' -f3); e=$(on32 true | grep -c 'permission denied')
psqlq < supabase/migrations/20261126000032_view_always.sql > /dev/null 2>&1; t2=$(on32 true | tail -1); on32 false > /dev/null
if [ "$a" = "5" ] && [ "$t" = "t" ] && echo "$n1" | grep -q '최 팀장 작업공간' && [ "$n2" = "0곳" ] && [ "$e" = "1" ] && [ "$t2" = "t" ]; then out="$out
PASS  확인 SQL(0032): 1~5 '좋음' · 켜면 6번에 그 작업공간 이름 → 되돌리기 → '0곳' · 앱이 못 켬 → 다시 실행 → 다시 켤 수 있음"; else out="$out
FAIL  확인 SQL(0032): 좋음 $a/5 · 켜기 [$t] · 켠 뒤 [$n1] · 되돌린 뒤 [$n2] · 막힘 $e · 다시 [$t2]"; fi
# D-681 0033 확인(verify_after_0033.sql) — 전부 넣은 DB: 1~6 '좋음' → 되돌리기 → 앱이 부를 수 없음(false · false · false) → 0033 다시 → 다시 '좋음' · 부를 수 있음
v33() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat supabase/manual/verify_after_0033.sql)\"" 2>&1; }
a=$(v33 | grep -cE '^[1-6]\|.*\|좋음$'); w=$(v33 | grep -c ERROR)
r=$(psqlq < supabase/manual/rollback_0033.sql 2>&1 | grep -E '^ *f *\| *f *\| *f' | wc -l)
rb=$(su postgres -c "psql -At -d $DB -c \"select has_function_privilege('authenticated', 'public.portal_growth_summary()', 'execute')::text || has_function_privilege('authenticated', 'public.portal_withdraw_report(uuid,text)', 'execute')::text || has_table_privilege('authenticated', 'public.portal_reports', 'select')::text\"" 2>&1)
psqlq < supabase/migrations/20261127000033_customer_growth.sql > /dev/null 2>&1
b=$(v33 | grep -cE '^[1-6]\|.*\|좋음$')
ra=$(su postgres -c "psql -At -d $DB -c \"select has_function_privilege('authenticated', 'public.portal_growth_summary()', 'execute')::text || has_function_privilege('authenticated', 'public.portal_withdraw_report(uuid,text)', 'execute')::text || has_table_privilege('authenticated', 'public.portal_reports', 'select')::text\"" 2>&1)
if [ "$a $w $rb $b $ra" = "6 0 falsefalsefalse 6 truetruetrue" ]; then out="$out
PASS  확인 SQL(0033): 1~6 '좋음' · 읽기 전용 · 되돌리기 → 앱이 부를 수 없음 · 표도 못 읽음 → 0033 다시 → 다시 '좋음' · 부를 수 있음"; else out="$out
FAIL  확인 SQL(0033): 좋음 $a/6 · 오류 $w · 되돌린 뒤 [$rb] · 다시 넣은 뒤 좋음 $b/6 · [$ra]"; fi
echo "$out"
pass=$(echo "$out" | grep -c '^PASS'); bad=$(echo "$out" | grep -cE '^FAIL|ERROR')
echo "통과 $pass · 실패 $bad"
[ "$bad" -eq 0 ]
