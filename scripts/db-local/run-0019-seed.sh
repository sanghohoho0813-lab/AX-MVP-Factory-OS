#!/bin/bash
# D-162 0019 '기존 운영 DB 에 처음 실행' 시험 — 0018 까지 적용된 DB 에 대표 · 공개 사이트 가입자 상황을 만든 뒤 0019 를 적용한다.
# 가입자가 0019 전에 받는 곳 표 · 작업공간 시각을 조작해 둔 경우도 넣는다. 사용: sudo bash scripts/db-local/run-0019-seed.sh
set -u
cd "$(dirname "$0")/../.."
DB=axqa19seed
q() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB"; }
su postgres -c "dropdb --if-exists $DB; createdb $DB" || exit 1
q < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
for f in $(ls supabase/migrations/*.sql | grep -v 000019); do q < "$f" > /dev/null 2>/tmp/s19 || { echo "적용 실패 $f"; cat /tmp/s19; exit 1; }; done
q <<'SQL' > /dev/null || { echo "상황 만들기 실패"; exit 1; }
insert into auth.users (id, email) values ('5e000000-0000-0000-0000-0000000000a1','ceo@x.kr'),('5e000000-0000-0000-0000-0000000000a2','staff@x.kr'),('5e000000-0000-0000-0000-0000000000c1','random@x.kr') on conflict (id) do update set email = excluded.email;
insert into public.profiles (id, email) values ('5e000000-0000-0000-0000-0000000000a1','ceo@x.kr'),('5e000000-0000-0000-0000-0000000000a2','staff@x.kr'),('5e000000-0000-0000-0000-0000000000c1','random@x.kr') on conflict (id) do update set email = excluded.email;
insert into public.workspaces (id, name, owner_id, created_at) values
  ('5e000000-0000-0000-0000-00000000aaaa','대표 회사','5e000000-0000-0000-0000-0000000000a1','2026-07-21'),
  ('5e000000-0000-0000-0000-00000000cccc','가입자 회사','5e000000-0000-0000-0000-0000000000c1','1999-01-01');
insert into public.workspace_members values
  ('5e000000-0000-0000-0000-00000000aaaa','5e000000-0000-0000-0000-0000000000a1','owner'),
  ('5e000000-0000-0000-0000-00000000aaaa','5e000000-0000-0000-0000-0000000000a2','editor'),
  ('5e000000-0000-0000-0000-00000000cccc','5e000000-0000-0000-0000-0000000000c1','owner');
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'ceo-' || g, '5e000000-0000-0000-0000-00000000aaaa', '고객' || g, '{}' from generate_series(1, 30) g;
-- 가입자가 0019 전에 받는 곳을 심어 둠(옛 시각)
insert into public.customer_intake_routing (workspace_id, is_default, created_at) values ('5e000000-0000-0000-0000-00000000cccc', true, '1990-01-01');
SQL
out=$(su postgres -c "psql -v ON_ERROR_STOP=1 -d $DB" < supabase/migrations/20261007000019_os_access_pilot.sql 2>&1)
echo "$out"
BAD=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1 = $2"; else echo "FAIL  $1 = $2 (기대 $3)"; BAD=1; fi; }
v() { su postgres -c "psql -At -d $DB -c \"$1\""; }
check "대표 · 직원 = full" "$(v "select string_agg(p.email, ',' order by p.email) from public.os_access a join public.profiles p on p.id = a.user_id where a.tier='full'")" "ceo@x.kr,staff@x.kr"
check "가입자는 접근 없음" "$(v "select count(*) from public.os_access where user_id='5e000000-0000-0000-0000-0000000000c1'")" "0"
check "받는 곳 = 대표 회사(가입자가 심은 옛 줄 무시)" "$(v "select name from public.workspaces where id = public.default_intake_workspace()")" "대표 회사"
check "대표 작업공간으로 본 곳 알림" "$(echo "$out" | grep -c '대표 회사 (업체 30곳 · 주인 ceo@x.kr)')" "1"
# Pilot 준비 SQL — 계정 만들고 실행 → pilot 등급 · 빈 작업공간(멤버 = Pilot 한 사람) · 두 번 실행해도 같음
v "insert into auth.users (id, email) values ('5e000000-0000-0000-0000-0000000000b1','pilot@x.kr')" > /dev/null
sed "s/여기에_Pilot_이메일@example.com/pilot@x.kr/" supabase/manual/pilot_provision.sql | su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB" > /dev/null 2>&1 || { echo "FAIL  Pilot 준비 SQL 실행 실패"; BAD=1; }
sed "s/여기에_Pilot_이메일@example.com/pilot@x.kr/" supabase/manual/pilot_provision.sql | su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB" > /dev/null 2>&1 || { echo "FAIL  Pilot 준비 SQL 두 번째 실행 실패"; BAD=1; }
check "Pilot 등급" "$(v "select tier from public.os_access where user_id='5e000000-0000-0000-0000-0000000000b1'")" "pilot"
check "Pilot 작업공간 하나 · 멤버 = Pilot 혼자" "$(v "select count(distinct w.id) || '/' || count(*) from public.workspaces w join public.workspace_members m on m.workspace_id = w.id where w.owner_id='5e000000-0000-0000-0000-0000000000b1'")" "1/1"
check "대표 작업공간 멤버에 Pilot 없음" "$(v "select count(*) from public.workspace_members where workspace_id='5e000000-0000-0000-0000-00000000aaaa' and user_id='5e000000-0000-0000-0000-0000000000b1'")" "0"
sed "s/여기에_Pilot_이메일@example.com/ceo@x.kr/" supabase/manual/pilot_provision.sql | su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB" > /tmp/s19c 2>&1 && { echo "FAIL  대표 계정을 Pilot 으로 바꿈"; BAD=1; } || echo "PASS  대표 계정은 Pilot 으로 바뀌지 않음"

# 가입자가 0019 전에 자기 작업공간에 업체를 대표보다 많이 넣어 둔 경우 — 0019 는 멈추고 아무것도 바꾸지 않는다(대표가 id 를 정해 다시)
DB2=axqa19inflate
q2() { su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB2"; }
su postgres -c "dropdb --if-exists $DB2; createdb $DB2" || exit 1
q2 < scripts/db-local/supabase-shim.sql > /dev/null || exit 1
for f in $(ls supabase/migrations/*.sql | grep -v 000019); do q2 < "$f" > /dev/null 2>/tmp/s19 || { echo "적용 실패 $f"; cat /tmp/s19; exit 1; }; done
q2 <<'SQL' > /dev/null || { echo "상황 만들기 실패(부풀림)"; exit 1; }
insert into auth.users (id, email, created_at) values ('6e000000-0000-0000-0000-0000000000a1','ceo@x.kr','2026-01-01'),('6e000000-0000-0000-0000-0000000000c1','evil@x.kr','2026-09-01');
insert into public.workspaces (id, name, owner_id, created_at) values
  ('6e000000-0000-0000-0000-00000000aaaa','대표 회사','6e000000-0000-0000-0000-0000000000a1','2026-07-21'),
  ('6e000000-0000-0000-0000-00000000cccc','부풀린 회사','6e000000-0000-0000-0000-0000000000c1','1999-01-01');
insert into public.workspace_members values
  ('6e000000-0000-0000-0000-00000000aaaa','6e000000-0000-0000-0000-0000000000a1','owner'),
  ('6e000000-0000-0000-0000-00000000cccc','6e000000-0000-0000-0000-0000000000c1','owner');
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'ceo-' || g, '6e000000-0000-0000-0000-00000000aaaa', '고객' || g, '{}' from generate_series(1, 30) g;
insert into public.operations_clients (id, workspace_id, company_name, payload) select 'evil-' || g, '6e000000-0000-0000-0000-00000000cccc', '가짜' || g, '{}' from generate_series(1, 80) g;
SQL
out2=$(su postgres -c "psql -v ON_ERROR_STOP=1 -d $DB2" < supabase/migrations/20261007000019_os_access_pilot.sql 2>&1)
v2() { su postgres -c "psql -At -d $DB2 -c \"$1\""; }
check "부풀림: 0019 가 멈추고 대표 회사 · 부풀린 회사를 보여 줌" "$(echo "$out2" | grep -c '대표 작업공간을 하나로 정하지 못했습니다')" "1"
check "부풀림: 아무것도 안 바뀜(접근 목록 표 없음)" "$(v2 "select to_regclass('public.os_access') is null")" "t"
out3=$( (echo "select set_config('app.os_owner_workspace', '6e000000-0000-0000-0000-00000000aaaa', false);"; cat supabase/migrations/20261007000019_os_access_pilot.sql) | su postgres -c "psql -v ON_ERROR_STOP=1 -d $DB2" 2>&1)
check "부풀림: 대표가 id 를 정하면 대표만 full" "$(v2 "select string_agg(u.email, ',') from public.os_access a join auth.users u on u.id = a.user_id where a.tier = 'full'")" "ceo@x.kr"
exit $BAD
