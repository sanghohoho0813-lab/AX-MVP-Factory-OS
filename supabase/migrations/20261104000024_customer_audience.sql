-- =====================================================================
-- D-533 SEC-4 외부 구독 고객 ↔ 내부 팀장(Pilot) 권한 분리 — 운영 미적용(대표 승인 뒤 SQL Editor 에서)
--
-- 왜: 등급은 full(대표 쪽) · pilot(1인 작업공간) 둘뿐이었다. 외부 유료 고객을 지금 Pilot 준비 SQL 로 열면
--   ① 0020 os_access_link_owner_to_pilots() 가 대표를 **모든 pilot 작업공간의 편집자**로 넣고(고객 업체 · 서류 · 수금이 대표에게 열림)
--   ② 머리줄 팀장 화면 전환(my_pilot_views)에 고객이 다 뜨고
--   ③ pilot_provision.sql 이 AI 권한을 internal(한도 없음)로 넣었다.
-- 대표 지시(2026-11-04): "대표의 팀장 화면 전환 기능은 유지하되, 일반 고객에게 대표가 자동 편집자로 들어가는 구조는 절대 허용하지 마세요."
--
-- 방법(추가만): os_access 에 audience 칸 하나 — internal(내부 팀장 · 기존 계정 전부 · 기본값) / customer(외부 구독 고객).
--   - 대표 연결(0020) · 팀장 화면 목록은 **internal pilot 만**. 고객 작업공간에는 대표가 들어가지 않는다.
--   - DB 장치: full(대표 쪽) 계정은 customer 의 작업공간 구성원이 될 수 없다 — 초대 · 서버 작업(SQL Editor) 모두. 예외 없음.
--   - 이미 대표가 구성원인 Pilot 을 customer 로 바꾸려 하면 멈춘다(먼저 구성원 줄을 빼라고 안내 — 이 파일은 지우지 않는다).
--   - customer 의 AI 권한은 internal(한도 없음)이 될 수 없다 — 요금제 · 한도 · 기한이 있는 customer 로만.
-- 기존 동작: 지금 있는 계정은 모두 internal → 대표 ↔ 최은혜 팀장 화면 전환 · 연결 · AI 그대로.
-- 표 · 열 · 정책 · 자료 삭제 없음. 함수 2개는 같은 이름으로 다시 만든다(조건 하나 더함). 여러 번 실행해도 같다.
-- 선행: 0019 · 0020(없으면 아무것도 바꾸지 않고 멈춘다). 0022 가 있으면 AI 권한 장치도 붙는다.
-- 되돌리기(필요할 때만): 트리거 drop · 함수 두 개를 0020 본문으로 다시 실행 · audience 칸은 남겨도 무해(기본값 internal)
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.os_access') is null or to_regprocedure('public.os_access_link_owner_to_pilots()') is null then
    raise exception '0019 · 0020 을 먼저 실행하세요. 0024 는 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- 1) 누구를 위한 계정인가 — 기존 줄은 모두 internal(지금과 똑같이)
alter table public.os_access add column if not exists audience text not null default 'internal';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'os_access_audience_check' and conrelid = 'public.os_access'::regclass) then
    alter table public.os_access add constraint os_access_audience_check check (audience in ('internal', 'customer'));
  end if;
end $$;
comment on column public.os_access.audience is 'D-533 internal = 대표 · 내부 팀장(대표가 팀장 화면을 볼 수 있음) / customer = 외부 구독 고객(대표 자동 연결 없음 · 대표 구성원 금지). SQL Editor 에서만 바꾼다.';

-- 2) 대표 연결은 내부 팀장(internal pilot)만 — 0020 과 같고 audience 조건 하나 더
create or replace function public.os_access_link_owner_to_pilots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  n integer;
begin
  select w.owner_id into v_owner from public.workspaces w where w.id = public.default_intake_workspace();
  if v_owner is null or not exists (select 1 from public.os_access a where a.user_id = v_owner and a.tier = 'full') then
    return 0;
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, v_owner, 'editor'
  from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' and p.audience = 'internal'
  on conflict (workspace_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.os_access_link_owner_to_pilots() from public, anon, authenticated;

-- 3) 팀장 화면 목록도 내부 팀장만 — 0020 과 같고 audience 조건 하나 더
create or replace function public.my_pilot_views()
returns table (workspace_id uuid, workspace_name text, person_name text, person_title text)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), 'Pilot'),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'title'), ''), '')
  from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' and p.audience = 'internal'
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = auth.uid()
  left join auth.users u on u.id = w.owner_id
  where exists (select 1 from public.os_access a where a.user_id = auth.uid() and a.tier = 'full')
  order by w.created_at;
