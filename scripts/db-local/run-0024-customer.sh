#!/bin/bash
# D-533 · D-534 대표가 SQL Editor 에서 실행할 파일을 **그대로**(이메일만 바꿔) 돌려 본다 — 운영 DB 와 상관없다.
#   1) 빈 DB 에 0001~0015 만 → check_applied_0016_0024.sql: 0016~0024 모두 '없음' · 읽기 전용(쓰기 0)
#   2) 마이그레이션 전부 → 대표 작업공간 · 받는 곳 → pilot_provision.sql(내부 팀장) → 대표 연결됨
#      → customer_provision.sql(외부 고객) → 대표 연결 안 됨 · AI customer · 다시 실행해도 같음 → check: 모두 '들어감'
#   3) 운영 적용 연습(docs/OPS_0023_0024_RUNBOOK.md 그대로) — 0022 까지 + 대표 ↔ 팀장 연결된 DB 에
#      precheck → 0023 · 0024(한 덩어리 · lock_timeout) → verify_after → try(전부 되돌림) → rollback → 다시 적용 → 고객 있으면 rollback 거부
# SQL Editor 처럼 '붙여 넣은 글 한 덩어리' 로 보내려고 psql -c "$(cat 파일)" 을 쓴다(편집기도 마지막 결과 하나만 보여 준다).
# 사용: sudo bash scripts/db-local/run-0024-customer.sh   (pg_ctlcluster 16 main start 먼저)
set -u
cd "$(dirname "$0")/../.."
DB=axqa24
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
v() { su postgres -c "psql -At -d $DB" <<<"$1"; }
# 파일 하나를 한 덩어리로(SQL Editor 와 같게) — 앞에 붙일 글($2)이 있으면 붙인다
blk() { local body; body="${2:-}$(cat "$1")"; su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" <<<"$body" 2>&1; }
BAD=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $2"; else echo "FAIL  $1 = $2 (기대 $3)"; BAD=1; fi; }

# 1) 0015 까지만 — 점검 SQL 이 '없음' 을 말하는지 · 아무것도 쓰지 않는지
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in 2026100400001[6-9]*|202610*0001[6-9]*|202610*0002*|202611*) continue ;; esac
  q < "$f" > /dev/null 2>/tmp/s24 || { echo "적용 실패 $f"; cat /tmp/s24; exit 1; }
done
before=$(v "select count(*) from pg_stat_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0")
out=$(blk supabase/manual/check_applied_0016_0024.sql)
check "점검 SQL(0015 까지): 0016~0024 아홉 줄 모두 '없음'" "$(echo "$out" | grep -cE '^1 마이그레이션\|(1[6-9]|2[0-4])\|.*\|없음$')" "9"
check "점검 SQL: 결과 표 하나 — 마지막 결과만 보여 주는 편집기에서도 다 보임(SET 다음 줄이 전부 표)" "$(echo "$out" | grep -vc '|')" "1"
# 0026 ~ 0028 점검 SQL(check_applied_0026_0028.sql) — 아무것도 없는 DB 에서도 오류 없이 '없음'(없는 표를 읽지 않는다) · 읽기 전용
out2=$(blk supabase/manual/check_applied_0026_0028.sql)
check "점검 SQL(0026~0028 · 0015 까지인 DB): 오류 0 · 읽기 전용 on · 먼저 5줄 · 이번 3줄 모두 '없음'" "$(echo "$out2" | grep -c 'ERROR') $(echo "$out2" | grep -E '^0 확인' | cut -d'|' -f5) $(echo "$out2" | grep -cE '^1 먼저\|.*\|없음$') $(echo "$out2" | grep -cE '^2 이번\|.*\|없음$')" "0 on 5 3"
check "점검 SQL(0026~0028): 맨 위 set transaction read only · 만들기/고치기 문장 0 · 결과 표 하나" "$(grep -v '^--' supabase/manual/check_applied_0026_0028.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/check_applied_0026_0028.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|grant|revoke|truncate)\b') $(echo "$out2" | grep -vc '|')" "set transaction read only; 0 1"
check "점검 SQL: 한 덩어리로 보내면 맨 첫 줄 '읽기 전용 거래 = on'" "$(echo "$out" | grep -c '^0 확인|0|읽기 전용 거래|.*|on$')" "1"
check "점검 SQL: 오류 없이 끝남" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(su postgres -c "psql -At -F '|' -d $DB -f supabase/manual/check_applied_0016_0024.sql" 2>&1)
check "점검 SQL: 한 줄씩 실행(psql -f)해도 오류 없이 같은 아홉 줄(읽기 전용 줄은 off — 경고만)" "$(echo "$out" | grep -cE '^1 마이그레이션\|(1[6-9]|2[0-4])\|.*\|없음$') $(echo "$out" | grep -c 'ERROR')" "9 0"
check "점검 SQL: 같은 덩어리 안 쓰기 문장은 막힘(read only 장치가 실제로 걸림)" "$(su postgres -c "psql -At -d $DB -c \"set transaction read only; insert into public.workspaces (id, name, owner_id) values (gen_random_uuid(), 'x', gen_random_uuid()); select 1\"" 2>&1 | grep -c 'read-only transaction')" "1"
out=$(blk supabase/manual/precheck_0023_0024.sql)
check "적용 전 점검(0015 까지): 0016~0018 · 0019/0020 줄이 '멈춤' · 오류 없음" "$(echo "$out" | grep -cE '^(1|2)\|.*\|멈춤') $(echo "$out" | grep -c 'ERROR')" "2 0"
check "점검 SQL · 적용 전 점검: 쓰기 0(표에 넣기 · 고치기 · 지우기 없음)" "$(v "select count(*) from pg_stat_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0")" "$before"
for f in check_applied_0016_0024 precheck_0023_0024 verify_after_0023_0024; do
  check "$f: 맨 위 첫 문장이 set transaction read only · 그 밖에 만들기/고치기 문장 0" "$(grep -v '^--' supabase/manual/$f.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/$f.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on)\b')" "set transaction read only; 0"
