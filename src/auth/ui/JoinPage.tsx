import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { acceptInvite } from '../workspaceService'
import { useAuth } from '../AuthProvider'
import { AuthLayout, AuthError, AuthNotice } from './AuthLayout'

/**
 * 초대 수락 화면. /join/:inviteToken
 * - 미로그인: 로그인 필요 안내(로그인 후 다시 이 링크로 접속).
 * - 로그인: 초대 수락 RPC 호출 → 워크스페이스 합류.
 */
export function JoinPage() {
  const { inviteToken = '' } = useParams()
  const navigate = useNavigate()
  const { session, refreshWorkspaces, selectWorkspace } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (session) {
      try {
        window.sessionStorage.removeItem('axmvp.pending_invite')
      } catch {
        /* noop */
      }
    } else {
      try {
        window.sessionStorage.setItem('axmvp.pending_invite', inviteToken)
      } catch {
        /* noop */
      }
    }
  }, [session, inviteToken])

  async function handleAccept() {
    if (working) return
    setError(null)
    setNotice(null)
    setWorking(true)
    try {
      const membership = await acceptInvite(inviteToken)
      await refreshWorkspaces()
      selectWorkspace(membership.workspaceId)
      setDone(true)
      setNotice('워크스페이스에 합류했습니다. 잠시 후 이동합니다.')
      setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대를 수락하지 못했습니다.')
    } finally {
      setWorking(false)
    }
  }

  if (!session) {
    return (
      <AuthLayout
        title="워크스페이스 초대"
        subtitle="초대를 수락하려면 먼저 로그인하거나 회원가입해야 합니다."
        footer={
          <>
            <Link to="/login" className="font-semibold text-brand-700 hover:underline">로그인</Link>
            {' · '}
            <Link to="/signup" className="font-semibold text-brand-700 hover:underline">회원가입</Link>
          </>
        }
      >
        <p className="text-sm break-keep text-slate-600">
          로그인 후 이 초대 링크로 다시 접속하면 자동으로 합류 안내가 표시됩니다.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="워크스페이스 초대" subtitle="아래 버튼을 눌러 워크스페이스에 합류하세요.">
      <div className="flex flex-col gap-4">
        <AuthError message={error} />
        <AuthNotice message={notice} />
        {!done && (
          <Button type="button" variant="primary" disabled={working} onClick={handleAccept} className="h-11 w-full">
            {working ? '합류 중…' : '초대 수락하기'}
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}
