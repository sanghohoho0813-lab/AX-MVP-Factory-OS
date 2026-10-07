/**
 * 업체 사정 확인 (D-170) — 업체 기록에 없는 것만, 칩 한 번으로. 타이핑 없음.
 * 이미 기록(사실 창고 · 서류함 · 인증서 칸)에서 알 수 있는 것은 묻지 않는다.
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import type { CertificationClientContext, CompanySize, ResearchUnit } from '../core/types'
import type { CertProfile } from '../integration/clientContext'

type Q = {
  key: keyof CertProfile
  label: string
  /** 기록으로 이미 알면 묻지 않는다 */
  known: (c: CertificationClientContext) => boolean
  options: { label: string; value: CertProfile[keyof CertProfile] }[]
}

const YES_NO = [
  { label: '예', value: true },
  { label: '아니오', value: false },
  { label: '모름', value: null },
]

const QUESTIONS: Q[] = [
  { key: 'researchUnit', label: '연구소 · 연구개발전담부서가 있나요?', known: (c) => c.researchUnit !== null, options: [{ label: '연구소', value: 'lab' as ResearchUnit }, { label: '전담부서', value: 'dept' as ResearchUnit }, { label: '없음', value: 'none' as ResearchUnit }, { label: '모름', value: null }] },
  { key: 'researchers', label: '연구 · 개발만 하는 직원은 몇 명인가요?', known: (c) => c.researchers !== null, options: [{ label: '0명', value: 0 }, { label: '1명', value: 1 }, { label: '2명', value: 2 }, { label: '3~4명', value: 3 }, { label: '5~6명', value: 5 }, { label: '7명 이상', value: 7 }, { label: '모름', value: null }] },
  { key: 'patents', label: '특허(등록 · 출원)는 몇 건인가요?', known: (c) => c.patents !== null, options: [{ label: '없음', value: 0 }, { label: '1건', value: 1 }, { label: '2건', value: 2 }, { label: '3건 이상', value: 3 }, { label: '모름', value: null }] },
  { key: 'rndExpenseMan', label: '작년 연구개발비는요?', known: (c) => c.rndExpense !== null, options: [{ label: '없음', value: 0 }, { label: '5천만원 미만', value: 3000 }, { label: '5천만~1억', value: 7000 }, { label: '1억 이상', value: 15000 }, { label: '모름', value: null }] },
  { key: 'size', label: '기업 규모(중소기업확인서 기준)는요?', known: (c) => c.size !== null, options: [{ label: '소기업', value: 'small' as CompanySize }, { label: '중기업', value: 'medium' as CompanySize }, { label: '중견 이상', value: 'mid_large' as CompanySize }, { label: '모름', value: null }] },
  { key: 'b2b', label: '기업 · 공공에 납품하나요(B2B)?', known: (c) => c.b2b !== null, options: YES_NO },
  { key: 'procurement', label: '공공 조달 · 입찰 계획이 있나요?', known: (c) => c.procurement !== null, options: YES_NO },
  { key: 'policyFundPlan', label: '정책자금 · 보증 계획이 있나요?', known: (c) => c.policyFundPlan !== null, options: YES_NO },
  { key: 'rndPlan', label: '정부 R&D 과제 계획이 있나요?', known: (c) => c.rndPlan !== null, options: YES_NO },
  { key: 'exportPlan', label: '수출 · 해외 거래가 있나요?', known: (c) => c.exportPlan !== null, options: YES_NO },
  { key: 'exclusion', label: '체납 · 회생 · 임금체불 · 산재 공표가 최근 3년 안에 있나요?', known: () => false, options: [{ label: '없음(확인)', value: false }, { label: '있음', value: true }, { label: '모름', value: null }] },
]

export function ProfileQuestions({ ctx, profile, onChange }: { ctx: CertificationClientContext; profile: CertProfile; onChange: (patch: Partial<CertProfile>) => void }) {
  // 기록에서 이미 아는 것은 빼고, 컨설턴트가 고른 것은 남겨 고칠 수 있게
  const asked = QUESTIONS.filter((q) => profile[q.key] !== null || !q.known(ctx))
  const unanswered = asked.filter((q) => profile[q.key] === null).length
  // 처음 화면을 길게 만들지 않는다 — 닫아 두고 '몇 가지 고르면 더 정확' 만 보인다
  const [open, setOpen] = useState(false)
  if (asked.length === 0) return null
  return (
    <Surface padded={false}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tap flex w-full items-center gap-2 px-4 py-3.5 text-left sm:px-5" data-testid="cert-profile-toggle">
        <span className="t-body min-w-0 flex-1 font-semibold break-keep text-slate-900">
          업체 사정 확인 {unanswered > 0 ? <span className="text-warning-800">· {unanswered}가지를 고르면 더 정확해요</span> : <span className="text-success-700">· 다 골랐어요</span>}
        </span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:px-5" data-testid="cert-profile">
          {asked.map((q) => (
            <li key={q.key} className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold break-keep text-slate-800">{q.label}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.label}>
                {q.options.map((o) => {
                  const on = profile[q.key] === o.value
                  return (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange({ [q.key]: o.value } as Partial<CertProfile>)}
                      className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                      data-testid={`cert-q-${q.key}`}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  )
}
