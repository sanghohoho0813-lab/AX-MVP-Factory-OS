/**
 * 영업 관리 › 미팅 준비 (D-114 2단계 · D-121 다시 짬).
 *
 * D-121 대표 지시 — "스크롤이 너무 길고 쓸데없는 게 많다. 정말 필요한 것만."
 *  - 맨 위 한 장: 업체 · 단계 · 점수 · 다음 약속. 영업 흐름은 한 줄로 접어 둔다.
 *  - 1차 미팅 준비 = 크레탑 분석기 그대로(단독 판매 부품 CretopWorkbench). 분석하면 이 업체에 바로 반영.
 *    엔진 대본(오프닝 · 질문 · 자료 · 전략 TOP3)은 그 아래 '영업 대본' 으로 접는다.
 *  - 2차 · 3차는 운영 OS 흐름: 크레탑 전략에서 이어서 물을 것 → 핵심 대본 → 제안 · 계약. 나머지는 '더 보기'.
 *  - 카톡 문구는 한 묶음으로 접는다. 글은 지우지 않았다.
 *
 * 기업컨설팅 OS 의 '미팅 준비' · '고객 카드 분석' · '녹취/메모 분석' 을 고객 관리 한 장부 위로 옮겼다.
 *  - 고객을 고르면: 리드 점수 · 등급 · 전략 TOP3 · 미팅 테마, 그리고 첫 연락 · 1차 · 2차 · 3차 대본(원본 문구 그대로).
 *  - 고객 정보(대표 나이 · 매출 · 체크 17 · 메모)를 고치면 점수 · 대본이 바로 바뀐다. 메모 글로 빈 칸을 채울 수 있다.
 *  - 미팅 뒤 적은 메모를 규칙으로 나눠(반응 · 주제 · 망설임 · 다음 자료) 기록하고, 단계 · 다음 할 일을 한 번에 옮긴다.
 * 모두 규칙 계산이다(LLM 호출 없음). 'AX 1차 미팅 체크리스트'(/sales/first-meeting) 자리와는 따로다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, FileText, NotebookPen, Presentation, ScanSearch } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useToast } from '../../components/ui/toastContext'
import { Badge, Disclosure, ScreenTitle, type Tone } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { rampAt } from '../../components/sales/salesColor'
import { CopyButton, NumberedList, PillList, ScriptBlock, StageBadge } from '../../components/sales/salesParts'
import { SalesJourneyCard } from '../../components/sales/SalesJourneyCard'
import { CretopFollowUp } from '../../components/sales/CretopFollowUp'
import { NextStepEditor } from '../../components/ops/NextStepEditor'
import { CretopWorkbench } from '../../tools/cretop/CretopWorkbench'
import { ToolClientScope } from '../../tools/shared/toolClientContext'
import type { CretopMiniUi } from '../../tools/cretop/mini/MiniApp.jsx'
import { registerFromCretop } from '../../services/salesIntake'
import { companyKey } from '../../services/salesCretop'
import { withSalesPath } from '../../services/salesJourney'
import { listClients, saveClient } from '../../services/clientOpsService'
import { salesStageOf, withSalesStage } from '../../services/salesPipeline'
import {
  missingDocSlots,
  profileFromMemo,
  roundForStage,
  stageAfterMeeting,
  toEngineItem,
  withDocSlots,
  withMeetingNote,
  withSalesProfile,
} from '../../services/salesMeeting'
import {
  CUST_FLAGS,
  CUST_SECTIONS,
  MEETING_THEMES,
  analyzeTranscript,
  buildLeadPlan,
  buildMeetingPlan,
  detectTheme,
  followUpKakao,
  recommendedStrategiesFor,
  scoreLead,
  scoreTier,
  type ScoreTierKey,
  type TranscriptAnalysis,
} from '../../services/salesEngine'
import { todayLocalDate, localDateOf } from '../../lib/appClock'
import { SALES_STAGE_LABEL, SALES_STAGE_ORDER, type ClientOpsRecord, type SalesStage } from '../../types/clientOps'

type Round = 0 | 1 | 2 | 3
const ROUNDS: { key: Round; label: string }[] = [
  { key: 0, label: '첫 연락' },
  { key: 1, label: '1차 미팅' },
  { key: 2, label: '2차 미팅' },
  { key: 3, label: '3차 클로징' },
]

/** 등급 색 — 테마색 하나 · 경고 · 회색만 (원본의 초록 · 금색 · 주황 · 파랑 대신) */
const TIER_TONE: Record<ScoreTierKey, Tone> = { high: 'success', chase: 'brand', nurture: 'warning', long: 'neutral', low: 'neutral' }

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ------------------------------------------------------------------ */
/* 고객 정보 (점수 · 대본 재료)                                          */
/* ------------------------------------------------------------------ */

