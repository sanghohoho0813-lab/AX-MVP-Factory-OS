/**
 * LEGACY 안내 (AX Hotfix · D-179) — 예전 '특허+벤처'(지금 '특허·MVP') 화면 안의 벤처 영역.
 * 새 벤처 업무는 기업성장 › 기업인증 › 벤처기업에서 한다. 이 화면의 벤처 기록은 지우지 않고 읽기만 하며, 기업인증이 읽어 쓴다.
 * 특허 출원 · MVP 같은 다른 업무는 그대로 여기서.
 *  - banner: 목록 · 업체 상세 컨설팅 탭 위 한 줄(보조 단추)
 *  - record: 예전 벤처 기록 화면 맨 위(이 영역의 Primary 하나 = [기업인증 벤처 열기])
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import { Button } from '../ui/Button'

export function LegacyVentureNotice({ clientId, variant = 'banner' }: { clientId?: string | null; variant?: 'banner' | 'record' }) {
  const href = `/tools/cert-os/venture${clientId ? `?client=${clientId}` : ''}`
  if (variant === 'record') {
    return (
      <section className="flex flex-col gap-2 rounded-(--radius-panel) border border-brand-200 bg-brand-50 px-4 py-3.5" data-testid="legacy-venture-record-notice">
        <p className="t-card inline-flex items-center gap-1.5 font-bold text-slate-900">
          <Info aria-hidden="true" className="size-4 shrink-0 text-brand-600" /> 이전 벤처 기록입니다
        </p>
        <p className="t-sub break-keep text-slate-700">이 화면의 벤처 정보는 과거 기록 확인용입니다. 현재 벤처기업 확인 · 준비 · 신청 진행은 기업인증에서 관리합니다.</p>
        <Link to={href} className="contents">
          <Button variant="primary" className="self-start" data-testid="legacy-venture-record-open">
            기업인증 벤처 열기 <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </Link>
      </section>
    )
  }
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
