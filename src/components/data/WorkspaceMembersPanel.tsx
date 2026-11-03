/**
 * 워크스페이스 구성원·초대 관리 (supabase 모드).
 * owner·admin 만 관리 가능. viewer·editor 는 읽기만.
 * 초대 토큰 원문은 생성 직후 1회만 표시하고 DB 에는 해시만 저장한다.
 */

import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, MailX, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Disclosure } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { useAuth } from '../../auth/AuthProvider'
import {
  createInvite,
  inviteView,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  sortInvites,
  updateMemberRole,
  type InviteStatus,
  type WorkspaceInvite,
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

const INVITE_STATE: Record<InviteStatus, string> = { pending: '기다리는 중', accepted: '들어옴', revoked: '취소함', expired: '기한 지남' }
const md = (iso: string) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

/** 받는 분이 그대로 여는 초대 링크(/join/코드) */
const inviteLink = (token: string) => `${window.location.origin}/join/${encodeURIComponent(token)}`

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
  /** D-523 보낸 초대 — 소유자 · 관리자만(서버도 그 사람에게만 준다) */
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [invitesFailed, setInvitesFailed] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<WorkspaceInvite | null>(null)

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

  const loadInvites = useCallback(async () => {
    if (!currentWorkspaceId || !canManage) return
    try {
      setInvites(await listInvites(currentWorkspaceId))
      setInvitesFailed(false)
    } catch {
      setInvitesFailed(true)
    }
  }, [currentWorkspaceId, canManage])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  async function handleRevoke() {
    if (!currentWorkspaceId || !confirmRevoke) return
    setBusy(true)
    try {
      const done = await revokeInvite(currentWorkspaceId, confirmRevoke.id)
      setConfirmRevoke(null)
      showToast(done ? `${confirmRevoke.email} 초대를 취소했어요 — 그 링크로는 들어올 수 없어요.` : `${confirmRevoke.email} 초대는 그새 들어왔거나 이미 처리됐어요 — 목록을 다시 불러왔어요.`)
      await loadInvites()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '초대를 취소하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

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
      void loadInvites()
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
      <div className="flex items-center gap-2 text-[0.875rem] text-slate-500">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" /> 구성원 불러오는 중…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.875rem] text-danger-700">{error}</p>
      )}

      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{m.displayName ?? m.email ?? m.userId}</p>
              {m.email && <p className="truncate text-[0.875rem] text-slate-400">{m.email}</p>}
            </div>
            <div className="flex items-center gap-2">
              {canManage && m.userId !== session?.user.id ? (
                <>
                  <select
                    aria-label="역할"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m, e.target.value as WorkspaceRole)}
                    className="h-8 rounded-(--radius-control) border border-slate-300 bg-white px-2 text-[0.875rem] text-slate-700"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="구성원 제거"
                    onClick={() => setConfirmRemove(m)}
                    className="tap flex size-8 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.875rem] font-medium text-slate-600">
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
            {/* D-523 휴대폰에서 이메일 칸이 글자 몇 자 폭으로 눌렸다 — 좁으면 한 줄 전부 */}
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="invite-email" className="mb-1 block text-[0.875rem] text-slate-500">이메일</label>
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
              <label htmlFor="invite-role" className="mb-1 block text-[0.875rem] text-slate-500">역할</label>
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
              <p className="text-[0.875rem] text-slate-500">아래 초대 링크는 지금만 표시됩니다(서버에는 해시만 저장). 7일 후 만료, 1회 사용. 받는 분은 링크를 열어 로그인(회원가입)하면 바로 합류 단추가 보입니다.</p>
              <div className="mt-1.5 flex items-center gap-2">
                {/* D-223 코드만 주면 받는 분이 넣을 곳이 없었다(가입 뒤 '접근 권한 없음' 화면만) — 링크 그대로 */}
                <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[0.875rem] text-slate-800" data-testid="invite-link">{inviteLink(issuedToken)}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(inviteLink(issuedToken))
                    showToast('초대 링크를 복사했습니다.')
                  }}
                  className="tap flex h-8 cursor-pointer items-center gap-1 rounded-(--radius-control) border border-slate-300 px-2 text-[0.875rem] text-slate-600 hover:bg-slate-50"
                >
                  <Copy aria-hidden="true" className="size-3.5" /> 복사
                </button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <p className="text-[0.875rem] text-slate-500">구성원 관리는 소유자·관리자만 할 수 있습니다.</p>
      )}

      {/* D-523 보낸 초대 — 기다리는 것만 펴 두고, 지난 것(들어옴 · 취소 · 기한 지남)은 접어 둔다 */}
      {canManage && (invites.length > 0 || invitesFailed) && (() => {
        const { open, past } = sortInvites(invites)
        return (
          <section aria-labelledby="sent-invites" className="flex flex-col gap-2" data-testid="sent-invites">
            <h3 id="sent-invites" className="text-sm font-semibold text-slate-800">
              보낸 초대 {open.length > 0 && <span className="text-brand-700">기다리는 중 {open.length}</span>}
            </h3>
            {invitesFailed && <p className="text-[0.875rem] text-danger-700">보낸 초대를 불러오지 못했어요 — 인터넷을 확인하고 다시 열어 주세요.</p>}
            {open.length > 0 ? (
              <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200 bg-white">
                {open.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3" data-testid="invite-row">
                    <span className="min-w-0 flex-[1_1_12rem] truncate text-sm font-medium text-slate-800">{inv.email}</span>
                    <span className="text-[0.875rem] text-slate-600">{ROLE_LABEL[inv.role]}</span>
                    <span className="text-[0.875rem] text-slate-500" data-testid="invite-left">{md(inv.createdAt)} 보냄 · {inviteView(inv).daysLeft}일 남음</span>
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(inv)}
                      className="tap ml-auto inline-flex h-8 cursor-pointer items-center gap-1 rounded-(--radius-control) border border-slate-300 px-2 text-[0.875rem] text-slate-700 hover:bg-danger-50 hover:text-danger-700"
                      data-testid="invite-revoke"
                    >
                      <MailX aria-hidden="true" className="size-3.5" /> 초대 취소
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !invitesFailed && <p className="text-[0.875rem] text-slate-500">기다리는 초대가 없어요.</p>
            )}
            {past.length > 0 && (
              <Disclosure title="지난 초대" hint={`${past.length}건 — 들어옴 · 취소 · 기한 지남`}>
                <ul className="flex flex-col divide-y divide-slate-100" data-testid="invite-past">
                  {past.map((inv) => {
                    const state = inviteView(inv).state
                    return (
                      <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.875rem]">
                        <span className="min-w-0 flex-[1_1_12rem] truncate text-slate-700">{inv.email}</span>
                        <span className="text-slate-500">{ROLE_LABEL[inv.role]} · {md(inv.createdAt)} 보냄</span>
                        <span className={`font-semibold ${state === 'accepted' ? 'text-slate-700' : 'text-slate-500'}`}>{INVITE_STATE[state]}</span>
                      </li>
                    )
                  })}
                </ul>
              </Disclosure>
            )}
          </section>
        )
      })()}

      <ConfirmModal
        open={confirmRevoke !== null}
        title="초대 취소"
        message={`${confirmRevoke?.email ?? ''} 에게 보낸 초대를 취소할까요? 이미 보낸 링크로는 들어올 수 없어요. 다시 부르려면 새로 초대하면 돼요.`}
        confirmLabel="초대 취소"
        danger
        busy={busy}
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevoke(null)}
      />

      <ConfirmModal
        open={confirmRemove !== null}
        title="구성원 제거"
        message={`${confirmRemove?.displayName ?? confirmRemove?.email ?? ''} 님을 이 작업공간에서 제거할까요?`}
        confirmLabel="제거"
        danger
        busy={busy}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}
