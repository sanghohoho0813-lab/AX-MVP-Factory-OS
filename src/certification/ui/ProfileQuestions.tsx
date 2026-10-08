/**
 * 업체 사정 확인 (D-170 → AX) — 기록에 없는 것만 묻는다. 타이핑은 업종코드 · 정확한 연구개발비 둘뿐.
 *
 * AX: 한 번에 다 펼치지 않는다 — 판정에 가장 큰 영향을 주는 것부터 한 번에 하나씩(1/3 · 2/3 · 3/3),
 *     나머지는 [더 확인할 정보 N개] 안에. 순서는 도메인 우선순위(신청 자격 → 연구조직 · 연구개발 → 특허 → 업종 → 계획)이고,
 *     지금 1순위 · 확인 필요 인증에 걸린 질문을 앞으로 당긴다(새 점수 체계 아님).
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import type { CertificationAssessment, CertificationClientContext, CertificationKey, CompanySize, ResearchUnit, RndRange } from '../core/types'
import type { CertProfile } from '../integration/clientContext'
import { rndNeedsExact } from '../core/rnd'

type ChipQ = {
  kind: 'chips'
  key: keyof CertProfile
  label: string
  /** 기록으로 이미 알면 묻지 않는다 */
  known: (c: CertificationClientContext) => boolean
  options: { label: string; value: CertProfile[keyof CertProfile] }[]
  /** 이 답이 판정을 바꾸는 인증 */
  certs: CertificationKey[]
}
type InputQ = {
  kind: 'input'
  key: 'ksic' | 'rndExactMan'
  label: string
  hint: string
  placeholder: string
  known: (c: CertificationClientContext) => boolean
  /** 물을 때만(예: 범위가 5천만원 이상일 때 정확한 금액) */
  when?: (c: CertificationClientContext) => boolean
  certs: CertificationKey[]
}
export type ProfileQ = ChipQ | InputQ

const YES_NO = [
  { label: '예', value: true },
  { label: '아니오', value: false },
  { label: '모름', value: null },
]

/** 도메인 우선순위 순 — 신청 자격(중소기업) → 연구조직 · 연구개발 → 특허 → 제외 사유 → 인력 → 업종 → 계획 */
export const PROFILE_QUESTIONS: ProfileQ[] = [
  { kind: 'chips', key: 'size', label: '중소기업확인서가 있나요? 있으면 규모는요?', known: (c) => c.size !== null || c.smeDoc === true, certs: ['innobiz', 'mainbiz', 'lab'], options: [{ label: '소기업', value: 'small' as CompanySize }, { label: '중기업', value: 'medium' as CompanySize }, { label: '중견 이상', value: 'mid_large' as CompanySize }, { label: '확인서 없음 · 모름', value: null }] },
  { kind: 'chips', key: 'researchUnit', label: '연구소 · 연구개발전담부서가 있나요?', known: (c) => c.researchUnit !== null, certs: ['lab', 'venture', 'innobiz'], options: [{ label: '연구소', value: 'lab' as ResearchUnit }, { label: '전담부서', value: 'dept' as ResearchUnit }, { label: '없음', value: 'none' as ResearchUnit }, { label: '모름', value: null }] },
  { kind: 'chips', key: 'rndRange', label: '작년 연구개발비는 어느 정도인가요?', known: (c) => c.rndExpense !== null || (c.rndRange != null && c.rndRange !== 'unknown'), certs: ['venture', 'innobiz', 'lab'], options: [{ label: '없음', value: 'none' as RndRange }, { label: '5천만원 미만', value: 'under_50m' as RndRange }, { label: '5천만~1억원', value: '50m_100m' as RndRange }, { label: '1억원 이상', value: 'over_100m' as RndRange }, { label: '모름', value: 'unknown' as RndRange }] },
  { kind: 'input', key: 'rndExactMan', label: '정확한 연구개발비는요?(작년 · 만원)', hint: '벤처 연구개발유형은 정확한 금액으로만 판단합니다 — 재무제표의 연구개발비 · 연구 인력 인건비', placeholder: '예: 6200', known: (c) => c.rndExpense !== null, when: rndNeedsExact, certs: ['venture'] },
  { kind: 'chips', key: 'patents', label: '특허(등록 · 출원)는 몇 건인가요?', known: (c) => c.patents !== null, certs: ['innobiz', 'venture'], options: [{ label: '없음', value: 0 }, { label: '1건', value: 1 }, { label: '2건', value: 2 }, { label: '3건 이상', value: 3 }, { label: '모름', value: null }] },
  { kind: 'chips', key: 'exclusion', label: '신청 제외 사유가 있나요?(체납 · 어음 거래정지 · 파산 · 회생, 최근 3년 체불사업주 명단 공개 · 산재 공표 · 공정거래 시정명령 · 보조금 참여제한)', known: () => false, certs: ['innobiz', 'mainbiz'], options: [{ label: '없음(확인)', value: false }, { label: '있음', value: true }, { label: '모름', value: null }] },
  { kind: 'chips', key: 'researchers', label: '연구 · 개발만 하는 직원은 몇 명인가요?', known: (c) => c.researchers !== null, certs: ['lab'], options: [{ label: '0명', value: 0 }, { label: '1명', value: 1 }, { label: '2명', value: 2 }, { label: '3~4명', value: 3 }, { label: '5~6명', value: 5 }, { label: '7명 이상', value: 7 }, { label: '모름', value: null }] },
  { kind: 'input', key: 'ksic', label: '업종코드(KSIC)를 알면 적어 주세요', hint: '사업자등록증 · 중소기업확인서의 산업분류 코드(숫자 5자리). 제외 업종 · 벤처 연구개발 비율이 이 코드로 정해집니다', placeholder: '예: 29199', known: (c) => !!c.ksic, certs: ['innobiz', 'mainbiz', 'venture'] },
  { kind: 'chips', key: 'rndPlan', label: '정부 R&D 과제 계획이 있나요?', known: (c) => c.rndPlan !== null, certs: ['venture', 'innobiz', 'lab'], options: YES_NO },
  { kind: 'chips', key: 'policyFundPlan', label: '정책자금 · 보증 계획이 있나요?', known: (c) => c.policyFundPlan !== null, certs: ['innobiz', 'mainbiz', 'venture'], options: YES_NO },
  { kind: 'chips', key: 'b2b', label: '기업 · 공공에 납품하나요(B2B)?', known: (c) => c.b2b !== null, certs: ['iso9001'], options: YES_NO },
  { kind: 'chips', key: 'procurement', label: '공공 조달 · 입찰 계획이 있나요?', known: (c) => c.procurement !== null, certs: ['iso9001', 'mainbiz'], options: YES_NO },
  { kind: 'chips', key: 'exportPlan', label: '수출 · 해외 거래가 있나요?', known: (c) => c.exportPlan !== null, certs: ['iso9001', 'iso14001'], options: YES_NO },
]

