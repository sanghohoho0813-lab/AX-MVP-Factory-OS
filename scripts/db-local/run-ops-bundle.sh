#!/bin/bash
# D-662 운영 묶음(supabase/manual/apply_0026_0031_all.sql) 연습 — 운영과 같은 모양(0025 까지)의 로컬 DB 에
# SQL Editor 처럼 '붙여 넣은 글 한 덩어리' 로 넣어 본다. 운영 DB 와 상관없다(로컬 PostgreSQL 16 만).
#   ① 묶음 = 마이그레이션 원문(만드는 스크립트 --check)
#   ② 넣기 전 점검: 읽기 전용 on · 여섯 줄 '없음'
#   ③ 중간에 멈추면(끝에 오류를 끼운 묶음) 여섯 개 모두 안 들어감 — 전부 또는 전무
#   ④ 묶음 그대로: 오류 0 · 마지막 결과 여섯 줄 '들어감'
#   ⑤ 파일마다 있던 확인 · 점검 SQL 도 그대로 '좋음' · '들어감'
#   ⑥ 다시 넣어도 같음 · 계단 들여쓰기로 붙여도(D-597) 같음
#   ⑦ 이미 몇 개를 따로 넣어 둔 DB(0026 · 0027)에도 그대로
# 사용: sudo bash scripts/db-local/run-ops-bundle.sh   (pg_ctlcluster 16 main start 먼저)
set -u
cd "$(dirname "$0")/../.."
DB=axqabundle
BUNDLE=supabase/manual/apply_0026_0031_all.sql
CHECK=supabase/manual/check_applied_0026_0031.sql
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
# 글 한 덩어리로(SQL Editor 와 같게 — 마지막 결과만 본다)
blk() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" < "$1" 2>&1; }
blks() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" 2>&1; }
BAD=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $2"; else echo "FAIL  $1 = $2 (기대 $3)"; BAD=1; fi; }
# 묶음 뒤에 따로 넣는 것(0032 — 0026 이 있어야 한다)
LATER='20261126000032_view_always|20261127000033_customer_growth|20261128000034_result_receipts'
SIX='20261114000026_view_consent|20261114000027_intake_links|20261115000028_self_signup|20261118000029_signup_approval|20261119000030_ai_assist_results|20261123000031_upload_links'

