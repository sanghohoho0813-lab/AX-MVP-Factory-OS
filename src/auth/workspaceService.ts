/**
 * 워크스페이스 서비스 — 생성/목록/멤버/초대 를 RLS·RPC 로 안전하게 처리.
 * UI 는 Supabase SDK 를 직접 호출하지 않고 이 서비스만 사용한다.
 */

import { getSupabaseClient } from '../lib/supabase/client'
import { sha256Hex } from '../repositories/async/publicTokenClient'

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Workspace {
  id: string
  name: string
  slug: string | null
  ownerId: string
  createdAt: string
}

export interface WorkspaceMembership {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  workspace?: Workspace
}

export interface WorkspaceMember {
  userId: string
  role: WorkspaceRole
  email: string | null
  displayName: string | null
}

interface WorkspaceRow {
  id: string
  name: string
  slug: string | null
  owner_id: string
  created_at: string
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return { id: row.id, name: row.name, slug: row.slug, ownerId: row.owner_id, createdAt: row.created_at }
}

/** 내가 속한 워크스페이스 목록(멤버십 + 워크스페이스) */
export async function listMyWorkspaces(): Promise<WorkspaceMembership[]> {
  const { data, error } = await getSupabaseClient()
    .from('workspace_members')
    .select('workspace_id, user_id, role, workspaces:workspace_id (id, name, slug, owner_id, created_at)')
  if (error) throw new Error('작업공간 목록을 불러오지 못했습니다.')
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      workspace_id: string
      user_id: string
      role: WorkspaceRole
      workspaces: WorkspaceRow | null
    }
    return {
      workspaceId: r.workspace_id,
      userId: r.user_id,
      role: r.role,
      workspace: r.workspaces ? mapWorkspace(r.workspaces) : undefined,
    }
  })
}

/** 워크스페이스 생성(생성자 = owner). SECURITY DEFINER RPC 로 원자 처리. */
export async function createWorkspace(name: string, slug?: string): Promise<Workspace> {
  const { data, error } = await getSupabaseClient().rpc('create_workspace', {
    workspace_name: name,
    workspace_slug: slug ?? null,
  })
  if (error) throw new Error(error.message || '작업공간을 생성하지 못했습니다.')
  return mapWorkspace(data as WorkspaceRow)
}

/** 초대 수락(토큰 원문 → 서버에서 해시 비교). */
export async function acceptInvite(inviteToken: string): Promise<WorkspaceMembership> {
  const { data, error } = await getSupabaseClient().rpc('accept_workspace_invite', {
    invite_token: inviteToken,
  })
  if (error) throw new Error(error.message || '초대를 수락하지 못했습니다.')
  const r = data as { workspace_id: string; user_id: string; role: WorkspaceRole }
  return { workspaceId: r.workspace_id, userId: r.user_id, role: r.role }
}

/** 워크스페이스 멤버 목록(프로필 조인). */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await getSupabaseClient()
    .from('workspace_members')
    .select('user_id, role, profiles:user_id (email, display_name)')
    .eq('workspace_id', workspaceId)
  if (error) throw new Error('멤버 목록을 불러오지 못했습니다.')
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      user_id: string
      role: WorkspaceRole
      profiles: { email: string | null; display_name: string | null } | null
    }
    return {
      userId: r.user_id,
      role: r.role,
      email: r.profiles?.email ?? null,
      displayName: r.profiles?.display_name ?? null,
    }
  })
}

/**
 * 멤버 초대 생성. 토큰 원문은 저장하지 않고 해시만 DB 에 넣는다.
 * 반환된 원문 토큰은 호출 측이 초대 링크로 1회 전달하고 저장하지 않는다.
 */
