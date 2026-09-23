-- 20260923000013_module_data.sql
--
-- 모듈이 쌓는 기록 (D-91).
--
-- 고용지원금은 직원·회차·수수료를, 연구소는 연구과제·연구노트·활동을, 세일즈는 리드·교육을
-- 저마다 들고 있었다. 그 기록들이 이 OS 안에 살 자리를 하나로 만든다.
--
-- 왜 표 하나인가
--   모듈마다 표를 새로 파면 모듈 하나 늘 때마다 마이그레이션이 하나씩 붙는다.
--   모양이 제각각이고 아직 굳지 않은 기록들이라, 관계 컬럼(누구의·어느 모듈의·어느 갈래)만
--   꺼내 두고 내용은 payload 에 둔다. 굳은 뒤에 따로 떼어내도 늦지 않다.
--
-- 업체(회사)는 여기서 만들지 않는다. 업체는 operations_clients 하나뿐이고,
-- 모듈 기록은 client_id 로 그것을 가리킨다. 명단이 두 벌로 갈라지지 않게.
--
-- 이 파일은 feature 브랜치에만 있다. Production 에 적용하지 않았다.
-- 적용 전까지 앱은 이 브라우저(localStorage)에 쌓고, 적용하면 그때부터 클라우드로 간다.
--
-- 원칙: additive only · 멱등 · workspace RLS · anon revoke · 고객용 RPC 는 이 표를 읽지 않는다.
-- 주민등록번호·계좌번호·비밀번호·인증서·API 키를 넣는 컬럼은 없다.

begin;

create table if not exists public.module_data (
  id           text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 어느 모듈인가 (toolRegistry 의 key: employment · labcare · policy-funding · sales-kit …)
  module_key   text not null,
  -- 그 모듈 안의 어느 갈래인가 (employees · notes · leads …)
  bucket       text not null,
  -- 어느 업체의 기록인가. 업체와 상관없는 기록(자료실·설정)은 null
  client_id    text references public.operations_clients (id) on delete cascade,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.module_data is
  '모듈(도구) 기록 한 줄. module_key+bucket 으로 갈래를 나누고 내용은 payload. 업체는 operations_clients 를 재사용.';

create index if not exists module_data_ws_idx
  on public.module_data (workspace_id, module_key, bucket, updated_at desc);
create index if not exists module_data_client_idx
  on public.module_data (client_id);

drop trigger if exists trg_module_data_updated on public.module_data;
create trigger trg_module_data_updated
  before update on public.module_data
  for each row execute function public.bridge_touch_updated_at();

alter table public.module_data enable row level security;
revoke all on public.module_data from anon;

drop policy if exists "Workspace members can read module data" on public.module_data;
create policy "Workspace members can read module data"
  on public.module_data for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace writers can manage module data" on public.module_data;
create policy "Workspace writers can manage module data"
  on public.module_data for all
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

commit;