done

# 2) 전부 적용 → 대표가 SQL Editor 에서 할 일 그대로
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
q > /dev/null <<'SQL' || { echo "사람 준비 실패"; exit 1; }
insert into auth.users (id, email) values
  ('24000000-0000-4000-8000-0000000000a1', 'owner24@x.kr'),
  ('24000000-0000-4000-8000-0000000000b1', 'pilot24@x.kr'),
  ('24000000-0000-4000-8000-0000000000d1', 'cust24@x.kr') on conflict do nothing;
SQL
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in *_os_access_pilot.sql|*_owner_views_pilot.sql|*_owner_ai_workspace.sql|*_customer_audience.sql|*_support_messages.sql|*_view_consent.sql|*_view_always.sql|*_intake_links.sql|*_self_signup.sql|*_signup_approval.sql|*_upload_links.sql|*_customer_growth.sql|*_result_receipts.sql) continue ;; esac
  q < "$f" > /dev/null 2>/tmp/s24 || { echo "적용 실패 $f"; cat /tmp/s24; exit 1; }
done
q > /dev/null <<'SQL' || { echo "대표 작업공간 준비 실패"; exit 1; }
insert into public.workspaces (id, name, owner_id, created_at) values ('24aaaaaa-0000-4000-8000-00000000000a', '대표 회사', '24000000-0000-4000-8000-0000000000a1', '2026-01-02');
insert into public.workspace_members (workspace_id, user_id, role) values ('24aaaaaa-0000-4000-8000-00000000000a', '24000000-0000-4000-8000-0000000000a1', 'owner');
insert into public.operations_clients (id, workspace_id, company_name, payload) values ('o24-secret', '24aaaaaa-0000-4000-8000-00000000000a', '대표비밀24', '{}');
SQL
q < supabase/migrations/20261007000019_os_access_pilot.sql > /dev/null 2>/tmp/s24 || { echo "0019 실패"; cat /tmp/s24; exit 1; }
q < supabase/migrations/20261008000020_owner_views_pilot.sql > /dev/null 2>/tmp/s24 || { echo "0020 실패"; cat /tmp/s24; exit 1; }
q < supabase/migrations/20261014000021_owner_ai_workspace.sql > /dev/null 2>/tmp/s24 || { echo "0021 실패"; cat /tmp/s24; exit 1; }
q < supabase/migrations/20261104000024_customer_audience.sql > /dev/null 2>/tmp/s24 || { echo "0024 실패"; cat /tmp/s24; exit 1; }
check "0024 뒤: 기존 계정 audience 모두 internal" "$(v "select count(*) from public.os_access where audience <> 'internal'")" "0"
sed "s/여기에_Pilot_이메일@example.com/pilot24@x.kr/" supabase/manual/pilot_provision.sql | q > /dev/null 2>/tmp/s24 || { echo "pilot_provision 실패"; cat /tmp/s24; exit 1; }
PW=$(v "select id from public.workspaces where owner_id = '24000000-0000-4000-8000-0000000000b1'")
check "내부 팀장(pilot_provision): pilot · internal · 대표가 편집자(팀장 화면 그대로)" "$(v "select tier || ' ' || audience from public.os_access where user_id = '24000000-0000-4000-8000-0000000000b1'") $(v "select role from public.workspace_members where workspace_id = '$PW' and user_id = '24000000-0000-4000-8000-0000000000a1'")" "pilot internal editor"
sed "s/여기에_고객_이메일@example.com/cust24@x.kr/" supabase/manual/customer_provision.sql | q > /dev/null 2>/tmp/s24 || { echo "customer_provision 실패"; cat /tmp/s24; exit 1; }
sed "s/여기에_고객_이메일@example.com/cust24@x.kr/" supabase/manual/customer_provision.sql | q > /dev/null 2>/tmp/s24 || { echo "customer_provision 두 번째 실패"; cat /tmp/s24; exit 1; }
CW=$(v "select id from public.workspaces where owner_id = '24000000-0000-4000-8000-0000000000d1'")
check "외부 고객(customer_provision): pilot · customer · 작업공간 하나(두 번 실행해도)" "$(v "select tier || ' ' || audience from public.os_access where user_id = '24000000-0000-4000-8000-0000000000d1'") $(v "select count(*) from public.workspaces where owner_id = '24000000-0000-4000-8000-0000000000d1'")" "pilot customer 1"
check "외부 고객: 구성원은 고객 한 사람(owner) — 대표 없음" "$(v "select string_agg(role::text, ',') from public.workspace_members where workspace_id = '$CW'")" "owner"
check "외부 고객: AI 권한 customer · growth · 한도 600 · 기한 있음" "$(v "select kind || ' ' || plan || ' ' || monthly_units || ' ' || (active_until > now())::text from public.ai_entitlements where user_id = '24000000-0000-4000-8000-0000000000d1'")" "customer growth 600 true"
# 그 뒤 대표가 pilot_provision 을 다른 팀장에게 또 실행해도(연결 함수가 다시 돌아도) 고객은 그대로
check "연결 함수 다시 실행 → 고객 작업공간에 대표 0" "$(v "select public.os_access_link_owner_to_pilots()") $(v "select count(*) from public.workspace_members where workspace_id = '$CW' and user_id = '24000000-0000-4000-8000-0000000000a1'")" "0 0"
check "대표 팀장 화면 목록 = 내부 팀장 하나" "$(su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-0000000000a1', false); set role authenticated; select count(*) from public.my_pilot_views();" | tail -1)" "1"
check "pilot_provision 을 고객 이메일로 잘못 실행해도 — 대표가 고객 작업공간에 안 들어감" "$(sed "s/여기에_Pilot_이메일@example.com/cust24@x.kr/" supabase/manual/pilot_provision.sql | q > /dev/null 2>&1; v "select count(*) from public.workspace_members where workspace_id = '$CW' and user_id = '24000000-0000-4000-8000-0000000000a1'")" "0"
# 점검 SQL — 전부 들어감
out=$(blk supabase/manual/check_applied_0016_0024.sql)
check "점검 SQL(전부 적용): 0016~0024 아홉 줄 모두 '들어감'" "$(echo "$out" | grep -cE '^1 마이그레이션\|(1[6-9]|2[0-4])\|.*\|들어감$')" "9"
check "점검 SQL: 등급 요약에 개인 정보(이메일) 없음" "$(echo "$out" | grep -c '@')" "0"
out=$(blk supabase/manual/verify_after_0023_0024.sql)
check "적용 뒤 확인(고객 있음): 대표 쪽 계정이 고객 작업공간 구성원 0 · 고객 AI internal 0" "$(echo "$out" | grep -cE '^(8|9)\|.*\|0\|좋음$')" "2"
check "되돌리기: 외부 고객이 있으면 거부 · 장치 그대로" "$(blk supabase/manual/rollback_0023_0024.sql | grep -c '외부 고객 계정이 있어 되돌리지 않습니다') $(v "select count(*) from pg_trigger where tgname in ('zz_workspace_id_lock', 'zz_os_access_customer_member') and not tgisinternal" )" "1 20"

