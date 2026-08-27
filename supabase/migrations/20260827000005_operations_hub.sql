-- AX 컨설팅 실운영 고객 허브: 고객별 업무, 자료 수령, 수금, 지원사업 진행을 한 레코드로 저장한다.
create table if not exists public.operations_clients (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) > 0),
  status text not null default 'active' check (status in ('active', 'waiting', 'paused', 'completed')),
  next_action text not null default '',
  next_action_due_date date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operations_clients_workspace_updated_idx
  on public.operations_clients (workspace_id, updated_at desc);

alter table public.operations_clients enable row level security;

create policy "Workspace members can read operations clients"
  on public.operations_clients for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create operations clients"
  on public.operations_clients for insert to authenticated
  with check (public.can_write_workspace(workspace_id));

create policy "Workspace members can update operations clients"
  on public.operations_clients for update to authenticated
  using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

create policy "Workspace members can delete operations clients"
  on public.operations_clients for delete to authenticated
  using (public.can_write_workspace(workspace_id));

drop trigger if exists set_operations_clients_updated_at on public.operations_clients;
create trigger set_operations_clients_updated_at
  before update on public.operations_clients
  for each row execute function public.touch_updated_at();

-- 민감한 증빙은 public URL 없이 Storage RLS로만 제공한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy "Workspace members can list client documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

create policy "Workspace members can upload client documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));

create policy "Workspace members can update client documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));

create policy "Workspace members can remove client documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and public.can_write_workspace((storage.foldername(name))[1]::uuid));
