/**
 * 워크스페이스 구성원·초대 관리 (supabase 모드).
 * owner·admin 만 관리 가능. viewer·editor 는 읽기만.
 * 초대 토큰 원문은 생성 직후 1회만 표시하고 DB 에는 해시만 저장한다.
 */

import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { useToast } from '../ui/toastContext'
import { useAuth } from '../../auth/AuthProvider'
import {
  createInvite,
  listMembers,
  removeMember,
  updateMemberRole,
  type WorkspaceMember,
  type WorkspaceRole,
} from '../../auth/workspaceService'

const ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer']
const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: '소유자',
  admin: '관리자',
  editor: '편집자',
  viewer: '뷰어',
}

export function WorkspaceMembersPanel() {
  const { session, currentWorkspaceId, workspaces } = useAuth()
  const { showToast } = useToast()
  const myRole = workspaces.find((w) => w.workspaceId === currentWorkspaceId)?.role ?? 'viewer'
  const canManage = myRole === 'owner' || myRole === 'admin'

  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [issuedToken, setIssuedToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null)

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return
    setLoading(true)
    setError(null)
    try {
      setMembers(await listMembers(currentWorkspaceId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '구성원을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!currentWorkspaceId || !session || busy) return
    setBusy(true)
    setError(null)
    setIssuedToken(null)
    try {
      const { inviteToken } = await createInvite(currentWorkspaceId, inviteEmail.trim(), inviteRole, session.user.id)
      setIssuedToken(inviteToken)
      setInviteEmail('')
      showToast('초대 코드를 생성했습니다. 지금 복사해 전달하세요(다시 표시되지 않습니다).')
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대를 생성하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRoleChange(member: WorkspaceMember, role: WorkspaceRole) {
    if (!currentWorkspaceId) return
    try {
      await updateMemberRole(currentWorkspaceId, member.userId, role)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '역할을 변경하지 못했습니다.')
    }
  }

  async function handleRemove() {
    if (!currentWorkspaceId || !confirmRemove) return
    setBusy(true)
    try {
      await removeMember(currentWorkspaceId, confirmRemove.userId)
      setConfirmRemove(null)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '구성원을 제거하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-500">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" /> 구성원 불러오는 중…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="rounded-(--radius-control) border border-danger-200 bg-danger-50/70 px-3 py-2 text-[13px] text-danger-700">{error}</p>
      )}

      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{m.displayName ?? m.email ?? m.userId}</p>
              {m.email && <p className="truncate text-[12px] text-slate-400">{m.email}</p>}
            </div>
            <div className="flex items-center gap-2">
              {canManage && m.userId !== session?.user.id ? (
                <>
                  <select
                    aria-label="역할"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m, e.target.value as WorkspaceRole)}
                    className="h-8 rounded-(--radius-control) border border-slate-300 bg-white px-2 text-[13px] text-slate-700"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="구성원 제거"
                    onClick={() => setConfirmRemove(m)}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-medium text-slate-600">
                  <ShieldCheck aria-hidden="true" className="size-3.5" /> {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage ? (
        <form onSubmit={handleInvite} className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <UserPlus aria-hidden="true" className="size-4 text-brand-600" /> 구성원 초대
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="invite-email" className="mb-1 block text-[12px] text-slate-500">이메일</label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="h-9 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-[12px] text-slate-500">역할</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="h-9 rounded-(--radius-control) border border-slate-300 bg-white px-2 text-sm"
              >
                {ROLES.filter((r) => r !== 'owner').map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>초대 코드 만들기</Button>
          </div>

          {issuedToken && (
            <div className="mt-3 rounded-(--radius-control) border border-brand-200 bg-white px-3 py-2.5">
              <p className="text-[12px] text-slate-500">아래 초대 코드는 지금만 표시됩니다(서버에는 해시만 저장). 7일 후 만료, 1회 사용.</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[13px] text-slate-800">{issuedToken}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(issuedToken)
                    showToast('초대 코드를 복사했습니다.')
                  }}
                  className="flex h-8 cursor-pointer items-center gap-1 rounded-(--radius-control) border border-slate-300 px-2 text-[13px] text-slate-600 hover:bg-slate-50"
                >
                  <Copy aria-hidden="true" className="size-3.5" /> 복사
                </button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <p className="text-[13px] text-slate-500">구성원 관리는 소유자·관리자만 할 수 있습니다.</p>
      )}

      <ConfirmModal
        open={confirmRemove !== null}
        title="구성원 제거"
        message={`${confirmRemove?.displayName ?? confirmRemove?.email ?? ''} 님을 이 워크스페이스에서 제거할까요?`}
        confirmLabel="제거"
        danger
        busy={busy}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}
