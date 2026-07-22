/**
 * 부트스트랩 상태별 전체 화면. 흰 화면·무한 로딩을 방지하고 각 상태를 명시적으로 보여준다.
 * 조용히 local 모드로 fallback 하지 않는다.
 */

import { Loader2, RefreshCw, Settings2, WifiOff } from 'lucide-react'
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

export function ConfigurationErrorScreen({
  detail,
  missingKeys,
}: {
  detail?: string
  missingKeys?: string[]
}) {
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
      <p className="mt-4 text-[13px] break-keep text-slate-500">
        <code>.env.example</code> 를 참고해 <code>.env.local</code> 을 설정한 뒤 다시 시작하세요.
        브라우저에는 anon key 만 사용하며, service_role 키는 넣지 않습니다.
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