const answered = (q: ProfileQ, p: CertProfile) => p[q.key] !== null

/** 물어볼 것(기록으로 아는 것 · 조건 안 맞는 것 빼고) — 1순위 · 확인 필요 인증에 걸린 것을 앞으로 */
export function questionsFor(ctx: CertificationClientContext, profile: CertProfile, focus: readonly CertificationKey[] = []): ProfileQ[] {
  const asked = PROFILE_QUESTIONS.filter((q) => (q.kind === 'input' && q.when ? q.when(ctx) || answered(q, profile) : true) && (answered(q, profile) || !q.known(ctx)))
  const hit = (q: ProfileQ) => (q.certs.some((k) => focus.includes(k)) ? 0 : 1)
  return asked.map((q, i) => ({ q, i })).sort((a, b) => hit(a.q) - hit(b.q) || a.i - b.i).map((x) => x.q)
}

/** 아직 답하지 않은 것 */
export function openQuestions(qs: readonly ProfileQ[], profile: CertProfile): ProfileQ[] {
  return qs.filter((q) => !answered(q, profile))
}

/** 1순위 · 확인 필요 인증 — 질문 순서를 당길 기준 */
export function focusOf(list: readonly CertificationAssessment[], top: CertificationKey | null): CertificationKey[] {
  return [...(top ? [top] : []), ...list.filter((a) => a.recommendation === 'need_info').map((a) => a.key)]
}

