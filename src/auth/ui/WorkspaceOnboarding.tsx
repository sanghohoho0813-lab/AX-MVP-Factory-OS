/**
 * 로그인은 했지만 워크스페이스가 없거나 미선택일 때의 온보딩 화면.
 * 새 워크스페이스를 만들거나, 초대 코드로 참여한다.
 */

import { useState } from 'react'
import { Building2, LogOut, Plus, Ticket } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { AuthField, AuthError, AuthNotice } from './AuthLayout'
import { createWorkspace, acceptInvite } from '../workspaceService'
import { useAuth } from '../AuthProvider'

export function WorkspaceOnboarding() {
  const { refreshWorkspaces, selectWorkspace, signOut } = useAuth()
  const [name, setName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setNotice(null)
    if (!name.trim()) {
      setError('워크스페이스 이름을 입력하세요.')
      return
    }
    setBusy(true)
    try {
      const ws = await createWorkspace(name.trim())
      await refreshWorkspaces()
      selectWorkspace(ws.id)
      setNotice('워크스페이스를 만들었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '워크스페이스를 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setNotice(null)
    if (!inviteToken.trim()) {
      setError('초대 코드를 입력하세요.')
      return
    }
    setBusy(true)
    try {
      const membership = await acceptInvite(inviteToken.trim())
      await refreshWorkspaces()
      selectWorkspace(membership.workspaceId)
      setNotice('워크스페이스에 합류했습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대를 수락하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">워크스페이스 시작</h1>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" className="size-4" /> 로그아웃
          </Button>
        </div>
        <p className="mb-5 text-sm break-keep text-slate-500">
          새 워크스페이스를 만들거나, 받은 초대 코드로 기존 워크스페이스에 참여하세요.
        </p>

        <AuthError message={error} />
        <div className="mt-2" />
        <AuthNotice message={notice} />

        <form onSubmit={handleCreate} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Building2 aria-hidden="true" className="size-4 text-brand-600" /> 새 워크스페이스 만들기
          </div>
          <AuthField id="ws-name" label="워크스페이스 이름" value={name} onChange={setName} placeholder="예: 우리 컨설팅" disabled={busy} />
          <Button type="submit" variant="primary" disabled={busy} className="mt-4 h-11 w-full">
            <Plus aria-hidden="true" className="size-4" /> {busy ? '처리 중…' : '만들기'}
          </Button>
        </form>

        <form onSubmit={handleJoin} className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Ticket aria-hidden="true" className="size-4 text-brand-600" /> 초대 코드로 참여
          </div>
          <AuthField id="invite" label="초대 코드" value={inviteToken} onChange={setInviteToken} placeholder="초대 코드를 붙여넣기" required={false} disabled={busy} />
          <Button type="submit" variant="secondary" disabled={busy} className="mt-4 h-11 w-full">
            {busy ? '처리 중…' : '참여하기'}
          </Button>
        </form>
      </div>
    </div>
  )
}