# 3) 운영 적용 연습 — 운영과 같은 상태(0022 까지 · 대표 ↔ 팀장 연결)에서 안내서 순서 그대로
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
q > /dev/null <<'SQL' || { echo "사람 준비 실패"; exit 1; }
insert into auth.users (id, email) values
  ('24000000-0000-4000-8000-0000000000a1', 'owner24@x.kr'),
  ('24000000-0000-4000-8000-0000000000b1', 'pilot24@x.kr') on conflict do nothing;
SQL
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in *_os_access_pilot.sql|*_owner_views_pilot.sql|*_owner_ai_workspace.sql|*_ai_usage.sql|*_workspace_id_lock.sql|*_customer_audience.sql|*_support_messages.sql|*_view_consent.sql|*_view_always.sql|*_intake_links.sql|*_self_signup.sql|*_signup_approval.sql|*_upload_links.sql|*_customer_growth.sql|*_result_receipts.sql) continue ;; esac
  q < "$f" > /dev/null 2>/tmp/s24 || { echo "적용 실패 $f"; cat /tmp/s24; exit 1; }
done
q > /dev/null <<'SQL' || { echo "대표 작업공간 준비 실패"; exit 1; }
insert into public.workspaces (id, name, owner_id, created_at) values ('24aaaaaa-0000-4000-8000-00000000000a', '대표 회사', '24000000-0000-4000-8000-0000000000a1', '2026-01-02');
insert into public.workspace_members (workspace_id, user_id, role) values ('24aaaaaa-0000-4000-8000-00000000000a', '24000000-0000-4000-8000-0000000000a1', 'owner');
insert into public.operations_clients (id, workspace_id, company_name, payload) values ('o24-secret', '24aaaaaa-0000-4000-8000-00000000000a', '대표비밀24', '{}');
SQL
for m in 20261007000019_os_access_pilot 20261008000020_owner_views_pilot 20261014000021_owner_ai_workspace 20261025000022_ai_usage; do
  q < supabase/migrations/$m.sql > /dev/null 2>/tmp/s24 || { echo "$m 실패"; cat /tmp/s24; exit 1; }
