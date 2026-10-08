/**
 * LEGACY 안내 (AX Hotfix) — 예전 '특허+벤처' 화면 안의 벤처 영역.
 * 새 벤처 업무는 기업성장 › 기업인증 › 벤처기업에서 한다. 이 화면의 기록은 지우지 않고, 기업인증이 읽어 쓴다.
 * 특허 출원 · MVP · 실사 같은 다른 업무는 그대로 여기서.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import { Button } from '../ui/Button'

export function LegacyVentureNotice({ clientId }: { clientId?: string | null }) {
  const href = `/tools/cert-os/venture${clientId ? `?client=${clientId}` : ''}`
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3" data-testid="legacy-venture-notice">
      <p className="t-sub flex min-w-0 flex-1 items-start gap-1.5 break-keep text-slate-800">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <span>벤처기업 확인 업무는 새 기업인증에서 진행합니다. 여기 적어 둔 벤처 기록은 그대로 남고 기업인증이 읽어 씁니다.</span>
      </p>
      <Link to={href} className="contents">
        <Button variant="secondary" size="sm" className="self-start sm:self-auto" data-testid="legacy-venture-open">
          기업인증 벤처 열기 <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </Link>
    </div>
  )
}