# 운영 모양 — 0025 까지(여섯 개만 빼고 차례대로)
fresh() {
  su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
  q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
  for f in supabase/migrations/*.sql; do
    if echo "$f" | grep -qE "$SIX|$LATER"; then continue; fi
    q < "$f" > /dev/null 2>/tmp/bundle-err || { echo "적용 실패 $f"; cat /tmp/bundle-err; exit 1; }
  done
}
rows() { echo "$1" | grep -cE "^00(26|27|28|29|30|31)\|.*\|$2\$"; }

out=$(node scripts/make-ops-bundle.mjs --check 2>&1); echo "$out"; echo "$out" | grep -q '^PASS' || BAD=1

fresh
out=$(blk $CHECK)
check "묶음 ② 넣기 전 점검: 오류 0 · 여섯 줄 '없음' · 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(echo "$out" | grep -c ERROR) $(rows "$out" 없음) $(grep -v '^--' $CHECK | grep -m1 -v '^\s*$') $(grep -v '^\s*--' $CHECK | grep -ciE '\b(create|alter|drop|insert|update|delete|grant|revoke|truncate)\b')" "0 6 set transaction read only; 0"

# ③ 전부 또는 전무 — 맨 아래 commit 바로 앞에 오류를 끼운다
sed 's/^commit;$/select 1\/0;\ncommit;/' $BUNDLE > /tmp/bundle-broken.sql
out=$(blk /tmp/bundle-broken.sql)
after=$(blk $CHECK)
check "묶음 ③ 중간에 멈추면(끝에 오류) — 오류 남 · 여섯 개 모두 '없음' 그대로(전부 또는 전무)" "$(echo "$out" | grep -c 'division by zero') $(rows "$after" 없음)" "1 6"

# ④ 그대로 넣기
out=$(blk $BUNDLE)
check "묶음 ④ 한 번 붙여 넣기 — 오류 0 · 마지막 결과 여섯 줄 모두 '들어감'" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "0 6"
check "묶음 ④ 넣은 뒤 점검 한 장: 여섯 줄 '들어감' · 일부만 0" "$(rows "$(blk $CHECK)" 들어감) $(rows "$(blk $CHECK)" 일부만)" "6 0"

# ⑤ 파일마다 있던 확인 · 점검도 그대로
check "묶음 ⑤ 예전 점검 SQL — 0026~0028 세 줄 · 0029 · 0031 '들어감' · 0030 '들어감'" "$(blk supabase/manual/check_applied_0026_0028.sql | grep -cE '^2 이번\|.*\|들어감$') $(blk supabase/manual/check_applied_0029.sql | grep -cE '^2 이번\|.*\|들어감$') $(blk supabase/manual/check_applied_0031.sql | grep -cE '^2 이번\|.*\|들어감$') $(blk supabase/manual/check_applied_0030.sql | grep -c '들어감')" "3 1 1 1"
check "묶음 ⑤ 적용 뒤 확인 SQL — 0027 · 0028 · 0029 · 0031 모두 1~5 '좋음'" "$(blk supabase/manual/verify_after_0027.sql | grep -cE '^[1-5]\|.*\|좋음$') $(blk supabase/manual/verify_after_0028.sql | grep -cE '^[1-5]\|.*\|좋음$') $(blk supabase/manual/verify_after_0029.sql | grep -cE '^[1-5]\|.*\|좋음$') $(blk supabase/manual/verify_after_0031.sql | grep -cE '^[1-5]\|.*\|좋음$')" "5 5 5 5"
check "묶음 ⑤ 0028 은 꺼진 채 · 열린 링크 · 올리기 링크 0(기능만 들어가고 아무것도 켜지지 않음)" "$(su postgres -c "psql -At -d $DB" <<<"select (select count(*) from public.public_intake_links) || ' ' || (select count(*) from public.client_upload_links);" 2>&1) $(blk supabase/manual/verify_after_0028.sql | grep -E '^6\|' | grep -c '꺼짐')" "0 0 1"

# ⑥ 다시 · 들여쓰기
out=$(blk $BUNDLE)
check "묶음 ⑥ 다시 넣어도 같음 — 오류 0 · 여섯 줄 '들어감'" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "0 6"
out=$(sed 's/^/    /' $BUNDLE | blks)
check "묶음 ⑥ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0 · 여섯 줄 '들어감'" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "0 6"

# ⑦ 이미 몇 개를 따로 넣어 둔 DB
fresh
for m in 20261114000026_view_consent 20261114000027_intake_links; do q < supabase/migrations/$m.sql > /dev/null 2>/tmp/bundle-err || { echo "$m 실패"; cat /tmp/bundle-err; exit 1; }; done
before=$(blk $CHECK)
out=$(blk $BUNDLE)
check "묶음 ⑦ 0026 · 0027 을 먼저 따로 넣어 둔 DB — 넣기 전 '들어감' 2 · '없음' 4 → 묶음 뒤 오류 0 · 여섯 줄 '들어감'" "$(rows "$before" 들어감) $(rows "$before" 없음) $(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "2 4 0 6"

# ⑧ 묶음 뒤 0032(D-675 — 2026-11-26 운영과 같은 차례): SQL Editor 처럼 한 덩어리 · 오류 0 · 확인 SQL 1~5 '좋음' · 넣기만 해서는 켜진 곳 0 · 다시 · 들여쓰기
M32=supabase/migrations/20261126000032_view_always.sql
V32=supabase/manual/verify_after_0032.sql
out=$(blk $M32)
vfy=$(blk $V32)
check "묶음 ⑧ 묶음 뒤 0032 한 덩어리 — 오류 0 · 표 · 함수 있음 · 켜진 곳 0 / 확인 SQL 1~5 '좋음' · 6번 0곳 · 읽기 전용" "$(echo "$out" | grep -c ERROR) $(echo "$out" | tail -1) $(echo "$vfy" | grep -cE '^[1-5]\|.*\|좋음$') $(echo "$vfy" | grep -E '^6\|' | cut -d'|' -f3) $(grep -v '^--' $V32 | grep -m1 -v '^\s*$')" "0 t|t|0 5 0곳 set transaction read only;"
out=$(blk $M32); out2=$(sed 's/^/    /' $M32 | blks)
check "묶음 ⑧ 0032 다시 넣어도 · 계단 들여쓰기로 붙여도 오류 0" "$(echo "$out" | grep -c ERROR) $(echo "$out2" | grep -c ERROR)" "0 0"
check "묶음 ⑧ 예전 한 장 점검(0026~0031)은 0032 뒤에도 여섯 줄 '들어감'" "$(rows "$(blk $CHECK)" 들어감)" "6"

su postgres -c "dropdb --if-exists $DB" > /dev/null 2>&1
exit $BAD