done
sed "s/여기에_Pilot_이메일@example.com/pilot24@x.kr/" supabase/manual/pilot_provision.sql | q > /dev/null 2>/tmp/s24 || { echo "pilot_provision 실패"; cat /tmp/s24; exit 1; }
out=$(blk supabase/manual/precheck_0023_0024.sql)
check "연습 ① 적용 전 점검: '멈춤' 0 · 오류 0 · 함수 둘 다 '0020 그대로'" "$(echo "$out" | grep -c '멈춤') $(echo "$out" | grep -c 'ERROR') $(echo "$out" | grep -c '|0020 그대로|좋음$')" "0 0 2"
check "연습 ① 적용 전 점검: 대표가 팀장 작업공간 구성원 1(전환에 쓰는 줄)" "$(echo "$out" | grep -E '^11\|' | cut -d'|' -f4)" "1"
out=$(blk supabase/migrations/20261104000023_workspace_id_lock.sql "set lock_timeout = '5s'; ")
check "연습 ② 0023 한 덩어리(lock_timeout 5초 붙여) — 오류 없음 · 장치 19표" "$(echo "$out" | grep -c 'ERROR') $(v "select count(*) from pg_trigger where tgname = 'zz_workspace_id_lock' and not tgisinternal")" "0 19"
out=$(blk supabase/migrations/20261104000024_customer_audience.sql "set lock_timeout = '5s'; ")
check "연습 ③ 0024 한 덩어리 — 오류 없음 · 마지막 표 full/internal · pilot/internal" "$(echo "$out" | grep -c 'ERROR') $(echo "$out" | grep -cE '^(full|pilot)\|internal\|1$')" "0 2"
out=$(blk supabase/manual/verify_after_0023_0024.sql)
check "연습 ④ 적용 뒤 확인: 12줄 모두 '좋음' · 대표 팀장 화면 1/1" "$(echo "$out" | grep -c '|좋음$') $(echo "$out" | grep -E '^7\|' | cut -d'|' -f4)" "12 1 / 1"
before_u=$(v "select updated_at::text || ' ' || workspace_id from public.operations_clients where id = 'o24-secret'")
before_a=$(v "select string_agg(audience, ',' order by tier) from public.os_access")
out=$(blk supabase/manual/try_0023_0024.sql)
check "연습 ⑤ 직접 시도: 통과 4 · 실패 0(옮기기 막힘 · 같은 곳 저장 됨 · 팀장→고객 막힘 · 팀장 화면 그대로)" "$(echo "$out" | grep -c '통과 4 · 실패 0') $(echo "$out" | grep -c '^✓')" "1 4"
check "연습 ⑤ 직접 시도 뒤 자료 그대로(업체 고친 시각 · 작업공간 · 계정 대상)" "$(v "select updated_at::text || ' ' || workspace_id from public.operations_clients where id = 'o24-secret'") $(v "select string_agg(audience, ',' order by tier) from public.os_access")" "$before_u $before_a"
check "연습 ⑤ 직접 시도 결과에 개인 정보 없음(이메일 · 업체 이름)" "$(echo "$out" | grep -cE '@|대표비밀24')" "0"
out=$(blk supabase/manual/rollback_0023_0024.sql)
check "연습 ⑥ 되돌리기(고객 없음): 장치 0 · 0 · 함수 본문이 0020 과 한 글자도 같음" "$(echo "$out" | tail -1) $(blk supabase/manual/precheck_0023_0024.sql | grep -c '|0020 그대로|좋음$')" "0|0 2"
check "연습 ⑥ 되돌린 뒤에도 대표 팀장 화면 1 · audience 칸은 남음(칸 지우기 0)" "$(blk supabase/manual/verify_after_0023_0024.sql | grep -E '^(2|7)\|' | cut -d'|' -f5 | tr '\n' ' ')" "좋음 좋음 "
out=$(blk supabase/migrations/20261104000023_workspace_id_lock.sql)$(blk supabase/migrations/20261104000024_customer_audience.sql)
check "연습 ⑦ 다시 적용 — 오류 없음 · 확인 12줄 모두 '좋음'" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0023_0024.sql | grep -c '|좋음$')" "0 12"
check "연습 ⑧ 확인 SQL 셋 다 쓰기 0(점검 · 적용 전 · 적용 뒤)" "$(before=$(v "select sum(n_tup_ins + n_tup_upd + n_tup_del) from pg_stat_user_tables"); blk supabase/manual/check_applied_0016_0024.sql > /dev/null; blk supabase/manual/precheck_0023_0024.sql > /dev/null; blk supabase/manual/verify_after_0023_0024.sql > /dev/null; sleep 1; after=$(v "select sum(n_tup_ins + n_tup_upd + n_tup_del) from pg_stat_user_tables"); [ "$before" = "$after" ] && echo same || echo "$before→$after")" "same"
# ⑨ D-597 SQL Editor 는 붙여 넣을 때 줄 앞에 빈칸을 더한다(2026-11-11 운영 적용 전 점검에서 실제로 계단처럼 밀린 본문 — 7 · 8번 '다름')
#    → 띄어쓰기 · 줄바꿈만 다른 본문은 점검 · 확인이 같은 본문으로 본다. 글자가 하나라도 다르면 여전히 멈춤.
ind() { awk '{n=(NR<60?NR:60); s=""; for(i=0;i<n;i++) s=s" "; print s $0}' "$1"; }
blkind() { local body; body="${2:-}$(ind "$1")"; su postgres -c "psql -At -F '|' -d $DB -c \"\$(cat)\"" <<<"$body" 2>&1; }
blk supabase/manual/rollback_0023_0024.sql > /dev/null
out=$(blkind supabase/migrations/20261008000020_owner_views_pilot.sql)
check "연습 ⑨ 0020 을 계단 들여쓰기로 붙여 넣음 — 오류 없음 · 두 본문 글자는 원본과 다름" "$(echo "$out" | grep -c 'ERROR') $(v "select count(*) from pg_proc where proname in ('os_access_link_owner_to_pilots', 'my_pilot_views') and md5(prosrc) not in ('5923bce05aa4d3eebf827e7fd39e3db5', 'b9e5de279b3f39efc381ecf3c0b497b0')")" "0 2"
out=$(blk supabase/manual/precheck_0023_0024.sql)
check "연습 ⑨ 적용 전 점검: 띄어쓰기만 다른 본문 = '0020 그대로 · 좋음' · 멈춤 0" "$(echo "$out" | grep -c '멈춤') $(echo "$out" | grep -c '|0020 그대로|좋음$')" "0 2"
out=$(blkind supabase/migrations/20261104000023_workspace_id_lock.sql "set lock_timeout = '5s'; ")$(blkind supabase/migrations/20261104000024_customer_audience.sql "set lock_timeout = '5s'; ")
check "연습 ⑨ 0023 · 0024 도 계단 들여쓰기로 — 오류 없음 · 확인 12줄 모두 '좋음' · 대표 팀장 화면 1/1" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0023_0024.sql | grep -c '|좋음$') $(blk supabase/manual/verify_after_0023_0024.sql | grep -E '^7\|' | cut -d'|' -f4)" "0 12 1 / 1"
check "연습 ⑨ 직접 시도: 통과 4 · 실패 0" "$(blk supabase/manual/try_0023_0024.sql | grep -c '통과 4 · 실패 0')" "1"
blk supabase/manual/rollback_0023_0024.sql > /dev/null
sed "s/'Pilot')/'Pilot2')/" supabase/migrations/20261008000020_owner_views_pilot.sql | q > /dev/null 2>&1
row8=$(blk supabase/manual/precheck_0023_0024.sql | grep -E '^8\|')
check "연습 ⑨ 글자가 바뀐 본문(누가 고친 것)은 여전히 '다름 · 멈춤'" "$(echo "$row8" | cut -d'|' -f4) $(echo "$row8" | cut -d'|' -f5 | grep -c '^멈춤')" "다름 1"
q < supabase/migrations/20261008000020_owner_views_pilot.sql > /dev/null 2>&1
# ⑩ D-599 운영 DB 의 profiles 는 공개 사이트 모양(name 있음 · display_name 없음) — 0025 가 그 모양에서도 한 덩어리로 들어가는지
#    (2026-11-11 운영에서 0025 가 'column p.display_name does not exist' 로 멈춤 · 한 거래라 바뀐 것 0 → 고침)
su postgres -c "psql -q -d $DB" > /dev/null 2>&1 <<'SQL'
alter table public.profiles drop column if exists display_name cascade;
alter table public.profiles add column if not exists name text;
insert into public.profiles (id, email, name) values ('24000000-0000-4000-8000-0000000000a1', 'owner24@x.kr', '운영모양이름')
  on conflict (id) do update set name = excluded.name;