function ChipRow({ q, profile, onPick }: { q: ChipQ; profile: CertProfile; onPick: (v: CertProfile[keyof CertProfile]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.label}>
      {q.options.map((o) => {
        const on = profile[q.key] === o.value && o.value !== null
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.value)}
            className={`tap t-sub min-h-11 rounded-full border px-3.5 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
            data-testid={`cert-q-${q.key}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function InputRow({ q, profile, onSave }: { q: InputQ; profile: CertProfile; onSave: (v: string | number | null) => void }) {
  const cur = profile[q.key]
  const [v, setV] = useState(cur === null ? '' : String(cur))
  const clean = v.replace(/[^\d]/g, '')
  const ok = q.key === 'ksic' ? /^\d{2,5}$/.test(clean) : clean.length > 0 && clean.length <= 9
  return (
    <div className="flex flex-col gap-1.5">
      <span className="t-sub break-keep text-slate-600">{q.hint}</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={q.placeholder}
          aria-label={q.label}
          className="tap t-body min-h-11 w-40 rounded-(--radius-control) border border-slate-300 bg-white px-3 focus:border-brand-500 focus:outline-none"
          data-testid={`cert-input-${q.key}`}
        />
        <Button variant="secondary" disabled={!ok} onClick={() => onSave(q.key === 'ksic' ? clean : Number(clean))} data-testid={`cert-input-save-${q.key}`}>
          저장
        </Button>
        {cur !== null && (
          <button
            type="button"
            className="tap t-sub min-h-11 px-2 font-semibold text-slate-500 hover:text-slate-800"
            onClick={() => {
              setV('')
              onSave(null)
            }}
          >
            지우기
          </button>
        )}
      </div>
    </div>
  )
}

function QuestionBody({ q, profile, onChange, after }: { q: ProfileQ; profile: CertProfile; onChange: (patch: Partial<CertProfile>) => void; after?: () => void }) {
  return q.kind === 'chips' ? (
    <ChipRow
      q={q}
      profile={profile}
      onPick={(value) => {
        onChange({ [q.key]: value } as Partial<CertProfile>)
        after?.()
      }}
    />
  ) : (
    <InputRow
      q={q}
      profile={profile}
      onSave={(value) => {
        onChange({ [q.key]: value } as Partial<CertProfile>)
        after?.()
      }}
    />
  )
}

/**
 * 한 번에 하나씩 — 1/3 · 2/3 · 3/3. 고르면 다음 질문으로(모름 · 건너뛰기도 넘어간다). 다 끝나면 onDone.
 * 고른 값은 바로 저장되고 판정이 바로 바뀐다.
 */
export function QuestionStepper({ qs, profile, onChange, onDone }: { qs: ProfileQ[]; profile: CertProfile; onChange: (patch: Partial<CertProfile>) => void; onDone?: () => void }) {
  // 처음 연 순간의 질문 3개로 고정 — 답하면 목록이 줄어도 순서가 흔들리지 않게
  const [fixed] = useState(() => openQuestions(qs, profile).slice(0, 3))
  const [i, setI] = useState(0)
  if (fixed.length === 0) return null
  if (i >= fixed.length)
    return (
      <p className="t-sub break-keep text-success-700" role="status" data-testid="cert-stepper-done">
        ✓ {fixed.length}가지를 확인했습니다 — 판정을 다시 했습니다.
      </p>
    )
  const q = fixed[i]
  const next = () => {
    if (i + 1 >= fixed.length) {
      setI(fixed.length)
      onDone?.()
    } else setI(i + 1)
  }
  return (
    <div className="flex flex-col gap-2.5" data-testid="cert-stepper">
      <div className="flex items-center justify-between gap-2">
        <span className="t-sub font-semibold text-brand-700" data-testid="cert-stepper-count">
          {i + 1}/{fixed.length}
        </span>
        <button type="button" onClick={next} className="tap t-sub min-h-11 px-2 font-semibold text-slate-500 hover:text-slate-800" data-testid="cert-stepper-skip">
          건너뛰기
        </button>
      </div>
      <p className="t-body font-semibold break-keep text-slate-900" data-testid="cert-stepper-q">
        {q.label}
      </p>
      <QuestionBody key={q.key} q={q} profile={profile} onChange={onChange} after={next} />
    </div>
  )
}

/** [더 확인할 정보 N개] — 나머지 질문 전부(고른 것도 고칠 수 있게) + 회사 정보에 확인된 사실로 저장 */
export function MoreQuestions({
  qs,
  profile,
  onChange,
  pendingFacts,
  onConfirmFacts,
}: {
  qs: ProfileQ[]
  profile: CertProfile
  onChange: (patch: Partial<CertProfile>) => void
  /** P1: 칩으로 고른 것 중 회사 정보(사실 창고)에 확인된 값으로 넣을 수 있는 것 */
  pendingFacts: { label: string; value: string }[]
  onConfirmFacts: () => Promise<number>
}) {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const unanswered = openQuestions(qs, profile).length
  if (qs.length === 0) return null
  return (
    <div className="flex flex-col" data-testid="cert-profile-more">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-brand-700" data-testid="cert-profile-toggle">
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        {unanswered > 0 ? `더 확인할 정보 ${unanswered}개` : '고른 정보 고치기'}
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-3 border-t border-slate-100 pt-3" data-testid="cert-profile">
          {qs.map((q) => (
            <li key={q.key} className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold break-keep text-slate-800">{q.label}</span>
              <QuestionBody q={q} profile={profile} onChange={onChange} />
            </li>
          ))}
          {/* P1: 칩은 기업인증 판정에만 쓴다 — 회사 정보(다른 모듈이 읽는 사실)로는 대표가 눌렀을 때만 '확인됨' 으로 */}
          {pendingFacts.length > 0 && (
            <li className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" data-testid="cert-facts-confirm">
              <span className="t-sub break-keep text-slate-700">
                고른 값({pendingFacts.map((f) => `${f.label} ${f.value}`).join(' · ')})은 아직 기업인증에서만 씁니다. 대표님께 확인했으면 회사 정보에 넣어 다른 모듈도 같이 쓰게 하세요.
              </span>
              <Button
                variant="secondary"
                className="self-start"
                disabled={saving}
                onClick={() => {
                  setSaving(true)
                  void onConfirmFacts()
                    .then((n) => showToast(n ? `회사 정보에 확인된 사실 ${n}개를 저장했습니다` : '바뀐 것이 없습니다'))
                    .catch(() => showToast('저장하지 못했습니다 — 다시 눌러 주세요'))
                    .finally(() => setSaving(false))
                }}
                data-testid="cert-facts-save"
              >
                {saving ? '저장 중…' : '회사 정보에 확인된 사실로 저장'}
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