export async function createInvite(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedBy: string,
  expiresInHours = 168,
): Promise<{ inviteToken: string }> {
  const token = generateInviteToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = expiryIso(expiresInHours)
  const { error } = await getSupabaseClient().from('workspace_invites').insert({
    workspace_id: workspaceId,
    email,
    role,
    token_hash: tokenHash,
    invited_by: invitedBy,
    expires_at: expiresAt,
  })
  if (error) throw new Error('초대를 생성하지 못했습니다.')
  return { inviteToken: token }
}

/* ------------------------------------------------------------------ */
/* D-523 보낸 초대 목록 · 취소 (TEAM-1)                                    */
/* 서버가 소유자 · 관리자에게만 준다(workspace_invites RLS). 토큰(해시)은 읽지 않는다.  */
/* 취소 = 상태만 'revoked'(줄은 남음 — 언제 누구를 초대했는지 기록). 취소된 링크는 서버가 막는다. */
/* ------------------------------------------------------------------ */

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface WorkspaceInvite {
  id: string
  email: string
  role: WorkspaceRole
  status: InviteStatus
  expiresAt: string
  createdAt: string
}

/** 화면에 보일 상태 — 기다림인데 기한이 지났으면 '만료'(서버는 누가 링크를 열 때 바꾼다) */
export function inviteView(inv: WorkspaceInvite, now: number = Date.now()): { state: InviteStatus; daysLeft: number } {
  const left = (Date.parse(inv.expiresAt) - now) / 86_400_000
  const state: InviteStatus = inv.status === 'pending' && !(left > 0) ? 'expired' : inv.status
  return { state, daysLeft: state === 'pending' ? Math.max(1, Math.ceil(left)) : 0 }
}

/** 기다리는 것 먼저(곧 만료 순) · 그다음 지난 것(최근 순) */
export function sortInvites(list: readonly WorkspaceInvite[], now: number = Date.now()): { open: WorkspaceInvite[]; past: WorkspaceInvite[] } {
  const open: WorkspaceInvite[] = []
  const past: WorkspaceInvite[] = []
  for (const i of list) (inviteView(i, now).state === 'pending' ? open : past).push(i)
  open.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
  past.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { open, past }
}

export async function listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  // 기다리는 초대는 전부(오래돼도 아직 살아 있는 링크를 숨기지 않게) + 지난 초대는 최근 50건
  const cols = 'id, email, role, status, expires_at, created_at'
  const [open, past] = await Promise.all([
    getSupabaseClient().from('workspace_invites').select(cols).eq('workspace_id', workspaceId).eq('status', 'pending').order('created_at', { ascending: false }).limit(500),
    getSupabaseClient().from('workspace_invites').select(cols).eq('workspace_id', workspaceId).neq('status', 'pending').order('created_at', { ascending: false }).limit(50),
  ])
  if (open.error || past.error) throw new Error('보낸 초대를 불러오지 못했습니다.')
  return ([...(open.data ?? []), ...(past.data ?? [])] as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ''),
    role: (r.role as WorkspaceRole) ?? 'viewer',
    status: (r.status as InviteStatus) ?? 'pending',
    expiresAt: String(r.expires_at ?? ''),
    createdAt: String(r.created_at ?? ''),
  }))
}

/** 기다리는 초대를 취소(상태만 바꾼다 — 이미 수락 · 취소된 것은 그대로). 실제로 바꿨으면 true — 그새 들어왔거나 처리됐으면 false */
export async function revokeInvite(workspaceId: string, inviteId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('workspace_invites')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error('초대를 취소하지 못했습니다.')
  return (data ?? []).length > 0
}

/** 멤버 역할 변경. */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  if (error) throw new Error('멤버 역할을 변경하지 못했습니다.')
}

/** 멤버 제거. */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  if (error) throw new Error('멤버를 제거하지 못했습니다.')
}

/** URL-safe 고엔트로피 초대 토큰(원문). 저장하지 않고 해시만 DB 에 저장. */
function generateInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/**
 * 만료 ISO 계산. Date.now 를 직접 쓰되 콘텐츠가 아닌 메타데이터 타임스탬프 용도.
 */
function expiryIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString()
}