$$;
revoke all on function public.my_pilot_views() from public, anon;
grant execute on function public.my_pilot_views() to authenticated;

-- 4) 고객 작업공간에 대표 쪽(full) 계정은 들어갈 수 없다 — 초대 · 서버 작업 모두(예외 없음)
create or replace function public.os_access_customer_member_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.workspaces w
    join public.os_access c on c.user_id = w.owner_id and c.audience = 'customer'
    where w.id = new.workspace_id
  ) and exists (select 1 from public.os_access a where a.user_id = new.user_id and a.tier = 'full') then
    raise exception '고객 작업공간에는 대표 쪽 계정이 구성원으로 들어갈 수 없습니다(고객 자료 보호).' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_customer_member_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_customer_member on public.workspace_members;
create trigger zz_os_access_customer_member
  before insert or update on public.workspace_members
  for each row execute function public.os_access_customer_member_guard();

-- 5) customer 로 바꿀 때 — 이미 대표 쪽 계정이 그 작업공간 구성원이거나, AI 가 internal(한도 없음)이면 멈춘다(자동으로 지우지 않는다)
create or replace function public.os_access_audience_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience = 'customer' then
    if new.tier = 'full' then
      raise exception '대표 쪽(full) 계정은 고객(customer)으로 둘 수 없습니다.' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.workspaces w
      join public.workspace_members m on m.workspace_id = w.id and m.user_id <> w.owner_id
      join public.os_access a on a.user_id = m.user_id and a.tier = 'full'
      where w.owner_id = new.user_id
    ) then
      raise exception '이 계정의 작업공간에 대표 쪽 계정이 구성원으로 있습니다 — 먼저 그 구성원 줄을 빼고(대표 승인) 다시 실행하세요. 아무것도 바꾸지 않았습니다.' using errcode = '42501';
    end if;
    if to_regclass('public.ai_entitlements') is not null
       and exists (select 1 from public.ai_entitlements e where e.user_id = new.user_id and e.kind = 'internal') then
      raise exception '이 계정의 AI 권한이 내부 팀장(한도 없음)입니다 — 먼저 customer 요금제로 바꾸고 다시 실행하세요. 아무것도 바꾸지 않았습니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.os_access_audience_guard() from public, anon, authenticated;
drop trigger if exists zz_os_access_audience on public.os_access;
create trigger zz_os_access_audience
  before insert or update on public.os_access
  for each row execute function public.os_access_audience_guard();

-- 6) (0022 가 있을 때) 고객의 AI 권한은 internal(한도 없음)이 될 수 없다
do $$
begin
  if to_regclass('public.ai_entitlements') is not null then
    execute $f$
      create or replace function public.ai_entitlements_customer_guard()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $g$
      begin
        if new.kind = 'internal' and exists (select 1 from public.os_access a where a.user_id = new.user_id and a.audience = 'customer') then
          raise exception '외부 구독 고객의 AI 권한은 내부 팀장(한도 없음)으로 둘 수 없습니다 — customer 요금제 · 한도 · 기한으로.' using errcode = '42501';
        end if;
        return new;
      end;
      $g$
    $f$;
    execute 'revoke all on function public.ai_entitlements_customer_guard() from public, anon, authenticated';
    execute 'drop trigger if exists zz_ai_entitlements_customer on public.ai_entitlements';
    execute 'create trigger zz_ai_entitlements_customer before insert or update on public.ai_entitlements for each row execute function public.ai_entitlements_customer_guard()';
  end if;
end $$;

commit;

-- 확인(바꾸지 않음): 계정 등급 · 대상별 수 — 지금 있는 줄은 모두 internal 이어야 한다
select tier, audience, count(*) from public.os_access group by 1, 2 order by 1, 2;
