/**
 * 지원사업 알림 화면 조각 (D-141) — 마감 글자 · 판정 배지 · 이유 · 공고 넣기 · 공고 창 · 업체 창.
 * 큰 글자 · 누르기 44px · 쉬운 말. 판정은 '조건 맞음 · 확인 필요' 만 말한다(선정 가능성 아님).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Check, CircleHelp, ExternalLink, Star, X } from 'lucide-react'
import { isGrantBookmark, type FundingApplication } from '../../types/clientOps'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { AiSoonButton } from '../ui/AiSoonButton'
import {
  CERT_LABEL,
  GRANT_CATEGORY_LABEL,
  GRANT_CATEGORY_ORDER,
  SIDO_LIST,
  SIZE_LABEL,
  VERDICT_LABEL,
  deadlineOf,
  normalizeRules,
  rulesText,
  type CertKey,
  type CompanySize,
  type Deadline,
  type DeadlineKind,
  type GrantCategory,
  type GrantMatch,
  type GrantNotice,
  type GrantRules,
  type Reason,
  type Verdict,
} from '../../services/grants/grantMatch'
import { parseBizinfoJson, parseNoticeText } from '../../services/grants/grantText'
import { emptyNotice, type NoticeInput } from '../../services/grants/grantView'
import { isFeedNotice } from '../../services/grants/grantFeed'
import { GRANT_SOURCE_LABEL } from '../../services/grants/grantMatch'
import { manText, type FilterVerdict, type GrantFacts } from '../../services/grants/grantFilter'
import { CATEGORY_TONE } from './grantTone'


/* ------------------------------------------------------------------ */
/* 작은 조각                                                             */
/* ------------------------------------------------------------------ */

export function DeadlineText({ d }: { d: Deadline }) {
  const strong = d.state === 'today' || d.state === 'tomorrow'
  const blue = d.urgent || d.state === 'first_come'
  return (
    <span
      data-testid="grant-deadline"
      data-state={d.state}
      className={`t-sub shrink-0 whitespace-nowrap font-semibold ${strong ? 'text-danger-700' : blue ? 'text-brand-700' : d.state === 'closed' ? 'text-slate-400' : 'text-slate-500'}`}
    >
      {d.label}
    </span>
  )
}

