/**
 * 부트스트랩 상태별 전체 화면. 흰 화면·무한 로딩을 방지하고 각 상태를 명시적으로 보여준다.
 * 조용히 local 모드로 fallback 하지 않는다.
 */

import { useState } from 'react'
import { Check, Copy, Loader2, RefreshCw, Settings2, WifiOff } from 'lucide-react'
import { Button } from '../../components/ui/Button'

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}

export function InitializingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50">
      <Loader2 aria-hidden="true" className="size-7 animate-spin text-brand-500" />
      <p className="text-sm text-slate-500">불러오는 중…</p>
    </div>
  )
}

/** 안내문에 올바른 값이 들어있으면 그 값만 뽑아 복사 버튼을 붙인다 */
function extractSuggestedUrl(detail?: string): string | null {
  if (!detail) return null
  const m = /https:\/\/[a-z0-9-]+\.supabase\.co/i.exec(detail)
  return m ? m[0] : null
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 rounded-(--radius-card) border border-brand-200 bg-brand-50 p-3 text-left">
      <p className="text-[12px] font-semibold text-brand-700">이 값을 그대로 넣으세요</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).catch(() => undefined)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-brand-300 bg-white px-2 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-100"
        >
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  )
}

export function ConfigurationErrorScreen({
  detail,
  missingKeys,
}: {
  detail?: string
  missingKeys?: string[]
}) {
  const suggested = extractSuggestedUrl(detail)
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <Settings2 aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">클라우드 설정이 필요합니다</h1>
      <p className="mt-2 text-sm break-keep text-slate-600">
        {detail ?? '클라우드 저장 모드에 필요한 환경변수가 올바르지 않습니다.'}
      </p>
      {missingKeys && missingKeys.length > 0 && (
        <ul className="mt-4 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[13px] text-slate-600">
          {missingKeys.map((k) => (
            <li key={k} className="font-mono">• {k}</li>
          ))}
        </ul>
      )}
      {suggested && <CopyableValue value={suggested} />}

      <div className="mt-4 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[13px] break-keep text-slate-600">
        <p className="font-semibold text-slate-700">고치는 방법</p>
        <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-4">
          <li>Vercel → 이 프로젝트 → <b>Settings</b> → <b>Environment Variables</b></li>
          <li>위 값으로 수정하고 <b>Save</b></li>
          <li>
            <b>Deployments</b> 탭 → 맨 위 배포의 <b>⋯</b> → <b>Redeploy</b>
            <span className="block text-slate-500">환경변수는 다시 배포해야 반영됩니다.</span>
          </li>
        </ol>
        <p className="mt-2 text-slate-500">
          내 컴퓨터에서 직접 실행하는 경우에는 <code>.env.example</code> 를 참고해 <code>.env</code> 를 만드세요.
        </p>
      </div>

      <p className="mt-3 text-[12px] break-keep text-slate-400">
        브라우저에는 공개 키(anon 또는 sb_publishable)만 사용합니다. service_role·sb_secret 키는 넣지 마세요.
      </p>
      <Button variant="secondary" className="mt-5 w-full" onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden="true" className="size-4" /> 다시 시도
      </Button>
    </CenteredCard>
  )
}

export function ConnectionErrorScreen({ detail, onRetry }: { detail?: string; onRetry: () => void }) {
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-100 text-danger-700">
        <WifiOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">연결에 실패했습니다</h1>
      <p className="mt-2 text-sm break-keep text-slate-600">
        {detail ?? '클라우드 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.'}
      </p>
      <Button variant="primary" className="mt-5 w-full" onClick={onRetry}>
        <RefreshCw aria-hidden="true" className="size-4" /> 다시 시도
      </Button>
    </CenteredCard>
  )
}