SQL
out=$(blk supabase/migrations/20261110000025_support_messages.sql)
check "연습 ⑩ 운영 모양 profiles(display_name 없음)에서 0025 한 덩어리 — 오류 0 · 표 1 · 정책 1 · 함수 6" "$(echo "$out" | grep -c 'ERROR') $(v "select count(*) from pg_tables where schemaname = 'public' and tablename = 'support_messages'") $(v "select count(*) from pg_policies where schemaname = 'public' and tablename = 'support_messages'") $(v "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'support\\_%'")" "0 1 1 6"
check "연습 ⑩ 받은함의 보낸 사람 이름은 운영 모양의 name 칸에서" "$(v "select coalesce(nullif(btrim(coalesce(to_jsonb(p) ->> 'display_name', to_jsonb(p) ->> 'name', '')), ''), '') from public.profiles p where p.id = '24000000-0000-4000-8000-0000000000a1'")" "운영모양이름"
out=$(blk supabase/migrations/20261110000025_support_messages.sql)
check "연습 ⑩ 0025 다시 실행해도 같음(오류 0)" "$(echo "$out" | grep -c 'ERROR')" "0"
# ⑪ L-27 · D-608 0026(대표가 팀장 고객 자료를 볼 때 — 팀장 허락 동안만) — 운영 모양(0025 까지 · profiles name) 위에 한 덩어리로
PW=$(v "select id from public.workspaces where owner_id = '24000000-0000-4000-8000-0000000000b1'")
q > /dev/null <<SQL || { echo "팀장 업체 준비 실패"; exit 1; }
insert into public.operations_clients (id, workspace_id, company_name, payload) values ('p24-client', '$PW', '팀장고객24', '{}') on conflict (id) do nothing;
SQL
ownsee() { su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-0000000000a1', false); set role authenticated; select count(*) from public.operations_clients where id = 'p24-client';" | tail -1; }
check "연습 ⑪ 0026 전: 대표가 팀장 업체를 본다(0020 그대로)" "$(ownsee)" "1"
check "연습 ⑪ 점검 SQL(0026~0028): 넣기 전 이번 3줄 '없음'" "$(blk supabase/manual/check_applied_0026_0028.sql | grep -cE '^2 이번\|.*\|없음$')" "3"
out=$(blk supabase/migrations/20261114000026_view_consent.sql "set lock_timeout = '5s'; ")
check "연습 ⑪ 0026 한 덩어리(lock_timeout 5초) — 오류 0 · 마지막 결과 = 파일 문 1" "$(echo "$out" | grep -c 'ERROR') $(echo "$out" | tail -1)" "0 1"
out=$(blk supabase/manual/verify_after_0026.sql)
check "연습 ⑪ 적용 뒤 확인: 1~6 모두 '좋음' · 대표 구성원 1 · 열린 허락 0" "$(echo "$out" | grep -cE '^[1-6]\|.*\|좋음$') $(echo "$out" | grep -E '^7\|' | cut -d'|' -f3) $(echo "$out" | grep -E '^8\|' | cut -d'|' -f3)" "6 1 0"
check "연습 ⑪ 확인 SQL: 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(grep -v '^--' supabase/manual/verify_after_0026.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/verify_after_0026.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on)\b')" "set transaction read only; 0"
check "연습 ⑪ 0026 뒤: 대표는 허락 전 팀장 업체 0 · 대표 자기 업체는 그대로" "$(ownsee) $(su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-0000000000a1', false); set role authenticated; select count(*) from public.operations_clients where id = 'o24-secret';" | tail -1)" "0 1"
out=$(blk supabase/migrations/20261114000026_view_consent.sql)
check "연습 ⑪ 0026 다시 실행해도 같음(오류 0 · 확인 6줄 좋음)" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0026.sql | grep -cE '^[1-6]\|.*\|좋음$')" "0 6"
out=$(blkind supabase/migrations/20261114000026_view_consent.sql "set lock_timeout = '5s'; ")
check "연습 ⑪ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(blk supabase/manual/rollback_0026.sql)
check "연습 ⑪ 되돌리기: 문 0 | 0 · 대표가 다시 팀장 업체를 봄 · 기록 표는 남음" "$(echo "$out" | tail -1) $(ownsee) $(v "select count(*) from pg_tables where tablename in ('workspace_view_grants', 'workspace_view_requests')")" "0|0 1 2"
out=$(blk supabase/migrations/20261114000026_view_consent.sql)
check "연습 ⑪ 되돌린 뒤 0026 다시 — 문 다시 · 대표 0 · 확인 6줄 좋음" "$(echo "$out" | grep -c 'ERROR') $(ownsee) $(blk supabase/manual/verify_after_0026.sql | grep -cE '^[1-6]\|.*\|좋음$')" "0 0 6"
check "연습 ⑪ 점검 SQL(0026~0028): 0026 만 넣은 뒤 — 0026 '들어감' · 0027 · 0028 '없음'" "$(blk supabase/manual/check_applied_0026_0028.sql | grep -E '^2 이번' | cut -d'|' -f2,5 | tr '\n' ' ')" "26|들어감 27|없음 28|없음 "
# ⑫ L-9 · D-609 0027(고객마다 상담 신청 링크) — 운영 모양(0026 까지 · profiles name) 위에 한 덩어리로
asr() { su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '$1', false); set role $2; $3" 2>&1 | tail -1; }
out=$(blk supabase/migrations/20261114000027_intake_links.sql "set lock_timeout = '5s'; ")
check "연습 ⑫ 0027 한 덩어리(lock_timeout 5초) — 오류 0" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(blk supabase/manual/verify_after_0027.sql)
check "연습 ⑫ 적용 뒤 확인: 1~5 모두 '좋음' · 열린 링크 0" "$(echo "$out" | grep -cE '^[1-5]\|.*\|좋음$') $(echo "$out" | grep -E '^6\|' | cut -d'|' -f3)" "5 0"
check "연습 ⑫ 확인 SQL: 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(grep -v '^--' supabase/manual/verify_after_0027.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/verify_after_0027.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on)\b')" "set transaction read only; 0"
SLUG=$(asr 24000000-0000-4000-8000-0000000000b1 authenticated "select public.intake_link_save('$PW', '팀장 상담', '')->'link'->>'slug';")
check "연습 ⑫ 팀장이 링크 만들기 → 12자리 주소" "$(echo "$SLUG" | grep -cE '^[0-9a-f]{12}$')" "1"
check "연습 ⑫ 로그인 안 한 사람 신청 → ok" "$(asr '' anon "select public.public_intake_submit('$SLUG', '{\"name\":\"연습 신청\",\"phone\":\"010-2400-0001\",\"consent\":true}');")" "ok"
check "연습 ⑫ 팀장 잠재고객 1 · 대표는 허락 전이라 0(0026)" "$(asr 24000000-0000-4000-8000-0000000000b1 authenticated "select count(*) from public.operations_clients where workspace_id = '$PW' and company_name = '연습 신청';") $(asr 24000000-0000-4000-8000-0000000000a1 authenticated "select count(*) from public.operations_clients where company_name = '연습 신청';")" "1 0"
out=$(blk supabase/migrations/20261114000027_intake_links.sql)
check "연습 ⑫ 0027 다시 실행해도 같음(오류 0 · 확인 5줄 좋음 · 주소 그대로)" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0027.sql | grep -cE '^[1-5]\|.*\|좋음$') $(asr '' anon "select public.public_intake_form('$SLUG')->>'title';")" "0 5 팀장 상담"
out=$(blkind supabase/migrations/20261114000027_intake_links.sql "set lock_timeout = '5s'; ")
check "연습 ⑫ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(blk supabase/manual/rollback_0027.sql)
check "연습 ⑫ 되돌리기: false | false · 공개 화면 막힘 · 링크 표 · 잠재고객 남음" "$(echo "$out" | tail -1) $(asr '' anon "select public.public_intake_form('$SLUG');" | grep -c 'permission denied') $(v "select count(*) from public.public_intake_links") $(v "select count(*) from public.operations_clients where company_name = '연습 신청'")" "f|f 1 1 1"
out=$(blk supabase/migrations/20261114000027_intake_links.sql)
check "연습 ⑫ 되돌린 뒤 0027 다시 — 같은 주소로 다시 받음 · 확인 5줄 좋음" "$(echo "$out" | grep -c 'ERROR') $(asr '' anon "select public.public_intake_form('$SLUG')->>'title';") $(blk supabase/manual/verify_after_0027.sql | grep -cE '^[1-5]\|.*\|좋음$')" "0 팀장 상담 5"
# ⑬ L-7 · D-610 0028(가입하면 바로 쓰기 · 꺼 둔 채) — 운영 모양(0027 까지 · profiles name) 위에 한 덩어리로
q > /dev/null <<'SQL' || { echo "새 가입자 준비 실패"; exit 1; }
insert into auth.users (id, email, email_confirmed_at) values ('24000000-0000-4000-8000-0000000000e1', 'self24@x.kr', now()) on conflict do nothing;
SQL
NEWU=24000000-0000-4000-8000-0000000000e1
out=$(blk supabase/migrations/20261115000028_self_signup.sql "set lock_timeout = '5s'; ")
check "연습 ⑬ 0028 한 덩어리(lock_timeout 5초) — 오류 0 · 마지막 결과 = 꺼짐" "$(echo "$out" | grep -c 'ERROR') $(echo "$out" | tail -1 | cut -d'|' -f1)" "0 f"
out=$(blk supabase/manual/verify_after_0028.sql)
check "연습 ⑬ 적용 뒤 확인: 1~5 모두 '좋음' · 지금 꺼짐 · 3명 · 열린 계정 0" "$(echo "$out" | grep -cE '^[1-5]\|.*\|좋음$') $(echo "$out" | grep -E '^6\|' | cut -d'|' -f3) $(echo "$out" | grep -E '^7\|' | cut -d'|' -f3)" "5 꺼짐 · 3명 0"
check "연습 ⑬ 확인 SQL: 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(grep -v '^--' supabase/manual/verify_after_0028.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/verify_after_0028.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on)\b')" "set transaction read only; 0"
check "연습 ⑬ 적용 직후: 새 가입자 closed · 가입 화면 '바로 못 씀' · 눌러도 등급 없음" "$(asr $NEWU authenticated "select public.self_signup_state();") $(asr '' anon "select public.signup_open();") $(asr $NEWU authenticated "select public.self_signup_start('')->>'status';") $(v "select count(*) from public.os_access where user_id = '$NEWU'")" "closed f closed 0"
check "연습 ⑬ 팀장은 켤 수 없음 · 대표는 켬" "$(su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-0000000000b1', false); set role authenticated; select public.self_signup_admin_save(true, 3, 14, 100, true);" 2>&1 | grep -c 'not allowed') $(asr 24000000-0000-4000-8000-0000000000a1 authenticated "select public.self_signup_admin_save(true, 3, 14, 100, true)->'policy'->>'open';")" "1 true"
check "연습 ⑬ 새 가입자 [바로 시작하기] → ok · pilot customer · 작업공간 하나 · 구성원 본인뿐 · AI customer trial" "$(asr $NEWU authenticated "select public.self_signup_start('연습 컨설팅')->>'status';") $(v "select tier || ' ' || audience from public.os_access where user_id = '$NEWU'") $(v "select count(*) from public.workspaces where owner_id = '$NEWU'") $(v "select count(*) from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where w.owner_id = '$NEWU'") $(v "select kind || ' ' || plan from public.ai_entitlements where user_id = '$NEWU'")" "ok pilot customer 1 1 customer trial"
check "연습 ⑬ 새 고객은 대표 업체 0 · 대표는 새 고객 작업공간 0" "$(asr $NEWU authenticated "select count(*) from public.operations_clients;") $(asr 24000000-0000-4000-8000-0000000000a1 authenticated "select count(*) from public.workspaces where owner_id = '$NEWU';")" "0 0"
out=$(blk supabase/migrations/20261115000028_self_signup.sql)
check "연습 ⑬ 0028 다시 실행해도 같음(오류 0 · 확인 5줄 좋음 · 켠 설정 그대로 · 열린 계정 1)" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0028.sql | grep -cE '^[1-5]\|.*\|좋음$') $(asr '' anon "select public.signup_open();") $(v "select count(*) from public.self_signup_accounts")" "0 5 t 1"
out=$(blkind supabase/migrations/20261115000028_self_signup.sql "set lock_timeout = '5s'; ")
check "연습 ⑬ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(blk supabase/manual/rollback_0028.sql)
check "연습 ⑬ 되돌리기: false | false · 가입 화면 함수 막힘 · 열린 고객 그대로 · 기록 남음" "$(echo "$out" | tail -1) $(asr '' anon "select public.signup_open();" | grep -c 'permission denied') $(v "select tier || ' ' || audience from public.os_access where user_id = '$NEWU'") $(v "select count(*) from public.self_signup_accounts")" "f|f 1 pilot customer 1"
out=$(blk supabase/migrations/20261115000028_self_signup.sql)
check "연습 ⑬ 되돌린 뒤 0028 다시 — 켠 설정 그대로 · 확인 5줄 좋음" "$(echo "$out" | grep -c 'ERROR') $(asr '' anon "select public.signup_open();") $(blk supabase/manual/verify_after_0028.sql | grep -cE '^[1-5]\|.*\|좋음$')" "0 t 5"
out2=$(blk supabase/manual/check_applied_0026_0028.sql)
# 이 연습 DB 는 ⑨ 끝에서 0023 · 0024 를 되돌린 상태다 — '먼저' 의 0024 줄이 '없음' 으로 잡혀야 맞다(있어야 할 것이 빠지면 알려 주는지). 전부 넣은 DB 는 run.sh 가 본다.
check "연습 ⑬ 점검 SQL(0026~0028): 셋 다 넣은 뒤 — 이번 3줄 '들어감'(12/12 · 8/8 · 10/10) · 되돌려 둔 0024 는 '없음' 으로 알림" "$(echo "$out2" | grep -cE '^2 이번\|.*\|들어감$') $(echo "$out2" | grep -E '^2 이번' | grep -oE '[0-9]+/[0-9]+' | tr '\n' ' ')$(echo "$out2" | grep -E '^1 먼저\|24\|' | cut -d'|' -f5) $(echo "$out2" | grep -cE '^1 먼저\|.*\|들어감$')" "3 12/12 8/8 10/10 없음 4"
# ⑭ D-635 0029(가입 신청 → 대표가 앱에서 승인 · 거절) — 운영 모양(0028 까지 · 0028 켜 둔 채 · 열린 계정 1) 위에 한 덩어리로
q > /dev/null <<'SQL' || { echo "가입 신청자 준비 실패"; exit 1; }
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('24000000-0000-4000-8000-0000000000f1', 'req24@x.kr', now(), '{"signup_app":"internal_os","display_name":"연습 신청","company":"연습 회사"}'),
  ('24000000-0000-4000-8000-0000000000f2', 'rej24@x.kr', now(), '{"signup_app":"internal_os","display_name":"연습 거절"}') on conflict do nothing;