export function VerdictBadge({ v }: { v: Verdict }) {
  const cls =
    v === 'fit'
      ? 'border-success-200 bg-success-50 text-success-700'
      : v === 'check'
        ? 'border-warning-200 bg-warning-50 text-warning-800'
        : v === 'general'
          ? 'border-brand-200 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
  return (
    <span data-testid="grant-verdict" data-verdict={v} className={`t-meta inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-semibold whitespace-nowrap ${cls}`}>
      {VERDICT_LABEL[v]}
    </span>
  )
}

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  if (reasons.length === 0) return <p className="t-sub text-slate-500">따로 거는 조건이 없는 공고예요.</p>
  return (
    <ul className="flex flex-col gap-1" data-testid="grant-reasons">
      {reasons.map((r) => (
        <li key={r.key} className="t-sub flex items-start gap-1.5 break-keep">
          {r.state === 'ok' ? (
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" />
          ) : r.state === 'no' ? (
            <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-600" />
          ) : (
            <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
          )}
          <span className={r.state === 'unknown' ? 'text-warning-800' : r.state === 'no' ? 'text-danger-700' : 'text-slate-700'}>
            <span className="font-semibold">{r.label}</span> · {r.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Chip({ on, onClick, children, testid, onCls }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string; onCls?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-testid={testid}
      onClick={onClick}
      className={`tap t-sub shrink-0 rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${on ? (onCls ?? 'border-brand-600 bg-brand-600 text-white') : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}`}
    >
      {children}
    </button>
  )
}

const inputCls = 'w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 t-body focus:border-brand-500 focus:outline-none'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="t-meta text-slate-500">{hint}</span>}
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* 공고 적기 (붙여넣기 · 직접 · 고치기 같은 칸)                              */
/* ------------------------------------------------------------------ */


const numOrNull = (s: string) => {
  const t = s.replace(/[,\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const eokText = (m: number | null) => (m === null ? '' : String(Math.round((m / 100) * 10) / 10))
const listText = (a: string[]) => a.join(', ')
const textList = (s: string) =>
  s
    .split(/[,，、/]/)
    .map((x) => x.trim())
    .filter(Boolean)

export function NoticeForm({ value, onChange }: { value: NoticeInput; onChange: (v: NoticeInput) => void }) {
  const set = (patch: Partial<NoticeInput>) => onChange({ ...value, ...patch })
  const r = value.rules
  const setR = (patch: Partial<GrantRules>) => set({ rules: { ...r, ...patch } })
  const toggle = <T,>(arr: T[], x: T) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x])
  const [showRules, setShowRules] = useState(rulesText(r).length > 0)
  return (
    <div className="flex flex-col gap-4" data-testid="notice-form">
      <Field label="공고 이름">
        <input id="grant-title" value={value.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="2026년 ○○ 지원사업 공고" />
      </Field>
      <Field label="소관 부처 · 지자체">
        <input id="grant-agency" value={value.agency} onChange={(e) => set({ agency: e.target.value })} className={inputCls} placeholder="중소벤처기업부 · 경기도 …" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-700">갈래</span>
        <div className="flex flex-wrap gap-2">
          {GRANT_CATEGORY_ORDER.map((c) => (
            <Chip key={c} on={value.category === c} onClick={() => set({ category: c })}>
              {GRANT_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="t-sub font-semibold text-slate-700">마감</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['date', '날짜 마감'],
              ['first_come', '선착순'],
              ['always', '상시'],
            ] as [DeadlineKind, string][]
          ).map(([k, l]) => (
            <Chip key={k} on={value.deadlineKind === k} onClick={() => set({ deadlineKind: k })} testid={`grant-kind-${k}`}>
              {l}
            </Chip>
          ))}
        </div>
        {value.deadlineKind !== 'always' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="접수 시작">
              <input type="date" id="grant-start" value={value.applyStart} onChange={(e) => set({ applyStart: e.target.value })} className={inputCls} />
            </Field>
            <Field label={value.deadlineKind === 'first_come' ? '마감(있으면)' : '마감일'}>
              <input type="date" id="grant-end" value={value.applyEnd} onChange={(e) => set({ applyEnd: e.target.value })} className={inputCls} />
            </Field>
          </div>
        )}
      </div>
      <Field label="지원 내용(금액)" hint="공고에 적힌 그대로 — 예: 최대 5천만원">
        <input value={value.amountText} onChange={(e) => set({ amountText: e.target.value })} className={inputCls} />
      </Field>
      <Field label="지원 대상(공고 글 그대로)">
        <textarea value={value.target} onChange={(e) => set({ target: e.target.value })} rows={2} className={inputCls} />
      </Field>
      <Field label="공고 주소(링크)">
        <input value={value.url} onChange={(e) => set({ url: e.target.value })} className={inputCls} placeholder="https://www.bizinfo.go.kr/…" inputMode="url" />
      </Field>

      <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
        <button type="button" onClick={() => setShowRules((v) => !v)} className="tap flex w-full items-center justify-between gap-2 text-left" aria-expanded={showRules} data-testid="grant-rules-toggle">
          <span className="t-body font-semibold text-slate-800">맞출 조건</span>
          <span className="t-sub min-w-0 truncate text-slate-500">{rulesText(r).join(' · ') || '조건 없음(전국 · 누구나)'}</span>
        </button>
        {showRules && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold text-slate-700">지역(시·도) — 안 고르면 전국</span>
              <div className="flex flex-wrap gap-1.5">
                {SIDO_LIST.map((s) => (
                  <Chip key={s} on={r.regions.includes(s)} onClick={() => setR({ regions: toggle(r.regions, s) })} testid={`grant-sido-${s}`}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label="시·군·구(쉼표로)" hint="예: 파주시, 고양시 — 비우면 시·도 전체">
              <input value={listText(r.cities)} onChange={(e) => setR({ cities: textList(e.target.value) })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="창업 N년 이내">
                <input id="grant-within" inputMode="numeric" value={r.withinYears ?? ''} onChange={(e) => setR({ withinYears: numOrNull(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="업력 N년 이상">
                <input inputMode="numeric" value={r.minYears ?? ''} onChange={(e) => setR({ minYears: numOrNull(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="직원 N명 이상">
                <input inputMode="numeric" value={r.minEmployees ?? ''} onChange={(e) => setR({ minEmployees: numOrNull(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="직원 N명 이하">
                <input inputMode="numeric" value={r.maxEmployees ?? ''} onChange={(e) => setR({ maxEmployees: numOrNull(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="매출 N억 이상">
                <input inputMode="decimal" value={eokText(r.minRevenueM)} onChange={(e) => setR({ minRevenueM: numOrNull(e.target.value) === null ? null : Math.round((numOrNull(e.target.value) as number) * 100) })} className={inputCls} />
              </Field>
              <Field label="매출 N억 이하">
                <input inputMode="decimal" value={eokText(r.maxRevenueM)} onChange={(e) => setR({ maxRevenueM: numOrNull(e.target.value) === null ? null : Math.round((numOrNull(e.target.value) as number) * 100) })} className={inputCls} />
              </Field>
            </div>
            <Field label="업종(쉼표로)" hint="이 낱말이 업체 업종에 있으면 맞음 — 예: 제조, 정보통신">
              <input value={listText(r.industries)} onChange={(e) => setR({ industries: textList(e.target.value) })} className={inputCls} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold text-slate-700">규모 · 대표 · 인증</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SIZE_LABEL) as CompanySize[]).map((s) => (
                  <Chip key={s} on={r.sizes.includes(s)} onClick={() => setR({ sizes: toggle(r.sizes, s) })}>
                    {SIZE_LABEL[s]}
                  </Chip>
                ))}
                <Chip on={r.youthCeo} onClick={() => setR({ youthCeo: !r.youthCeo })} testid="grant-youth">
                  대표 만 39세 이하
                </Chip>
                <Chip on={r.womenCeo} onClick={() => setR({ womenCeo: !r.womenCeo })}>
                  여성 대표
                </Chip>
                {(Object.keys(CERT_LABEL) as CertKey[]).map((c) => (
                  <Chip key={c} on={r.certs.includes(c)} onClick={() => setR({ certs: toggle(r.certs, c) })}>
                    {CERT_LABEL[c]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {value.source !== 'example' && (
        <label className="tap flex items-start gap-2.5 rounded-(--radius-control) border border-brand-200 bg-brand-50 p-3">
          <input type="checkbox" checked={value.published} onChange={(e) => set({ published: e.target.checked })} className="mt-1 size-5 accent-brand-600" data-testid="grant-publish" />
          <span className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">가망고객 찾기 화면에도 보이기</span> — 로그인 없이 자기 회사 조건으로 찾아보는 화면입니다.
          </span>
        </label>
      )}
    </div>
  )
}


/* ------------------------------------------------------------------ */
/* 공고 넣기 창                                                          */
/* ------------------------------------------------------------------ */

type AddMode = 'paste' | 'manual' | 'file'

export function AddNoticeSheet({
  onClose,
  onSave,
  onSaveMany,
  initial,
  title = '공고 넣기',
}: {
  onClose: () => void
  onSave: (v: NoticeInput) => Promise<void>
  onSaveMany: (list: NoticeInput[]) => Promise<void>
  initial?: NoticeInput
  title?: string
}) {
  const [mode, setMode] = useState<AddMode>(initial ? 'manual' : 'paste')
  const [paste, setPaste] = useState('')
  const [draft, setDraft] = useState<NoticeInput | null>(initial ?? null)
  const [fileText, setFileText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const parsed = useMemo(() => (fileText.trim() ? parseBizinfoJson(fileText) : null), [fileText])

  const read = () => {
    const d = parseNoticeText(paste)
    if (!d.title) {
      setError('공고 이름을 찾지 못했습니다. 공고 글을 한 번 더 붙여 넣거나 직접 적어 주세요.')
      return
    }
    setError('')
    setDraft({ ...d, published: false })
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'file') {
        if (!parsed || parsed.drafts.length === 0) throw new Error('읽은 공고가 없습니다.')
        await onSaveMany(parsed.drafts.map((d) => ({ ...d, published: false })))
      } else {
        const v = draft ?? emptyNotice()
        if (!v.title.trim()) throw new Error('공고 이름을 적어 주세요.')
        await onSave({ ...v, rules: normalizeRules(v.rules) })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const showForm = mode === 'manual' || (mode === 'paste' && draft)
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        mode === 'paste' && !draft ? (
          <Button variant="primary" className="w-full" onClick={read} disabled={!paste.trim()} data-testid="grant-read">
            읽기
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void save()} disabled={busy || (mode === 'file' && !parsed?.drafts.length)} data-testid="grant-save">
            {busy ? '저장 중…' : mode === 'file' ? `${parsed?.drafts.length ?? 0}개 넣기` : '저장'}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="grant-add">
        {!initial && (
          <div role="tablist" className="flex rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                ['paste', '공고 글 붙여넣기'],
                ['manual', '직접 적기'],
                ['file', '기업마당 파일'],
              ] as [AddMode, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mode === k}
                data-testid={`grant-mode-${k}`}
                onClick={() => {
                  setMode(k)
                  setError('')
                  if (k === 'manual' && !draft) setDraft(emptyNotice())
                }}
                className={`tap t-sub flex-1 rounded-[8px] px-2 py-2 font-semibold ${mode === k ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {mode === 'paste' && !draft && (
          <>
            <AiSoonButton size="sm" label="AI로 공고 PDF 읽기" what="공고문 · 첨부 PDF를 읽어 조건 · 준비 서류 · 지원 금액을 더 정확히 채워 줍니다" className="self-start" />
            <p className="t-sub break-keep text-slate-600">기업마당 · 부처 누리집의 공고 화면을 통째로 복사해서 붙여 넣으세요. 공고명 · 신청기간 · 지원대상 · 조건을 읽어서 칸을 채웁니다. 저장 전에 한 번 보여 드려요.</p>
            <textarea id="grant-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={9} className={inputCls} placeholder={'[경기] 2026년 ○○ 지원사업 공고\n소관부처 …\n신청기간 2026.10.01 ~ 2026.10.31\n지원대상 …'} />
          </>
        )}

        {mode === 'paste' && draft && (
          <p className="t-sub rounded-(--radius-control) border border-success-200 bg-success-50 px-3 py-2 text-success-800" data-testid="grant-read-done">
            읽었습니다. 틀린 칸만 고치고 저장하세요.
          </p>
        )}

        {showForm && draft && <NoticeForm value={draft} onChange={setDraft} />}

        {mode === 'file' && (
          <>
            <p className="t-sub break-keep text-slate-600">기업마당 지원사업 API 로 받은 JSON 파일을 고르거나 내용을 붙여 넣으세요. 이미 있는 공고(이름 · 마감이 같음)는 건너뜁니다.</p>
            <input
              type="file"
              accept=".json,application/json,text/plain"
              data-testid="grant-file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void f.text().then(setFileText)
              }}
              className="t-sub"
            />
            <textarea value={fileText} onChange={(e) => setFileText(e.target.value)} rows={5} className={inputCls} placeholder='{"jsonArray":[{"pblancNm":"…"}]}' />
            {parsed && (
              <p className="t-sub text-slate-700" data-testid="grant-file-count">
                공고 {parsed.drafts.length}개를 읽었습니다{parsed.skipped ? ` · 공고명이 없어 ${parsed.skipped}줄 건너뜀` : ''}.
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 공고 한 줄                                                            */
/* ------------------------------------------------------------------ */

export function NoticeRow({ notice, today, extra, onOpen, facts, verdict }: { notice: GrantNotice; today: string; extra?: ReactNode; onOpen: () => void; facts?: GrantFacts; verdict?: FilterVerdict }) {
  const d = deadlineOf(notice, today)
  const tone = CATEGORY_TONE[notice.category] ?? CATEGORY_TONE.etc
  const filtered = verdict && !verdict.pass
  return (
    <li className={filtered ? 'bg-slate-50/80' : ''}>
      <button
        type="button"
        onClick={onOpen}
        data-testid="grant-row"
        data-id={notice.id}
        data-filtered={filtered ? verdict?.stage : undefined}
        className={`tap relative flex w-full items-start gap-3 px-4 py-3.5 text-left before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r hover:bg-slate-50 sm:px-5 ${filtered ? 'before:bg-slate-200' : tone.bar}`}
      >
        <span className={`flex min-w-0 flex-1 flex-col gap-1 ${filtered ? 'opacity-70' : ''}`}>
          <span className="t-body line-clamp-2 break-keep font-semibold text-slate-900">{notice.title}</span>
          {(facts || filtered) && (
            <span className="flex flex-wrap items-center gap-1.5" data-testid="grant-facts">
              <span className={`t-meta rounded-full border px-2 py-0.5 font-semibold whitespace-nowrap ${tone.pill}`}>{GRANT_CATEGORY_LABEL[notice.category]}</span>
              {facts?.amount.man != null && (
                <span className="t-meta rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold whitespace-nowrap text-amber-900" data-testid="grant-amount">
                  {facts.amount.text && facts.amount.text.length <= 18 ? facts.amount.text : `최대 ${manText(facts.amount.man)}`}
                </span>
              )}
              {facts?.slots != null && (
                <span className="t-meta rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold whitespace-nowrap text-violet-800" data-testid="grant-slots">
                  선정 {facts.slots.toLocaleString()}곳
                </span>
              )}
              {filtered && (
                <span className="t-meta rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold whitespace-nowrap text-slate-600" data-testid="grant-filtered-why">
                  {verdict?.stage}차에서 거름 · {verdict?.why}
                </span>
              )}
            </span>
          )}
          <span className="t-sub flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
            <span className="break-keep">{notice.agency || '소관 미기재'}</span>
            {notice.source === 'example' && <span className="t-meta rounded border border-slate-300 px-1.5 font-semibold text-slate-500">{GRANT_SOURCE_LABEL.example}</span>}
            {isFeedNotice(notice) ? (
              <span className="t-meta rounded border border-slate-200 px-1.5 font-semibold text-slate-500">기업마당</span>
            ) : (
              notice.published && <span className="t-meta rounded border border-brand-200 bg-brand-50 px-1.5 font-semibold text-brand-700">공개</span>
            )}
          </span>
          {extra}
        </span>
        <DeadlineText d={d} />
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 맞는 공고 목록 (업체 하나)                                              */
/* ------------------------------------------------------------------ */

/** D-156: 공고 하나를 '도전해 볼 만함' 으로 체크 · 풀기. 체크한 것만 마감이 일정 · 오늘에 뜬다 */
export interface ChallengeControl {
  of: (noticeId: string) => FundingApplication | null
  toggle: (m: Pick<GrantMatch, 'notice'>) => void
  busy?: boolean
}

export function ChallengeButton({ app, onToggle, busy, closed }: { app: FundingApplication | null; onToggle: () => void; busy?: boolean; closed?: boolean }) {
  // 체크한 공고(지켜보는 중 · 공고에서 만듦 · 서류 목록 없음)만 풀 수 있다. 신청 준비 · 손으로 적은 같은 이름 건은 글자로만 (D-157)
  if (app && !isGrantBookmark(app)) {
    return (
      <span className="t-sub inline-flex min-h-10 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 font-semibold text-brand-800" data-testid="challenge-state">
        {app.status === 'watching' ? (app.docs ? '신청 준비 중' : '신청 건 있음') : app.status === 'preparing' ? '신청 준비 중' : '신청 진행 중'}
      </span>
    )
  }
  if (!app && closed) return null
  const on = app !== null
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={on}
      data-testid="challenge-toggle"
      className={`tap t-sub inline-flex h-10 items-center gap-1.5 rounded-full border px-3 font-semibold disabled:opacity-50 ${
        on ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Star aria-hidden="true" className={`size-4 ${on ? 'fill-amber-400 text-amber-500' : ''}`} />
      {on ? `도전 체크됨${app?.applyDueDate ? ` · 마감 ${Number(app.applyDueDate.slice(5, 7))}/${Number(app.applyDueDate.slice(8, 10))}` : ''}` : '도전해 볼 만함'}
    </button>
  )
}

export function MatchList({ matches, sentOf, onPick, challenge }: { matches: GrantMatch[]; sentOf?: (noticeId: string) => string; onPick?: (m: GrantMatch) => void; challenge?: ChallengeControl }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white" data-testid="grant-match-list">
      {matches.map((m) => {
        const sent = sentOf?.(m.notice.id) ?? ''
        return (
          <li key={m.notice.id} className="flex flex-col gap-1.5 px-3 py-3" data-testid="grant-match" data-verdict={m.verdict}>
            <div className="flex items-start gap-2">
              {onPick ? (
                <button type="button" onClick={() => onPick(m)} className="tap t-body min-w-0 flex-1 break-keep text-left font-semibold text-slate-900 hover:text-brand-700">
                  {m.notice.title}
                </button>
              ) : (
                <span className="t-body min-w-0 flex-1 break-keep font-semibold text-slate-900">{m.notice.title}</span>
              )}
              <DeadlineText d={m.deadline} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge v={m.verdict} />
              {m.notice.amountText && <span className="t-sub text-slate-600">{m.notice.amountText}</span>}
              {sent && <span className="t-meta text-slate-500">알림 보냄 {Number(sent.slice(5, 7))}/{Number(sent.slice(8, 10))}</span>}
              {challenge && <ChallengeButton app={challenge.of(m.notice.id)} onToggle={() => challenge.toggle(m)} busy={challenge.busy} closed={m.deadline.state === 'closed'} />}
            </div>
            {m.verdict === 'check' && (
              <p className="t-sub break-keep text-warning-800">
                확인할 것: {m.reasons.filter((r) => r.state === 'unknown').map((r) => r.label).join(' · ')}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function NoticeLink({ url }: { url: string }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
      공고 원문 보기 <ExternalLink aria-hidden="true" className="size-4" />
    </a>
  )
}

export function CategoryChips({ value, counts, onChange }: { value: GrantCategory | 'all'; counts: Record<string, number>; onChange: (v: GrantCategory | 'all') => void }) {
  const keys: (GrantCategory | 'all')[] = ['all', ...GRANT_CATEGORY_ORDER]
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" data-testid="grant-categories">
      {keys
        .filter((k) => k === 'all' || (counts[k] ?? 0) > 0)
        .map((k) => (
          <Chip key={k} on={value === k} onClick={() => onChange(k)} testid={`grant-cat-${k}`} onCls={k === 'all' ? undefined : CATEGORY_TONE[k].on}>
            {k !== 'all' && value !== k && <span aria-hidden="true" className={`mr-1.5 inline-block size-2 rounded-full align-middle ${CATEGORY_TONE[k].dot}`} />}
            {k === 'all' ? '전체' : GRANT_CATEGORY_LABEL[k]}
            {k !== 'all' && <span className="ml-1 opacity-75">{counts[k]}</span>}
          </Chip>
        ))}
    </div>
  )
}