function ProfileEditor({ record, onSave }: { record: ClientOpsRecord; onSave: (next: ClientOpsRecord, msg: string) => void }) {
  const s = record.sales
  const init = useMemo(
    () => ({
      ceoAge: s?.ceoAge ? String(s.ceoAge) : '',
      revenueEok: s?.revenueM ? String(Math.round(s.revenueM) / 100) : '',
      flags: { ...(s?.flags ?? {}) } as Record<string, boolean>,
      memo: s?.memo ?? '',
    }),
    [s],
  )
  const [d, setD] = useState(init)
  // D-120: 값으로 비교 — 다른 저장(단계 · 계약 경로 …)에 적던 칸이 지워지지 않게
  const initKey = JSON.stringify(init)
  const [seen, setSeen] = useState(initKey)
  if (seen !== initKey) {
    setSeen(initKey)
    setD(init)
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(init)
  const onCount = Object.values(d.flags).filter(Boolean).length

  const save = () => {
    const age = parseInt(d.ceoAge, 10)
    const eok = parseFloat(d.revenueEok)
    onSave(
      withSalesProfile(record, {
        ceoAge: Number.isFinite(age) && age > 0 ? age : null,
        revenueM: Number.isFinite(eok) && eok > 0 ? Math.round(eok * 100) : null,
        flags: d.flags,
        memo: d.memo,
      }),
      '고객 정보를 저장했습니다. 점수 · 대본이 새 값으로 바뀌었습니다.',
    )
  }
  const fillFromMemo = () => {
    const { patch, filled } = profileFromMemo({ ...record, sales: record.sales ? { ...record.sales, ceoAge: d.ceoAge ? parseInt(d.ceoAge, 10) : null, revenueM: d.revenueEok ? Math.round(parseFloat(d.revenueEok) * 100) : null, flags: d.flags } : record.sales }, d.memo)
    if (filled.length === 0) {
      onSave(record, '메모에서 새로 채울 값을 찾지 못했습니다.')
      return
    }
    setD((prev) => ({
      ...prev,
      ceoAge: patch.ceoAge ? String(patch.ceoAge) : prev.ceoAge,
      revenueEok: patch.revenueM ? String(Math.round(patch.revenueM) / 100) : prev.revenueEok,
      flags: patch.flags ? { ...prev.flags, ...patch.flags } : prev.flags,
    }))
    onSave(record, `메모에서 채웠습니다 — ${filled.join(' · ')}. 확인하고 저장하세요.`)
  }

  return (
    <Disclosure title="고객 정보 — 점수 · 대본 재료" hint={`대표 ${d.ceoAge || '?'}세 · 매출 ${d.revenueEok ? `${d.revenueEok}억` : '?'} · 체크 ${onCount}개`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block text-[0.85rem] text-slate-500">
            대표 나이
            <input value={d.ceoAge} inputMode="numeric" onChange={(e) => setD({ ...d, ceoAge: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
          <label className="block text-[0.85rem] text-slate-500">
            매출 (억원)
            <input value={d.revenueEok} inputMode="decimal" onChange={(e) => setD({ ...d, revenueEok: e.target.value.replace(/[^0-9.]/g, '') })} className={inputClass} />
          </label>
          <p className="t-meta col-span-2 self-end pb-2 break-keep text-slate-500">
            직원 수 · 설립일 · 업종은 고객 관리 기본 정보에서 읽습니다.
          </p>
        </div>
        {CUST_SECTIONS.map((sec) => (
          <fieldset key={sec}>
            <legend className="t-sub font-semibold text-slate-700">{sec}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CUST_FLAGS.filter((f) => f[2] === sec).map(([key, label]) => {
                const on = !!d.flags[key]
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, flags: { ...d.flags, [key]: !on } })}
                    className={`tap t-meta rounded-full border px-2.5 py-1 font-medium ${on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        <label className="block text-[0.85rem] text-slate-500">
          상담 메모
          <textarea
            value={d.memo}
            rows={3}
            onChange={(e) => setD({ ...d, memo: e.target.value })}
            placeholder="예) 제조업 매출 35억 직원 26명 대표 58세, 자녀 근무, 가지급금 있음"
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={fillFromMemo} disabled={d.memo.trim() === ''}>
            메모로 빈 칸 채우기
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
            고객 정보 저장
          </Button>
        </div>
      </div>
    </Disclosure>
  )
}

/* ------------------------------------------------------------------ */
/* 미팅 기록                                                             */
/* ------------------------------------------------------------------ */

/**
 * 적던 미팅 메모 — 차수 · 고객을 바꾸거나 새로고침해도 이 탭에 남는다(D-120). 저장되면 지운다.
 * sessionStorage 라 이 브라우저 탭 안에서만 산다(다른 사람 · 다른 기기로 가지 않는다).
 */
const draftKey = (id: string, round: number) => `axmvp.meetingDraft.${id}.${round}`
function readDraft(id: string, round: number): string {
  try {
    return sessionStorage.getItem(draftKey(id, round)) ?? ''
  } catch {
    return ''
  }
}
function writeDraft(id: string, round: number, text: string) {
  try {
    if (text.trim() === '') sessionStorage.removeItem(draftKey(id, round))
    else sessionStorage.setItem(draftKey(id, round), text)
  } catch {
    /* 저장 공간이 없어도 화면은 돈다 */
  }
}

/** 미팅에서 받기로 한 자료 → 보낼 카톡 한 덩어리 */
function docRequestText(record: ClientOpsRecord, docs: string[]): string {
  const who = record.representativeName || record.contactName || record.companyName
  return [
    `${who} 대표님, 오늘 시간 내 주셔서 감사합니다.`,
    '말씀 나눈 내용을 정확히 검토하려고, 편하실 때 아래 자료를 부탁드립니다.',
    '',
    ...docs.map((d, i) => `${i + 1}. ${d}`),
    '',
    '사진이나 파일 어느 쪽이든 괜찮습니다. 받는 대로 정리해서 다음 미팅 때 말씀드리겠습니다.',
  ].join('\n')
}

function MeetingRecorder({ record, round, today, onSave }: { record: ClientOpsRecord; round: 1 | 2 | 3; today: string; onSave: (next: ClientOpsRecord, msg: string) => Promise<boolean> }) {
  const stage = salesStageOf(record)
  const target = stageAfterMeeting(round)
  const canMove = SALES_STAGE_ORDER.indexOf(target) > SALES_STAGE_ORDER.indexOf(stage) && stage !== 'contracted' && stage !== 'hold' && stage !== 'lost'
  const [text, setTextState] = useState(() => readDraft(record.id, round))
  const setText = (v: string) => {
    setTextState(v)
    writeDraft(record.id, round, v)
  }
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<TranscriptAnalysis | null>(null)
  const [move, setMove] = useState(true)
  const [next, setNext] = useState('')
  const [due, setDue] = useState(addDays(today, 3))

  /** D-122: 받기로 한 자료 가운데 서류함에 칸을 만들 것(기본 전부) */
  const [slots, setSlots] = useState<string[]>([])
  const analyze = () => {
    const a = analyzeTranscript(text)
    setResult(a)
    setSlots(missingDocSlots(record, a.nextDocs))
    const docs = a.nextDocs.slice(0, 3).join(' · ')
    setNext(round === 3 ? '계약 조건 회신 확인' : `${round + 1}차 미팅 준비${docs ? ` — 자료 받기: ${docs}` : ''}`)
  }
  const save = async () => {
    if (!result || saving) return
    let rec = withMeetingNote(record, { round, text, analysis: result, nextAction: next, nextActionDueDate: due })
    if (slots.length > 0) rec = withDocSlots(rec, slots)
    if (canMove && move) rec = withSalesStage(rec, target)
    setSaving(true)
    const ok = await onSave(rec, `${round}차 미팅을 기록했습니다${canMove && move ? ` · ${SALES_STAGE_LABEL[target]}로 옮김` : ''}${slots.length > 0 ? ` · 서류함에 칸 ${slots.length}개` : ''}.`)
    setSaving(false)
    // D-120: 저장이 된 뒤에만 비운다 — 실패하면 적은 메모가 그대로 남는다
    if (ok) {
      writeDraft(record.id, round, '')
      setTextState('')
      setResult(null)
    }
  }

  return (
    <section aria-label="미팅 기록" data-testid="meeting-recorder" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="t-section flex items-center gap-2 text-slate-900">
        <NotebookPen aria-hidden="true" className="size-5 text-brand-600" />
        {round}차 미팅 기록
      </h2>
      <label className="block text-[0.85rem] text-slate-500">
        미팅에서 나온 말 · 메모
        <textarea
          value={text}
          rows={4}
          onChange={(e) => { setText(e.target.value); setResult(null) }}
          placeholder="예) 가지급금 정리는 관심 있는데 비용이 부담된다. 세무사랑 상의해 보겠다. 자녀 1명 근무 중."
          className={inputClass}
        />
      </label>
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={analyze} disabled={text.trim() === ''}>
          메모 나눠 보기
        </Button>
      </div>
      {result && (
        <div data-testid="meeting-analysis" className="flex flex-col gap-3 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3.5">
          <p className="t-body break-keep text-slate-800">{result.summary}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="t-meta font-semibold text-slate-500">반응</dt>
              <dd className="t-sub font-semibold text-slate-800">{result.reaction}</dd>
            </div>
            <div>
              <dt className="t-meta font-semibold text-slate-500">망설이는 이유</dt>
              <dd className="t-sub text-slate-700">{result.hesitant.join(' · ') || '없음'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="t-meta font-semibold text-slate-500">나온 주제</dt>
              <dd className="mt-1"><PillList items={result.issues} /></dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="t-meta font-semibold text-slate-500">다음에 받을 자료</dt>
              <dd className="mt-1"><PillList items={result.nextDocs} /></dd>
            </div>
          </dl>
          <ScriptBlock title="다음 미팅 방향" text={result.strategy} />
          <ScriptBlock title="감사 카톡" text={result.kakao} copy />
          {result.nextDocs.length > 0 && <ScriptBlock title="자료 요청 카톡" text={docRequestText(record, result.nextDocs)} copy />}
          {missingDocSlots(record, result.nextDocs).length > 0 && (
            <fieldset data-testid="meeting-doc-slots" className="rounded-(--radius-control) border border-slate-200 bg-white p-3">
              <legend className="t-sub px-1 font-semibold text-slate-700">서류함에 칸 만들기 — 받았는지 챙기게</legend>
              <div className="flex flex-col gap-1.5">
                {missingDocSlots(record, result.nextDocs).map((d) => (
                  <label key={d} className="t-sub flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={slots.includes(d)}
                      onChange={(e) => setSlots((cur) => (e.target.checked ? [...cur, d] : cur.filter((x) => x !== d)))}
                      className="size-4 accent-brand-600"
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="block text-[0.85rem] text-slate-500">
              다음 할 일
              <input value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-[0.85rem] text-slate-500">
              날짜
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
            </label>
          </div>
          {canMove && (
            <label className="t-sub flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} className="size-4 accent-brand-600" />
              영업 단계를 <strong className="font-semibold">{SALES_STAGE_LABEL[target]}</strong>로 옮기기
            </label>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? '저장 중…' : '기록 저장'}
            </Button>
          </div>
        </div>
      )}
      <p className="t-meta break-keep text-slate-400">메모 속 낱말로 나누는 규칙 계산입니다. 실제 뜻은 다시 확인하세요.</p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 화면                                                                 */
/* ------------------------------------------------------------------ */

function MeetingContent({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [params, setParams] = useSearchParams()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (quiet = false) => {
    try {
      // D-120: 저장 실패 뒤 다시 읽을 때는 화면을 비우지 않는다(적던 칸이 사라지지 않게)
      if (!quiet) setLoading(true)
      setRecords(await listClients(workspaceId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [workspaceId])
  useEffect(() => {
    void load()
  }, [load])

  // 고르는 칸 — 영업 흐름 순서(잠재 → 클로징), 계약 · 보류 · 이탈은 뒤로
  const live = useMemo(() => records.filter((r) => r.archivedAt === null), [records])
  const grouped = useMemo(
    () => SALES_STAGE_ORDER.map((st) => ({ st, list: live.filter((r) => salesStageOf(r) === st).sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko')) })).filter((g) => g.list.length > 0),
    [live],
  )
  const firstPick = grouped.find((g) => g.st === 'm1sched')?.list[0] ?? grouped[0]?.list[0] ?? null
  const clientId = params.get('client') ?? firstPick?.id ?? ''
  const record = live.find((r) => r.id === clientId) ?? null
  const stage: SalesStage = record ? salesStageOf(record) : 'lead'
  // 차수 — 고르지 않았으면 단계로 정한다(잠재 고객은 첫 연락부터)
  const rp = params.get('round')
  const round: Round = rp === '0' || rp === '1' || rp === '2' || rp === '3' ? (Number(rp) as Round) : stage === 'lead' ? 0 : roundForStage(stage)

  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('client', id); n.delete('round'); return n }, { replace: true })
  const setRound = (r: Round) => setParams((p) => { const n = new URLSearchParams(p); if (record) n.set('client', record.id); n.set('round', String(r)); return n }, { replace: true })

  const item = useMemo(() => (record ? toEngineItem(record) : null), [record])
  const score = item ? scoreLead(item) : 0
  const tier = scoreTier(score)
  const theme = item ? MEETING_THEMES[detectTheme(item)] : null

  /** 저장 — 됐으면 true. 실패하면 알리고 저장된 내용으로 조용히 다시 읽는다 */
  const persist = async (next: ClientOpsRecord, msg: string): Promise<boolean> => {
    if (next === record) {
      showToast(msg)
      return true
    }
    setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
    try {
      const saved = await saveClient(next)
      setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
      showToast(msg)
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? `${cause.message} — 다시 눌러 주세요.` : '저장하지 못했습니다. 다시 눌러 주세요.')
      void load(true)
      return false
    }
  }

  /** 크레탑 분석 → 이 업체 기록에 (빈 칸 채우기 · 추천 전략 · 도구 결과). 분석 이력은 작업대가 이미 남겼다 */
  const applyCretop = async (rec: ClientOpsRecord, ui: CretopMiniUi, selected: string[], msg: string): Promise<boolean> => {
    try {
      const r = await registerFromCretop({ workspaceId, ui, existing: rec, selected, saveHistory: false })
      setRecords((list) => list.map((x) => (x.id === r.record.id ? r.record : x)))
      showToast(`${msg}${r.filled.length > 0 ? ` — 채운 칸: ${r.filled.join(' · ')}` : ''}`)
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? `업체에 반영하지 못했습니다 — ${cause.message}` : '업체에 반영하지 못했습니다.')
      return false
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title="영업 관리" sub={`${today} · 미팅 준비 — 1차는 크레탑 분석기, 2차부터 이어서 물을 것 · 대본`} />
      <SalesTabs />

      {error && (
        <p role="alert" className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : live.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
          <Presentation aria-hidden="true" className="mx-auto size-9 text-brand-400" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">미팅을 준비할 업체가 없습니다</p>
          <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">영업 보드에서 새 잠재고객을 등록하면 여기서 대본을 준비합니다.</p>
          <Link to="/sales/board" className="mt-5 inline-flex font-semibold text-brand-700 hover:underline">영업 보드로 →</Link>
        </div>
      ) : (
        <>
          <label className="flex max-w-xl flex-col gap-1 text-[0.85rem] text-slate-500">
            고객
            <select value={record?.id ?? ''} onChange={(e) => pick(e.target.value)} aria-label="미팅 준비할 고객" className={`${inputClass} !mt-0 font-semibold`}>
              {grouped.map((g) => (
                <optgroup key={g.st} label={SALES_STAGE_LABEL[g.st]}>
                  {g.list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.companyName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {!record && clientId !== '' && (
            <p role="status" data-testid="client-missing" className="t-body rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-3 break-keep text-slate-800">
              이 업체를 찾을 수 없습니다 — 보관했거나 지운 업체일 수 있습니다. 위 칸에서 다른 업체를 골라 주세요.
            </p>
          )}

          {record && item && (
            <>
              {/* D-121: 요약 한 장 — 누구 · 어디까지 · 점수 · 다음 약속 */}
              <section aria-label="고객 요약" data-testid="meeting-summary" className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Link to={`/ops/clients/${record.id}`} className="t-card inline-flex items-center gap-1 font-bold text-slate-900 hover:text-brand-700 hover:underline">
                    {record.companyName}
                    <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
                  </Link>
                  <StageBadge stage={stage} />
                  <Badge tone={TIER_TONE[tier.key]}>
                    <span data-testid="lead-score" className="tabular-nums">{score}점</span> · {tier.label}
                  </Badge>
                  {theme && <span className="t-sub text-slate-500">미팅 테마 · {theme.label}</span>}
                </div>
                <div className="border-t border-slate-100 pt-2.5">
                  <NextStepEditor record={record} today={today} onSave={(n, m) => persist(n, m)} />
                </div>
              </section>

              {/* 영업 흐름 — 한 줄로 접어 둔다(펼치면 걸음 · 할 일 · 작업실 도구) */}
              <SalesJourneyCard
                record={record}
                today={today}
                foldable
                onPathChange={(path) => void persist(withSalesPath(record, path), path ? '계약 경로를 정했습니다.' : '계약 경로를 비웠습니다.')}
              />

              <ProfileEditor record={record} onSave={(n, m) => void persist(n, m)} />

              {/* 차수 고르기 */}
              <div role="group" aria-label="미팅 차수" data-testid="meeting-rounds" className="grid grid-cols-4 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:self-start">
                {ROUNDS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={round === r.key}
                    onClick={() => setRound(r.key)}
                    className={`tap rounded-[8px] px-2 py-2 text-[0.85rem] font-semibold break-keep sm:px-4 sm:text-[0.9rem] ${round === r.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {round === 0 && <FirstContactPlan item={item} />}

              {round === 1 && (
                <>
                  {/* D-121: 1차 미팅 준비 = 크레탑 분석기 그대로(단독 판매 부품) — 분석하면 이 업체에 바로 반영 */}
                  <section aria-label="크레탑 분석기" data-testid="meeting-cretop" className="flex flex-col gap-2">
                    <h2 className="t-section flex items-center gap-2 text-slate-900">
                      <ScanSearch aria-hidden="true" className="size-5 text-brand-600" />
                      크레탑 분석기
                      <span className="t-sub font-medium text-slate-500">· 1차 미팅 준비</span>
                    </h2>
                    <ToolClientScope workspaceId={workspaceId} client={record}>
                      <CretopWorkbench
                        embedded
                        onAnalyzed={(ui) => {
                          // 다른 회사 보고서를 넣었으면 저절로 붙이지 않는다 — 맞으면 결과 막대의 '이 업체에 반영' 으로
                          if (!sameCompany(record, ui)) {
                            showToast(`${ui.companyInfo?.companyName || '이 보고서'} — ${record.companyName} 과(와) 다른 회사 같아 반영하지 않았습니다. 맞으면 '이 업체에 반영' 을 누르세요.`)
                            return
                          }
                          void applyCretop(record, ui, [], '크레탑 분석을 이 업체에 반영했습니다')
                        }}
                        attachSlot={(ui, selected) => (
                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid="meeting-cretop-apply"
                            onClick={() => void applyCretop(record, ui, selected, selected.length > 0 ? `고른 항목 ${selected.length}개를 이 업체에 반영했습니다` : '이 업체에 다시 반영했습니다')}
                          >
                            <Check aria-hidden="true" className="size-4" />
                            {selected.length > 0 ? `고른 항목 ${selected.length}개 반영` : '이 업체에 반영'}
                          </Button>
                        )}
                      />
                    </ToolClientScope>
                  </section>
                  <FirstMeetingScript item={item} />
                </>
              )}

              {(round === 2 || round === 3) && <LaterRoundPlan record={record} item={item} round={round} onGoFirst={() => setRound(1)} />}

              {round !== 0 && <MeetingRecorder
                  key={`${record.id}-${round}`}
                  record={record}
                  round={round}
                  today={today}
                  onSave={async (n, m) => {
                    const ok = await persist(n, m)
                    // 기록이 저장됐으면 다음 차수 대본으로 넘어간다(실패하면 적은 메모를 그대로 둔다)
                    if (ok && round < 3) setRound((round + 1) as Round)
                    return ok
                  }}
                />}

              {(record.sales?.meetings?.length ?? 0) > 0 && (
                <Disclosure title="지난 미팅 기록" hint={`${record.sales?.meetings?.length}건`}>
                  <ul className="flex flex-col gap-2.5">
                    {record.sales?.meetings?.map((m) => (
                      <li key={m.id} className="rounded-(--radius-control) border border-slate-200 bg-white p-3">
                        <p className="t-meta text-slate-500">
                          {localDateOf(m.at)} · {m.round}차 · {m.reaction}
                        </p>
                        <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-700">{m.text}</p>
                        {m.issues.length > 0 && <div className="mt-1.5"><PillList items={m.issues} /></div>}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}

              <KakaoGroup item={item} />
            </>
          )}
        </>
      )}
    </div>
  )
}

type EngineItem = ReturnType<typeof toEngineItem>

/** 보고서가 이 업체 것인가 — 사업자번호가 둘 다 있으면 그것으로, 아니면 이름으로. 모르면 같다고 본다 */
function sameCompany(record: ClientOpsRecord, ui: CretopMiniUi): boolean {
  const d = (v: string) => v.replace(/[^0-9]/g, '')
  const a = d(record.businessNumber)
  const b = d(ui.companyInfo?.businessNo ?? '')
  if (a.length === 10 && b.length === 10) return a === b
  const x = companyKey(record.companyName)
  const y = companyKey(ui.companyInfo?.companyName ?? '')
  if (x === '' || y === '') return true
  return x.includes(y) || y.includes(x)
}

/** 앞의 몇 줄만 — 나머지는 '더 보기' (글은 지우지 않는다) */
function MoreList({ items, first = 5 }: { items: string[]; first?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, first)
  return (
    <div className="flex flex-col gap-2">
      <NumberedList items={shown} />
      {items.length > first && (
        <button type="button" onClick={() => setAll((v) => !v)} className="t-sub self-start font-semibold text-brand-700 hover:underline">
          {all ? '접기' : `더 보기 (${items.length - first}개)`}
        </button>
      )}
    </div>
  )
}

/** 첫 연락 — 첫 마디 · 전화 대본만 펼쳐 두고 나머지는 접기 (원본 buildLeadPlan 문구 그대로) */
function FirstContactPlan({ item }: { item: EngineItem }) {
  const p = buildLeadPlan(item)
  return (
    <div data-testid="meeting-plan" className="flex flex-col gap-3">
      <ScriptBlock title="첫 마디" text={p.hook} copy />
      <ScriptBlock title="전화 대본" text={p.phone} copy />
      <Disclosure title="거절과 답 · 1차 미팅으로 넘기는 말" hint={`거절 ${p.objections.length}가지`}>
        <div className="flex flex-col gap-3">
          <ObjectionList items={p.objections} />
          <ScriptBlock title="1차 미팅으로 넘기는 말" text={p.meetingBridge} copy />
        </div>
      </Disclosure>
    </div>
  )
}

/** 1차 영업 대본 — 크레탑 분석기 아래 접어 둔다. 규칙으로 고른 전략 TOP3 도 여기 */
function FirstMeetingScript({ item }: { item: EngineItem }) {
  const p = buildMeetingPlan(item, 'm1')
  const strategies = recommendedStrategiesFor(item)
  return (
    <Disclosure title="영업 대본 — 오프닝 · 질문 · 요청 자료" hint={`질문 ${p.questions.length}개 · 전략 TOP3`}>
      <div data-testid="meeting-plan" className="flex flex-col gap-3">
        <ScriptBlock title="목표" text={p.goal} />
        <ScriptBlock title="오프닝" text={p.opening} copy />
        <ScriptBlock title={`질문 ${p.questions.length}개`}>
          <MoreList items={p.questions} />
        </ScriptBlock>
        <ScriptBlock title="요청할 자료">
          <PillList items={p.docs} />
        </ScriptBlock>
        <ScriptBlock title="먼저 볼 전략 TOP3">
          <ol className="grid gap-2 lg:grid-cols-3">
            {strategies.map((st, i) => (
              <li key={st.id} className="relative flex flex-col gap-1 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 pl-4">
                <span aria-hidden="true" className="ramp-bar absolute inset-y-0 left-0 w-[3px]" style={rampAt(i, 3)} />
                <span className="t-sub font-bold text-slate-900">
                  <span className="ramp-text tabular-nums" style={rampAt(i, 3)}>{i + 1}.</span> {st.name}
                </span>
                <span className="t-meta break-keep text-slate-600">{st.fit}</span>
                <span className="t-meta text-slate-500">
                  수임료 {st.fee}
                  {st.needTaxPro ? ' · 세무사 검토 필요' : ''}
                </span>
              </li>
            ))}
          </ol>
        </ScriptBlock>
        <ScriptBlock title="피할 것" text={p.avoid} />
        <ScriptBlock title="다음 단계" text={p.next} />
      </div>
    </Disclosure>
  )
}

/**
 * 2차 · 3차 — 운영 OS 흐름(D-121): 크레탑 전략에서 이어서 물을 것 → 이번 차수 핵심 대본 → 제안 · 계약으로.
 * 원본 대본의 나머지(진행 순서 · 거절과 답 · 수임료 · 전략)는 '더 보기' 로 접는다.
 */
function LaterRoundPlan({ record, item, round, onGoFirst }: { record: ClientOpsRecord; item: EngineItem; round: 2 | 3; onGoFirst: () => void }) {
  const proposal = record.sales?.proposal ?? null
  const prep = record.sales?.contractPrep?.length ?? 0
  const followUp = (
    <section aria-label="이어서 물을 것" className="flex flex-col gap-2">
      <h2 className="t-section text-slate-900">
        이어서 물을 것 <span className="t-sub font-medium text-slate-500">· 크레탑 전략 {round === 2 ? 'D 제안 연결' : 'E 다음 액션'}</span>
      </h2>
      <CretopFollowUp record={record} round={round} onGoFirst={onGoFirst} />
    </section>
  )
  const nextLink = (
    <Link
      to={`/sales/proposal?client=${record.id}`}
      data-testid="meeting-proposal-link"
      className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3 hover:bg-slate-50"
    >
      <FileText aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-sub font-bold text-slate-900">{round === 2 ? '제안서 · 견적' : '계약 준비'}</span>
        <span className="t-meta break-keep text-slate-500">
          {round === 2
            ? proposal
              ? `${proposal.packages.length}개 상품 · ${proposal.status}`
              : '아직 제안서가 없습니다 — 2차 미팅 전에 만들어 두세요'
            : `계약 준비 체크 ${prep}개 끝냄${proposal ? ` · 제안 ${proposal.status}` : ''}`}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
    </Link>
  )
  if (round === 2) {
    const p = buildMeetingPlan(item, 'm2')
    return (
      <>
        {followUp}
        <div data-testid="meeting-plan" className="flex flex-col gap-3">
          <ScriptBlock title="핵심 이슈 TOP3">
            <NumberedList items={p.topIssues.map((t) => t.replace(/^\d+\.\s*/, ''))} />
          </ScriptBlock>
          <ScriptBlock title="마무리 말" text={p.close} copy />
          {nextLink}
          <Disclosure title="더 보기 — 목표 · 진행 순서 · 거절과 답 · 받을 자료 · 수임료">
            <div className="flex flex-col gap-3">
              <ScriptBlock title="목표" text={p.goal} />
              <ScriptBlock title="진행 순서" text={p.approach} />
              <ScriptBlock title="거절과 답">
                <ObjectionList items={p.objections} />
              </ScriptBlock>
              <ScriptBlock title="받을 자료">
                <PillList items={p.docs} />
              </ScriptBlock>
              <ScriptBlock title="수임료 범위 (내부)" text={p.fee} />
            </div>
          </Disclosure>
        </div>
      </>
    )
  }
  const p = buildMeetingPlan(item, 'm3')
  return (
    <>
      {followUp}
      <div data-testid="meeting-plan" className="flex flex-col gap-3">
        <ScriptBlock title="1차 계약 제안" text={p.proposal} copy />
        <ScriptBlock title="가격 이야기" text={p.priceTalk} copy />
        <ScriptBlock title="'생각해 볼게요' 에 대한 답" text={p.holdTalk} copy />
        {nextLink}
        <Disclosure title="더 보기 — 목표 · 전략">
          <div className="flex flex-col gap-3">
            <ScriptBlock title="목표" text={p.goal} />
            <ScriptBlock title="전략" text={p.strategy} />
          </div>
        </Disclosure>
      </div>
    </>
  )
}

/** 카톡 문구 — 차수마다 흩어져 있던 것을 한 묶음으로 접어 둔다 */
function KakaoGroup({ item }: { item: EngineItem }) {
  const lead = buildLeadPlan(item)
  const m1 = buildMeetingPlan(item, 'm1')
  const m3 = buildMeetingPlan(item, 'm3')
  return (
    <Disclosure title="카톡 문구" hint="통화 뒤 · 1차 미팅 뒤 · 다음 연락 · 계약 안내">
      <div data-testid="meeting-kakao" className="flex flex-col gap-3">
        <ScriptBlock title="통화 뒤 카톡" text={lead.kakao} copy />
        <ScriptBlock title="1차 미팅 뒤 카톡" text={m1.kakao} copy />
        <ScriptBlock title="다음 연락 카톡 (고객 유형별)" text={followUpKakao(item)} copy />
        <ScriptBlock title="계약 안내 카톡" text={m3.contractKakao} copy />
      </div>
    </Disclosure>
  )
}

function ObjectionList({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([q, a]) => (
        <li key={q} className="flex flex-col gap-0.5">
          <span className="t-sub font-semibold text-slate-800">“{q}”</span>
          <span className="t-body flex items-start gap-2 break-keep text-slate-700">
            <span className="min-w-0 flex-1">{a}</span>
            <CopyButton text={a} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function MeetingPrepPage() {
  return <WorkspaceScope>{(ctx) => <MeetingContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
