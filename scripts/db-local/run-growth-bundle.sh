#!/bin/bash
# D-687 고객성장관리 운영 묶음 연습 — 운영과 같은 모양(0032 까지)의 로컬 DB 에 SQL Editor 처럼 '붙여 넣은 글 한 덩어리' 로 넣어 본다.
# 묶음 둘을 같은 차례로: apply_0033_0035_all.sql(세 개) · apply_0033_0036_all.sql(네 개 — D-689 · 대표가 실제로 붙일 한 장)
# + 0033 ~ 0035 묶음을 먼저 넣은 DB 에 0033 ~ 0036 묶음(⑨). 운영 DB 와 상관없다(로컬 PostgreSQL 16 만).
#   ① 묶음 = 마이그레이션 원문(만드는 스크립트 --check · 예전 0026~0031 묶음도 그대로)
#   ② 넣기 전 점검: 읽기 전용 · 세 줄 '없음'
#   ③ 먼저 있어야 하는 것(0026)이 빠진 DB — 그 자리에서 멈춤 · 아무것도 안 들어감
#   ④ 중간에 멈추면(끝에 오류를 끼운 묶음) 세 개 모두 안 들어감 — 전부 또는 전무
#   ⑤ 묶음 그대로: 오류 0 · 마지막 결과 세 줄 '들어감' · 파일마다 있던 확인 SQL 도 '좋음' · 보고서 · 열람 기록 0(켜지기만)
#   ⑥ 다시 넣어도 · 계단 들여쓰기로 붙여도(D-597) 같음 · '기록을 남기기 시작한 때'(0034) 그대로
#   ⑦ 0033 만 · 0033 + 0034 를 따로 넣어 둔 DB 에도 그대로 — 먼저 넣은 때를 덮지 않음
#   ⑧ 되돌리기(0036 →)0035 → 0034 → 0033 뒤 묶음을 다시 넣으면 권한이 돌아옴 · 예전 묶음(0026~0031) · 0032 는 그대로
#   ⑨ 0033 ~ 0035 묶음을 이미 넣은 DB 에 0033 ~ 0036 묶음 — 오류 0 · 네 줄 '들어감' · 넣은 때 그대로
# 사용: sudo bash scripts/db-local/run-growth-bundle.sh   (pg_ctlcluster 16 main start 먼저)
set -u
cd "$(dirname "$0")/../.."
DB=axqagrowthbundle
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
# 글 한 덩어리로(SQL Editor 와 같게 — 마지막 결과만 본다)
blk() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" < "$1" 2>&1; }
blks() { su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" 2>&1; }
one() { su postgres -c "psql -At -d $DB" <<<"$1" 2>&1; }
BAD=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $2"; else echo "FAIL  $1 = $2 (기대 $3)"; BAD=1; fi; }
LATER='20261127000033_customer_growth|20261128000034_result_receipts|20261128000035_result_new|20261128000036_recommendations'

# 운영 모양 — 0032 까지(0033 뒤 것은 빼고 차례대로). 인자로 더 뺄 것을 줄 수 있다(③)
fresh() {
  local skip="$LATER${1:+|$1}"
  su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
  q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
  for f in supabase/migrations/*.sql; do
    if echo "$f" | grep -qE "$skip"; then continue; fi
    q < "$f" > /dev/null 2>/tmp/growth-bundle-err || { echo "적용 실패 $f"; cat /tmp/growth-bundle-err; exit 1; }
  done
}
since() { if [ "$(one "select to_regproc('public.portal_result_receipts_since') is null;")" = t ]; then echo 없음; else one "select public.portal_result_receipts_since()::text;"; fi; }
good() { blk "$1" | grep -cE "^[1-$2]\|.*\|좋음$"; }

# suite 이름 묶음 점검 번호들(33|34|35) 줄수 '세' 확인들('파일:끝번호' …) 되돌리기들(뒤에서부터)
suite() {
  local T=$1 BUNDLE=$2 CHECK=$3 NOS=$4 N=$5 NW=$6 VERIFY=$7 ROLLBACK=$8
  rows() { echo "$1" | grep -cE "^00($NOS)\|.*\|$2\$"; }
  goods() { local out=""; for v in $VERIFY; do out="$out $(good supabase/manual/verify_after_${v%%:*}.sql ${v##*:})"; done; echo "${out# }"; }
  local want=""; for v in $VERIFY; do want="$want ${v##*:}"; done; want="${want# }"

  fresh
  local out after S1 S2 before
  out=$(blk $CHECK)
  check "$T ② 넣기 전 점검: 오류 0 · $NW 줄 '없음' · 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(echo "$out" | grep -c ERROR) $(rows "$out" 없음) $(grep -v '^--' $CHECK | grep -m1 -v '^\s*$') $(grep -v '^\s*--' $CHECK | grep -ciE '\b(create|alter|drop|insert|update|delete|grant|revoke|truncate)\b')" "0 $N set transaction read only; 0"
  check "$T ② 묶음에 지우는 문장 0(drop table · drop column · truncate · delete from)" "$(grep -v '^\s*--' $BUNDLE | grep -ciE 'drop table|drop column|truncate|delete from')" "0"

  # ③ 먼저 있어야 하는 것이 빠진 DB(0026 ~ 0032 없음)
  fresh '20261114000026_view_consent|20261114000027_intake_links|20261115000028_self_signup|20261118000029_signup_approval|20261119000030_ai_assist_results|20261123000031_upload_links|20261126000032_view_always'
  out=$(blk $BUNDLE)
  after=$(blk $CHECK)
  check "$T ③ 0026 이 없는 DB — '0033 은 … 넣은 뒤에' 로 멈춤 · $NW 줄 모두 '없음' 그대로" "$(echo "$out" | grep -c '0033 은 0006 · 0016 · 0023 · 0026 을 넣은 뒤에') $(rows "$after" 없음)" "1 $N"

  fresh
  # ④ 전부 또는 전무 — 맨 아래 commit 바로 앞에 오류를 끼운다
  sed 's/^commit;$/select 1\/0;\ncommit;/' $BUNDLE > /tmp/growth-bundle-broken.sql
  out=$(blk /tmp/growth-bundle-broken.sql)
  after=$(blk $CHECK)
  check "$T ④ 중간에 멈추면(끝에 오류) — 오류 남 · $NW 개 모두 '없음' 그대로 · 넣은 때 함수도 없음(전부 또는 전무)" "$(echo "$out" | grep -c 'division by zero') $(rows "$after" 없음) $(since)" "1 $N 없음"

  # ⑤ 그대로 넣기
  out=$(blk $BUNDLE)
  check "$T ⑤ 한 번 붙여 넣기 — 오류 0 · 마지막 결과 $NW 줄 모두 '들어감'" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "0 $N"
  check "$T ⑤ 넣은 뒤 점검 한 장: $NW 줄 '들어감' · 일부만 0" "$(rows "$(blk $CHECK)" 들어감) $(rows "$(blk $CHECK)" 일부만)" "$N 0"
  check "$T ⑤ 확인 SQL — 모두 '좋음'($want)" "$(goods)" "$want"
  check "$T ⑤ 켜지기만 — 보고서 0 · 열람 기록 0 · 넣은 때 = 오늘" "$(one "select (select count(*) from public.portal_reports) || ' ' || (select count(*) from public.portal_receipts) || ' ' || (public.portal_result_receipts_since()::date = current_date);")" "0 0 true"
  S1=$(since)

  # ⑥ 다시 · 들여쓰기 — 넣은 때는 처음 그대로
  sleep 1
  out=$(blk $BUNDLE)
  check "$T ⑥ 다시 넣어도 같음 — 오류 0 · $NW 줄 '들어감' · 넣은 때 그대로" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감) $([ "$(since)" = "$S1" ] && echo 같음 || echo 바뀜)" "0 $N 같음"
  out=$(sed 's/^/    /' $BUNDLE | blks)
  check "$T ⑥ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0 · $NW 줄 '들어감' · 넣은 때 그대로" "$(echo "$out" | grep -c ERROR) $(rows "$out" 들어감) $([ "$(since)" = "$S1" ] && echo 같음 || echo 바뀜)" "0 $N 같음"
  check "$T ⑥ 다시 넣은 뒤에도 확인 SQL 그대로 '좋음'($want)" "$(goods)" "$want"

  # ⑧ 되돌리기 → 다시(같은 DB 에서 이어서)
  out=$(for r in $ROLLBACK; do blk supabase/manual/rollback_$r.sql; done)
  check "$T ⑧ 되돌리기 $(echo $ROLLBACK | sed 's/ / → /g') — 오류 0 · 고객 함수 권한 0 · 점검 한 장은 '들어감'(권한만 거둠)" "$(echo "$out" | grep -c ERROR) $(one "select has_function_privilege('authenticated', 'public.portal_result_summary()', 'execute') or has_function_privilege('authenticated', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute') or has_function_privilege('authenticated', 'public.portal_reports(uuid)', 'execute') or coalesce(to_regproc('public.portal_show_recommendation') is not null and has_function_privilege('authenticated', 'public.portal_recommendations(uuid)', 'execute'), false);") $(rows "$(blk $CHECK)" 들어감)" "0 f $N"
  out=$(blk $BUNDLE)
  check "$T ⑧ 되돌린 뒤 묶음을 다시 — 오류 0 · 확인 SQL '좋음'($want) · 넣은 때 그대로" "$(echo "$out" | grep -c ERROR) $(goods) $([ "$(since)" = "$S1" ] && echo 같음 || echo 바뀜)" "0 $want 같음"
  check "$T ⑧ 예전 것은 그대로 — 0026~0031 한 장 점검 여섯 줄 '들어감' · 0032 확인 1~5 '좋음'" "$(blk supabase/manual/check_applied_0026_0031.sql | grep -cE '^00(26|27|28|29|30|31)\|.*\|들어감$') $(good supabase/manual/verify_after_0032.sql 5)" "6 5"

  # ⑦ 0033 만 따로 넣어 둔 DB
  fresh
  q < supabase/migrations/20261127000033_customer_growth.sql > /dev/null 2>/tmp/growth-bundle-err || { echo "0033 실패"; cat /tmp/growth-bundle-err; exit 1; }
  before=$(blk $CHECK)
  out=$(blk $BUNDLE)
  check "$T ⑦ 0033 을 먼저 따로 넣어 둔 DB — 넣기 전 '들어감' 1 · '없음' $((N - 1)) → 묶음 뒤 오류 0 · $NW 줄 '들어감'" "$(rows "$before" 들어감) $(rows "$before" 없음) $(echo "$out" | grep -c ERROR) $(rows "$out" 들어감)" "1 $((N - 1)) 0 $N"

  # ⑦ 0033 + 0034 를 따로 넣어 둔 DB — 먼저 넣은 때를 덮지 않음
  fresh
  for m in 20261127000033_customer_growth 20261128000034_result_receipts; do q < supabase/migrations/$m.sql > /dev/null 2>/tmp/growth-bundle-err || { echo "$m 실패"; cat /tmp/growth-bundle-err; exit 1; }; done
  S2=$(since)
  sleep 1
  before=$(blk $CHECK)
  out=$(blk $BUNDLE)
  check "$T ⑦ 0033 · 0034 를 따로 넣어 둔 DB — 넣기 전 '들어감' 2 · '없음' $((N - 2)) → 묶음 뒤 오류 0 · $NW 줄 '들어감' · 넣은 때는 먼저 넣은 때 그대로" "$(rows "$before" 들어감) $(rows "$before" 없음) $(echo "$out" | grep -c ERROR) $(rows "$out" 들어감) $([ "$(since)" = "$S2" ] && echo 같음 || echo 바뀜)" "2 $((N - 2)) 0 $N 같음"
}

out=$(node scripts/make-ops-bundle.mjs --check 2>&1); echo "$out"; echo "$out" | grep -q '^PASS' || BAD=1

suite '성장 묶음' supabase/manual/apply_0033_0035_all.sql supabase/manual/check_applied_0033_0035.sql '33|34|35' 3 세 '0033:6 0034:4 0035:3' '0035 0034 0033'
suite '성장 묶음(0036까지)' supabase/manual/apply_0033_0036_all.sql supabase/manual/check_applied_0033_0036.sql '33|34|35|36' 4 네 '0033:6 0034:4 0035:3 0036:6' '0036 0035 0034 0033'

# ⑨ 0033 ~ 0035 묶음을 먼저 넣은 DB(대표가 예전 안내대로 이미 넣었을 때)에 0033 ~ 0036 묶음
fresh
blk supabase/manual/apply_0033_0035_all.sql > /dev/null
S9=$(since)
sleep 1
before=$(blk supabase/manual/check_applied_0033_0036.sql)
out=$(blk supabase/manual/apply_0033_0036_all.sql)
check "성장 묶음 ⑨ 0033 ~ 0035 묶음을 이미 넣은 DB — 넣기 전 '들어감' 3 · '없음' 1(0036) → 0033 ~ 0036 묶음 뒤 오류 0 · 네 줄 '들어감' · 넣은 때 그대로 · 0036 확인 1~6 '좋음'" "$(echo "$before" | grep -cE '^00(33|34|35|36)\|.*\|들어감$') $(echo "$before" | grep -cE '^0036\|.*\|없음$') $(echo "$out" | grep -c ERROR) $(echo "$out" | grep -cE '^00(33|34|35|36)\|.*\|들어감$') $([ "$(since)" = "$S9" ] && echo 같음 || echo 바뀜) $(good supabase/manual/verify_after_0036.sql 6)" "3 1 0 4 같음 6"

su postgres -c "dropdb --if-exists $DB" > /dev/null 2>&1
exit $BAD
