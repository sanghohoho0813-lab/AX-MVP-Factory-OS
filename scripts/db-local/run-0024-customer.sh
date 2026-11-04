#!/bin/bash
# D-533 · D-534 대표가 SQL Editor 에서 실행할 파일을 **그대로**(이메일만 바꿔) 돌려 본다 — 운영 DB 와 상관없다.
#   1) 빈 DB 에 0001~0015 만 → check_applied_0016_0024.sql: 0016~0024 모두 '없음' · 읽기 전용(쓰기 0)
#   2) 마이그레이션 전부 → 대표 작업공간 · 받는 곳 → pilot_provision.sql(내부 팀장) → 대표 연결됨
#      → customer_provision.sql(외부 고객) → 대표 연결 안 됨 · AI customer · 다시 실행해도 같음 → check: 모두 '들어감'
# 사용: sudo bash scripts/db-local/run-0024-customer.sh   (pg_ctlcluster 16 main start 먼저)
set -u
cd "$(dirname "$0")/../.."
DB=axqa24
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
v() { su postgres -c "psql -At -d $DB" <<<"$1"; }
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
out=$(su postgres -c "psql -At -F '|' -d $DB" < supabase/manual/check_applied_0016_0024.sql 2>&1)
check "점검 SQL(0015 까지): 0016~0024 아홉 줄 모두 '없음'" "$(echo "$out" | grep -cE '^(1[6-9]|2[0-4])\|.*\|없음$')" "9"
check "점검 SQL: 오류 없이 끝남" "$(echo "$out" | grep -c 'ERROR')" "0"
check "점검 SQL: 쓰기 0(표에 넣기 · 고치기 · 지우기 없음)" "$(v "select count(*) from pg_stat_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0")" "$before"
check "점검 SQL: 읽기 전용 거래로 묶임(맨 위 begin transaction read only)" "$(head -20 supabase/manual/check_applied_0016_0024.sql | grep -c '^begin transaction read only;')" "1"

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
  case "$(basename "$f")" in *_os_access_pilot.sql|*_owner_views_pilot.sql|*_owner_ai_workspace.sql|*_customer_audience.sql) continue ;; esac
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
out=$(su postgres -c "psql -At -F '|' -d $DB" < supabase/manual/check_applied_0016_0024.sql 2>&1)
check "점검 SQL(전부 적용): 0016~0024 아홉 줄 모두 '들어감'" "$(echo "$out" | grep -cE '^(1[6-9]|2[0-4])\|.*\|들어감$')" "9"
check "점검 SQL: 등급 요약에 개인 정보(이메일) 없음" "$(echo "$out" | grep -c '@')" "0"
[ "$BAD" -eq 0 ]
