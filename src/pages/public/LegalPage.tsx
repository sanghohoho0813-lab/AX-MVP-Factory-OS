/**
 * 출시 목록 L-5 이용약관 · 개인정보처리방침 화면(/terms · /privacy) — 로그인 없이 열린다.
 *  - 글은 content/legal 한 곳. 법률 검토 전(LEGAL.ready = false)에는 맨 위에 '검토 중인 초안' 띠 + 검색에 걸리지 않게(noindex).
 *  - 내부 표를 읽지 않는다(정해진 글만).
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { LEGAL, LEGAL_DOCS } from '../../content/legal'

export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const d = LEGAL_DOCS[doc]
  useEffect(() => {
    const prev = document.title
    document.title = d.title
    // 검토 전 초안은 검색에 걸리지 않게
    let meta: HTMLMetaElement | null = null
    if (!LEGAL.ready) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      meta.content = 'noindex'
      document.head.appendChild(meta)
    }
    return () => {
      document.title = prev
      meta?.remove()
    }
  }, [d.title])
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8" data-testid="legal-page" data-doc={doc} data-ready={LEGAL.ready ? '1' : '0'}>
      <article className="mx-auto flex w-full max-w-[760px] flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <header className="flex flex-col gap-3">
          <BrandLogo imgClassName="h-8 max-w-[180px]" />
          <h1 className="t-page break-keep text-slate-900">{d.title}</h1>
          {!LEGAL.ready && (
            <p role="note" className="t-sub rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 font-semibold break-keep text-danger-700" data-testid="legal-draft">
              검토 중인 초안입니다 — 법률 검토와 [대괄호] 칸이 채워진 뒤 확정됩니다.
            </p>
          )}
          <p className="t-body break-keep text-slate-700">{d.intro}</p>
        </header>
        {d.sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-1.5" data-testid="legal-section">
            <h2 className="t-section text-slate-900">{s.title}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {s.body.map((b, i) => (
                <li key={i} className="t-body break-keep text-slate-700">
                  {b}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4">
          <Link to={doc === 'terms' ? '/privacy' : '/terms'} className="tap t-sub inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline" data-testid="legal-other">
            {doc === 'terms' ? '개인정보처리방침 보기' : '이용약관 보기'}
          </Link>
          <Link to="/" className="tap t-sub inline-flex min-h-11 items-center font-semibold text-slate-600 hover:underline">
            처음으로
          </Link>
        </footer>
      </article>
    </div>
  )
}
