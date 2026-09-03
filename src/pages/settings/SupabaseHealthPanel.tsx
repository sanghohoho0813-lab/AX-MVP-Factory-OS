import { useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import { useAuth } from '../../auth/AuthProvider'

type CheckState = 'idle' | 'running' | 'ok' | 'fail'

interface CheckRow {
  key: string
  label: string
  state: CheckState
  detail: string
}

/** 클라우드 연결이 제대로 됐는지 스스로 확인할 수 있는 점검 패널 */
export function SupabaseHealthPanel() {
  const cfg = getDataModeConfig()
  const { session, currentWorkspaceId, workspaces } = useAuth()
  const [rows, setRows] = useState<CheckRow[]>([])
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    const out: CheckRow[] = []
    const add = (key: string, label: string, state: CheckState, detail: string) => {
      out.push({ key, label, state, detail })
      setRows([...out])
    }

    add('mode', '데이터 모드', cfg.mode === 'supabase' ? 'ok' : 'fail',
      cfg.mode === 'supabase' ? '클라우드(supabase)' : '로컬 — Vercel 환경변수 VITE_DATA_MODE=supabase 를 넣고 다시 배포하세요')

    if (cfg.mode !== 'supabase') {
      setRunning(false)
      return
    }

    add('url', '연결 주소', cfg.supabaseUrl ? 'ok' : 'fail',
      cfg.supabaseUrl ? cfg.supabaseUrl.replace(/^https:\/\/([^.]{0,6}).*/, 'https://$1…supabase.co') : 'VITE_SUPABASE_URL 이 비어 있습니다')

    add('login', '로그인', session ? 'ok' : 'fail', session ? (session.user.email ?? '로그인됨') : '로그인이 필요합니다')

    add('workspace', '워크스페이스', currentWorkspaceId ? 'ok' : 'fail',
      currentWorkspaceId ? (workspaces.find((w) => w.workspaceId === currentWorkspaceId)?.workspace?.name ?? '선택됨') : '워크스페이스를 만들어 주세요')

    // 실제 표 읽기
    try {
      const { error, count } = await getSupabaseClient()
        .from('operations_clients')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspaceId ?? '')
      if (error) throw error
      add('table', '고객 표 읽기', 'ok', `고객 ${count ?? 0}곳`)
    } catch (cause) {
      add('table', '고객 표 읽기', 'fail',
        cause instanceof Error ? `${cause.message} — SETUP.sql 을 실행했는지 확인하세요` : '읽지 못했습니다')
    }

    // 파일 보관함
    try {
      const { error } = await getSupabaseClient().storage.from('client-documents').list('', { limit: 1 })
      if (error) throw error
      add('storage', '파일 보관함', 'ok', 'client-documents 사용 가능')
    } catch (cause) {
      add('storage', '파일 보관함', 'fail',
        cause instanceof Error ? `${cause.message} — SETUP.sql 을 실행했는지 확인하세요` : '확인하지 못했습니다')
    }

    setRunning(false)
  }

  return (
    <Panel title="클라우드 연결 점검">
      <HelpNote summary="Supabase 연결이 제대로 됐는지 하나씩 확인합니다. 안 되는 항목이 있으면 무엇을 고쳐야 하는지 함께 알려드립니다." />
      <div className="mt-4">
        <Button variant="primary" onClick={() => void run()} disabled={running}>
          <RefreshCw aria-hidden="true" className={`size-4 ${running ? 'animate-spin' : ''}`} />
          {running ? '확인 중…' : '연결 점검하기'}
        </Button>
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li
              key={r.key}
              className={`flex items-start gap-2.5 rounded-(--radius-control) border px-3.5 py-2.5 ${
                r.state === 'ok' ? 'border-success-200 bg-success-50/60' : 'border-danger-200 bg-danger-50/60'
              }`}
            >
              {r.state === 'ok' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-600" />
              )}
              <span className="min-w-0">
                <span className="block text-[0.98rem] font-semibold text-slate-800">{r.label}</span>
                <span className="block text-[0.9rem] break-keep text-slate-600">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
