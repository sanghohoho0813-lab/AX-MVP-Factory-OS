import type { ReactNode } from 'react'
import { LocalTestModeBadge } from '../runtime/LocalTestModeBanner'

interface PublicSurveyLayoutProps {
  organizationName: string
  surveyTitle: string
  /** 하단 고정 영역 (이전/다음 버튼 등) */
  footerBar?: ReactNode
  children: ReactNode
}

/**
 * 공개 설문 전용 레이아웃 — 내부 AppShell과 완전히 분리.
 * 밝은 배경, 최대 너비 ~768px, 모바일 우선.
 */
export function PublicSurveyLayout({
  organizationName,
  surveyTitle,
  footerBar,
  children,
}: PublicSurveyLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-3.5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[13px] font-bold text-white"
          >
            AX
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-slate-400">
              기업 AX 현장진단{organizationName ? ` · ${organizationName}` : ''}
            </p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {surveyTitle}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 pb-32">
        {children}
      </main>

      {footerBar && (
        <div
          className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto w-full max-w-3xl px-5 py-3">{footerBar}</div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-5 py-4 text-center">
          <p className="text-xs break-keep text-slate-400">
            문의는 담당 컨설턴트에게 요청해 주세요. 입력 내용은 자동으로 임시
            저장됩니다.
          </p>
          <div className="flex justify-center">
            <LocalTestModeBadge />
          </div>
        </div>
      </footer>
    </div>
  )
}

/** 토큰 오류 등 안내 전용 최소 레이아웃 */
export function PublicSurveyNotice({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-(--radius-panel) border border-slate-200 bg-white px-6 py-10 text-center shadow-(--shadow-card)">
        <p className="text-base font-semibold break-keep text-slate-900">{title}</p>
        <p className="mt-2 text-sm break-keep text-slate-500">{description}</p>
        <div className="mt-6 flex justify-center">
          <LocalTestModeBadge />
        </div>
      </div>
    </div>
  )
}