SQL
REQ=24000000-0000-4000-8000-0000000000f1
REJ=24000000-0000-4000-8000-0000000000f2
OWN=24000000-0000-4000-8000-0000000000a1
out=$(blk supabase/manual/check_applied_0029.sql)
check "연습 ⑭ 점검 SQL(0029): 넣기 전 — 오류 0 · 읽기 전용 on · 이번 1줄 '없음' · 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(echo "$out" | grep -c 'ERROR') $(echo "$out" | grep -E '^0 확인' | cut -d'|' -f5) $(echo "$out" | grep -cE '^2 이번\|29\|.*\|없음$') $(grep -v '^--' supabase/manual/check_applied_0029.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/check_applied_0029.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|grant|revoke|truncate)\b')" "0 on 1 set transaction read only; 0"
out=$(blk supabase/migrations/20261118000029_signup_approval.sql "set lock_timeout = '5s'; ")
check "연습 ⑭ 0029 한 덩어리(lock_timeout 5초) — 오류 0 · 마지막 결과 = 표 1 · 함수 6" "$(echo "$out" | grep -c 'ERROR') $(echo "$out" | tail -1)" "0 1|6"
out=$(blk supabase/manual/verify_after_0029.sql)
check "연습 ⑭ 적용 뒤 확인: 1~5 '좋음' · 기다리는 신청 2 · 결정 0 · 맨 위 set transaction read only · 만들기/고치기 문장 0" "$(echo "$out" | grep -cE '^[1-5]\|.*\|좋음$') $(echo "$out" | grep -E '^6\|' | cut -d'|' -f3) $(echo "$out" | grep -E '^7\|' | cut -d'|' -f3) $(grep -v '^--' supabase/manual/verify_after_0029.sql | grep -m1 -v '^\s*$') $(grep -v '^\s*--' supabase/manual/verify_after_0029.sql | grep -ciE '\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|comment on)\b')" "5 2 승인 0 · 거절 0 set transaction read only; 0"
check "연습 ⑭ 신청자: 내 상태 pending · 팀장은 승인 막힘" "$(asr $REQ authenticated "select public.my_signup_status()->>'status';") $(su postgres -c "psql -At -d $DB" <<<"select set_config('request.jwt.claim.sub', '24000000-0000-4000-8000-0000000000b1', false); set role authenticated; select public.signup_approve('$REQ');" 2>&1 | grep -c 'not allowed')" "pending 1"
check "연습 ⑭ 대표: 목록 2 · [승인] ok → pilot customer · 작업공간 '연습 회사' 하나 · 구성원 본인뿐 · AI customer trial" "$(asr $OWN authenticated "select count(*) from public.signup_requests();") $(asr $OWN authenticated "select public.signup_approve('$REQ')->>'status';") $(v "select tier || ' ' || audience from public.os_access where user_id = '$REQ'") $(v "select name from public.workspaces where owner_id = '$REQ'") $(v "select count(*) from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where w.owner_id = '$REQ'") $(v "select kind || ' ' || plan from public.ai_entitlements where user_id = '$REQ'")" "2 ok pilot customer 연습 회사 1 customer trial"
check "연습 ⑭ 대표: [거절] ok → 그 사람 rejected · 계정 남음 · 등급 0" "$(asr $OWN authenticated "select public.signup_reject('$REJ', '연습')->>'status';") $(asr $REJ authenticated "select public.my_signup_status()->>'status';") $(v "select count(*) from auth.users where id = '$REJ'") $(v "select count(*) from public.os_access where user_id = '$REJ'")" "ok rejected 1 0"
out=$(blk supabase/migrations/20261118000029_signup_approval.sql)
check "연습 ⑭ 0029 다시 실행해도 같음(오류 0 · 확인 5줄 좋음 · 결정 기록 그대로)" "$(echo "$out" | grep -c 'ERROR') $(blk supabase/manual/verify_after_0029.sql | grep -cE '^[1-5]\|.*\|좋음$') $(v "select string_agg(decision, ',' order by decision) from public.signup_decisions")" "0 5 approved,rejected"
out=$(blkind supabase/migrations/20261118000029_signup_approval.sql "set lock_timeout = '5s'; ")
check "연습 ⑭ 계단 들여쓰기로 붙여 넣어도(D-597) 오류 0" "$(echo "$out" | grep -c 'ERROR')" "0"
out=$(blk supabase/manual/rollback_0029.sql)
check "연습 ⑭ 되돌리기: false | false · 내 상태 함수 막힘 · 승인한 고객 그대로 · 결정 기록 남음 · 확인 5번 '꺼짐(되돌림)'" "$(echo "$out" | tail -1) $(asr $REJ authenticated "select public.my_signup_status();" | grep -c 'permission denied') $(v "select tier || ' ' || audience from public.os_access where user_id = '$REQ'") $(v "select count(*) from public.signup_decisions") $(blk supabase/manual/verify_after_0029.sql | grep -E '^5\|' | cut -d'|' -f4)" "f|f 1 pilot customer 2 꺼짐(되돌림)"
out=$(blk supabase/migrations/20261118000029_signup_approval.sql)
check "연습 ⑭ 되돌린 뒤 0029 다시 — 거절한 사람은 그대로 rejected · 확인 5줄 좋음" "$(echo "$out" | grep -c 'ERROR') $(asr $REJ authenticated "select public.my_signup_status()->>'status';") $(blk supabase/manual/verify_after_0029.sql | grep -cE '^[1-5]\|.*\|좋음$')" "0 rejected 5"
out2=$(blk supabase/manual/check_applied_0029.sql)
check "연습 ⑭ 점검 SQL(0029): 넣은 뒤 — 이번 1줄 '들어감'(7/7) · 되돌려 둔 0024 는 '없음' 으로 알림" "$(echo "$out2" | grep -cE '^2 이번\|.*\|들어감$') $(echo "$out2" | grep -E '^2 이번' | grep -oE '[0-9]+/[0-9]+')$(echo "$out2" | grep -E '^1 먼저\|24\|' | cut -d'|' -f5) $(echo "$out2" | grep -cE '^1 먼저\|.*\|들어감$')" "1 7/7없음 4"
[ "$BAD" -eq 0 ]
