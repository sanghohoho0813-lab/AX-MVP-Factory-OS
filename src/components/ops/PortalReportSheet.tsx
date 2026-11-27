/**
 * D-681 고객 화면 보고서 만들기 · 정정 — 업체 상세 › 고객 플랫폼 탭.
 *
 *   1) 종류(경과 · 월간 · 상담 요약 · 연간 + [그 밖에] 중간 · 최종) + 종류마다 기간 → [초안 만들기]
 *      월간: 이번 달 · 지난달 / 연간: 계약일부터(계약일이 없으면 못 고름 — 짐작하지 않음) · 최근 12개월 · '다음 1년 검토해 볼 것' 은 맞춤 추천과 같은 판정(D-682)
 *   2) 내부 기록에서 뽑은 줄을 켜고 끄고 고친다(직원이 적은 '다음 단계' 같은 내부 글은 꺼진 채) · 담당자 한마디 · [고객 화면으로 보기]
 *   3) [고객 화면에 발행] → 한 번 더 묻고 → 발행(같은 창에서 두 번 눌러도 한 건) → 안내 문구 복사
 * 정정은 예전 판을 불러와 같은 화면에서 고친 뒤 '무엇을 고쳤는지' 한 줄과 함께 새 판으로 — 예전 판은 지우지 않는다.
 * 규칙 계산이다(AI 아님). 고객에게 가는 것은 켠 줄 · 제목 · 요약 · 한마디뿐 — 출처는 내부 감사용으로만 서버에 남는다.
 */
import { useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy, Eye, FilePlus2, Plus, Send, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import { generateId } from '../../storage/localStore'
import { brand } from '../../brand/brand.config'
import { copyText } from '../../services/grants/grantView'
import {
  DRAFT_PERIOD_LABEL,
  REPORT_KINDS_MAIN,
  REPORT_KINDS_NOW,
  REPORT_KIND_LABEL,
  buildReportDraft,
  defaultPeriod,
  draftPayload,
  draftPeriod,
  periodUsable,
  periodsFor,
  reportNoticeText,
  type DraftPeriodKey,
  type PortalDocLite,
  type PortalReportKind,
  type PortalUpdateLite,
  type ReportDraft,
} from '../../services/portalGrowthRules'
import { growthErrorText, publishReport, reportCustomerUrl, type PortalReport } from '../../services/portalGrowth'
import { PortalReportView } from './PortalReportView'
import { featureUsable, useEntitlements } from '../../lib/entitlementsStore'
import { localDateOf } from '../../lib/appClock'

function fromReport(r: PortalReport): ReportDraft {
  return {
    kind: r.kind,
    title: r.title,
    periodStart: r.periodStart ?? '',
    periodEnd: r.periodEnd ?? '',
    summary: r.summary,
    staffNote: r.staffNote,
    sections: r.sections.map((s) => ({ key: s.key, title: s.title, lines: s.items.map((i) => ({ id: generateId(), text: i.text, ...(i.date ? { date: i.date } : {}), on: true })) })),
  }
}

export function PortalReportSheet({
  record,
  workspaceId,
  today,
  docs,
  updates,
  reports,
  correcting,
  linked,
  seenReportIds,
  onClose,
  onPublished,
}: {
  record: ClientOpsRecord
  workspaceId: string | null
  today: string
  docs: readonly PortalDocLite[]
  updates: readonly PortalUpdateLite[]
  /** 이 업체에 지금까지 낸 보고서 — '지난 보고 이후' 기간 */
  reports: readonly PortalReport[]
  /** 정정할 판(없으면 새 보고서) */
  correcting?: PortalReport | null
  /** 고객 계정이 연결돼 있는지(없어도 발행은 된다 — 연결되면 그때부터 보인다) */
  linked: boolean
  /** 고객 계정 누구라도 열어 본 보고서 id — 연간 '함께 한 기록' 숫자(연습 모드는 빈 칸) */
  seenReportIds?: ReadonlySet<string>
  onClose: () => void
  onPublished: (r: { id: string; version: number; created: boolean }) => void
}) {
  const { showToast } = useToast()
  const [kind, setKind] = useState<PortalReportKind>(correcting?.kind ?? 'progress')
  const lastEnd = useMemo(
    () => reports.filter((r) => r.status === 'published' && r.periodEnd).map((r) => r.periodEnd as string).sort().at(-1) ?? null,
    [reports],
  )
  const [period, setPeriod] = useState<DraftPeriodKey>(() => defaultPeriod(correcting?.kind ?? 'progress', record, today, lastEnd))
  const [moreKinds, setMoreKinds] = useState(false)
  const [making, setMaking] = useState(false)
  const { ent } = useEntitlements()
  const pickKind = (k: PortalReportKind) => {
    setKind(k)
    setPeriod(defaultPeriod(k, record, today, lastEnd))
  }
  const [draft, setDraft] = useState<ReportDraft | null>(correcting ? fromReport(correcting) : null)
  const [correction, setCorrection] = useState('')
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ id: string; version: number } | null>(null)
  const [addText, setAddText] = useState<Record<string, string>>({})
  // 이 창에서 만든 발행 번호 — 두 번 눌러도 · 실패 뒤 다시 눌러도 같은 번호(서버가 한 건으로)
  const clientKey = useRef(`rep-${generateId()}`).current

  const makeDraft = async () => {
    if (making) return
    const range = draftPeriod(period, record, today, lastEnd)
    let picks: { key: string; label: string }[] = []
    let history: { reports: number; reportsSeen: number } | undefined
    if (kind === 'annual') {
      setMaking(true)
      // 다음 1년 검토 — 맞춤 추천 '먼저 제안할 것' 과 같은 판정 · 같은 순서(D-618 판정은 한 곳). 실패해도 초안은 나온다
      try {
        const { buildInsights, topPicks } = await import('../../services/clientInsights')
        picks = topPicks(buildInsights(record, today, [], (k) => featureUsable(ent, k)), 3).map((i) => ({ key: i.key, label: i.label }))
      } catch {
        picks = []
      }
      const inRange = reports.filter((r) => r.status === 'published' && localDateOf(r.publishedAt) >= range.from && localDateOf(r.publishedAt) <= range.to)
      history = { reports: inRange.length, reportsSeen: inRange.filter((r) => seenReportIds?.has(r.id)).length }
      setMaking(false)
    }
    setDraft(buildReportDraft({ record, today, kind, period: range, docs, updates, picks, history }))
    setView('edit')
  }

  const patch = (fn: (d: ReportDraft) => ReportDraft) => setDraft((d) => (d ? fn(d) : d))
  const payload = draft ? draftPayload(draft) : null
  const canPublish = !!draft && draft.title.trim().length > 0 && (draft.summary.trim().length > 0 || (payload?.lineCount ?? 0) > 0) && (!correcting || correction.trim().length > 0)

  const publish = async () => {
    if (!draft || !payload || busy) return
    setBusy(true)
    try {
      const out = await publishReport(workspaceId, record.id, {
        clientKey,
        kind: draft.kind,
        title: draft.title.trim(),
        periodStart: draft.periodStart || null,
        periodEnd: draft.periodEnd || null,
        summary: draft.summary.trim(),
        sections: payload.sections,
        staffNote: draft.staffNote.trim(),
        sourceRefs: payload.sourceRefs,
        supersedes: correcting?.id ?? null,
        correctionNote: correction.trim(),
      })
      setDone({ id: out.id, version: out.version })
      setConfirm(false)
      onPublished(out)
    } catch (cause) {
      showToast(growthErrorText(cause, '발행하지 못했어요 — 잠시 뒤 다시 눌러 주세요(두 번 눌러도 한 건만 올라가요).'))
    } finally {
      setBusy(false)
    }
  }

  const who = record.representativeName ? `${record.representativeName} 대표님` : `${record.companyName} 담당자님`
  const notice = done && draft
    ? reportNoticeText({ who, kindLabel: REPORT_KIND_LABEL[draft.kind], title: draft.title.trim(), url: reportCustomerUrl(brand.customerPlatformUrl, done.id), corrected: done.version > 1 })
    : ''

  const title = done ? '고객 화면에 올렸어요' : correcting ? `보고서 정정 — ${correcting.version + 1}판` : '고객에게 보낼 보고서'

  const footer = done ? (
    <Button variant="primary" onClick={onClose} data-testid="report-done-close">닫기</Button>
  ) : draft ? (
    confirm ? (
      <div className="flex w-full flex-wrap items-center justify-end gap-2" data-testid="report-confirm">
        <span className="t-sub mr-auto break-keep text-slate-700">고객 화면에 바로 보여요. {correcting ? '예전 판은 "정정됨" 으로 남아요.' : '발행할까요?'}</span>
        <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>취소</Button>
        <Button variant="primary" onClick={() => void publish()} disabled={busy} data-testid="report-publish-go">
          <Send aria-hidden="true" className="size-4" /> {busy ? '올리는 중…' : '발행'}
        </Button>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => setView((v) => (v === 'edit' ? 'preview' : 'edit'))} data-testid="report-preview-toggle">
          <Eye aria-hidden="true" className="size-4" /> {view === 'edit' ? '고객 화면으로 보기' : '다시 고치기'}
        </Button>
        <Button variant="primary" onClick={() => setConfirm(true)} disabled={!canPublish} data-testid="report-publish">
          <Send aria-hidden="true" className="size-4" /> 고객 화면에 발행
        </Button>
      </div>
    )
  ) : (
    <Button variant="primary" onClick={() => void makeDraft()} disabled={making || !periodUsable(period, record, today)} data-testid="report-make-draft">
      <FilePlus2 aria-hidden="true" className="size-4" /> {making ? '만드는 중…' : '초안 만들기'}
    </Button>
  )

  return (
    <Modal open title={title} size="lg" onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-4" data-testid="report-sheet" data-step={done ? 'done' : draft ? (view === 'preview' ? 'preview' : 'edit') : 'setup'}>
        {!linked && !done && (
          <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-slate-700" data-testid="report-unlinked-note">
            아직 고객 계정이 연결되지 않았어요. 발행해 두면 연결되는 순간부터 고객 화면에 보여요.
          </p>
        )}

        {done && draft && (
          <div className="flex flex-col gap-3" data-testid="report-done">
            <p className="t-body flex items-center gap-1.5 font-semibold text-slate-900">
              <Check aria-hidden="true" className="size-5 text-success-600" /> {draft.title} · {done.version}판
            </p>
            <p className="t-sub break-keep text-slate-600">고객이 열어 보면 이 탭에 '열어 봄' · '확인함' 이 떠요. 안내 문구를 카톡 · 문자로 보내 주세요(자동으로 보내지 않아요).</p>
            <textarea readOnly value={notice} rows={8} className="t-sub w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-800" data-testid="report-notice-text" />
            <Button
              variant="secondary"
              className="self-start"
              data-testid="report-notice-copy"
              onClick={() => void copyText(notice).then((ok) => showToast(ok ? '안내 문구를 복사했어요.' : '복사하지 못했어요 — 글을 직접 골라 복사해 주세요.'))}
            >
              <ClipboardCopy aria-hidden="true" className="size-4" /> 안내 문구 복사
            </Button>
          </div>
        )}

        {!done && !draft && (
          <div className="flex flex-col gap-4" data-testid="report-setup">
            <fieldset className="flex flex-col gap-2">
              <legend className="t-sub font-semibold text-slate-700">무엇을 보낼까요?</legend>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_KINDS_NOW.filter((k, i) => i < REPORT_KINDS_MAIN || moreKinds || kind === k).map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)} data-testid="report-kind" data-kind={k}
                    className={`tap t-sub min-h-10 rounded-full border px-3.5 font-semibold ${kind === k ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    {kind === k && <Check aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" />}{REPORT_KIND_LABEL[k]}
                  </button>
                ))}
                {!moreKinds && !REPORT_KINDS_NOW.slice(REPORT_KINDS_MAIN).includes(kind) && (
                  <button type="button" onClick={() => setMoreKinds(true)} className="tap t-sub min-h-10 px-2 font-semibold text-brand-700 hover:underline" data-testid="report-kind-more">
                    그 밖에(중간 · 최종)
                  </button>
                )}
              </div>
            </fieldset>
            {kind !== 'consult_summary' && (
              <fieldset className="flex flex-col gap-2">
                <legend className="t-sub font-semibold text-slate-700">어느 기간을?</legend>
                <div className="flex flex-wrap gap-1.5">
                  {periodsFor(kind).filter((p) => p !== 'since_last' || lastEnd).map((p) => {
                    const usable = periodUsable(p, record, today)
                    return (
                      <button key={p} type="button" aria-pressed={period === p} disabled={!usable} onClick={() => setPeriod(p)} data-testid="report-period" data-period={p}
                        className={`tap t-sub min-h-10 rounded-full border px-3.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${period === p ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                        {period === p && <Check aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" />}{DRAFT_PERIOD_LABEL[p]}
                      </button>
                    )
                  })}
                </div>
                {kind === 'annual' && !periodUsable('contract', record, today) && (
                  <p className="t-sub break-keep text-slate-600" data-testid="report-contract-missing">계약일이 비어 있어 최근 12개월로 정리해요. 업체 › 계약에 계약일을 적으면 계약일부터 정리할 수 있어요.</p>
                )}
              </fieldset>
            )}
            <p className="t-sub break-keep text-slate-600">업체 기록(업무 · 서류 · 지원사업 · 요청한 자료)에서 고객이 봐도 되는 줄만 뽑아요. 수수료 · 메모 · 업무 일기는 넣지 않아요.</p>
          </div>
        )}

        {!done && draft && view === 'preview' && (
          <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid="report-preview">
            <p className="t-meta mb-2 font-semibold text-slate-500">{brand.customerPortalLabel} · 고객이 보는 모양</p>
            <PortalReportView
              report={{
                kind: draft.kind,
                title: draft.title,
                periodStart: draft.periodStart || null,
                periodEnd: draft.periodEnd || null,
                summary: draft.summary,
                sections: payload?.sections ?? [],
                staffNote: draft.staffNote,
                version: correcting ? correcting.version + 1 : 1,
                correctionNote: correction,
                publishedAt: null,
              }}
            />
          </div>
        )}

        {!done && draft && view === 'edit' && (
          <div className="flex flex-col gap-4" data-testid="report-edit">
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">제목</span>
              <input value={draft.title} maxLength={120} onChange={(e) => patch((d) => ({ ...d, title: e.target.value }))} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 px-3" data-testid="report-title" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">한 줄 요약</span>
              <textarea value={draft.summary} maxLength={1000} rows={2} onChange={(e) => patch((d) => ({ ...d, summary: e.target.value }))} className="t-body rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="report-summary" />
            </label>
            {draft.sections.map((s) => (
              <section key={s.key} className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" data-testid="report-section" data-key={s.key}>
                <p className="t-sub font-bold text-slate-900">{s.title}</p>
                {s.lines.length === 0 && <p className="t-sub text-slate-500">아직 줄이 없어요 — 필요하면 아래에 적어 넣으세요.</p>}
                <ul className="flex flex-col gap-1.5">
                  {s.lines.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2" data-testid="report-line" data-on={l.on ? '1' : '0'} data-internal={l.internal ? '1' : '0'}>
                      <input
                        type="checkbox"
                        checked={l.on}
                        aria-label={`${l.text} 고객에게 보내기`}
                        onChange={(e) => patch((d) => ({ ...d, sections: d.sections.map((x) => (x.key === s.key ? { ...x, lines: x.lines.map((y) => (y.id === l.id ? { ...y, on: e.target.checked } : y)) } : x)) }))}
                        className="size-5 shrink-0"
                        data-testid="report-line-on"
                      />
                      {/* 긴 줄이 휴대폰에서 잘리지 않게 — 글 길이만큼 늘어나는 칸(줄바꿈은 넣지 않는다) */}
                      <textarea
                        value={l.text}
                        maxLength={300}
                        rows={l.text.length > 24 ? 2 : 1}
                        onChange={(e) => patch((d) => ({ ...d, sections: d.sections.map((x) => (x.key === s.key ? { ...x, lines: x.lines.map((y) => (y.id === l.id ? { ...y, text: e.target.value.replace(/\s*\n\s*/g, ' ') } : y)) } : x)) }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                        className={`t-sub min-h-10 min-w-0 flex-1 basis-56 resize-none rounded-(--radius-control) border px-2.5 py-2 break-keep [field-sizing:content] ${l.on ? 'border-slate-300 text-slate-900' : 'border-slate-200 text-slate-500'}`}
                        data-testid="report-line-text"
                      />
                      {l.date && <span className="t-meta shrink-0 text-slate-500 tabular-nums">{l.date.slice(5).replace('-', '/')}</span>}
                      {l.internal && <span className="t-meta shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600" title="직원이 적은 글이라 꺼 두었어요. 고객이 봐도 되는지 보고 켜세요.">내부 글</span>}
                      <button type="button" aria-label="이 줄 빼기" className="tap inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => patch((d) => ({ ...d, sections: d.sections.map((x) => (x.key === s.key ? { ...x, lines: x.lines.filter((y) => y.id !== l.id) } : x)) }))}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={addText[s.key] ?? ''}
                    maxLength={300}
                    placeholder="줄 더하기"
                    aria-label={`${s.title}에 줄 더하기`}
                    onChange={(e) => setAddText((a) => ({ ...a, [s.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const t = (addText[s.key] ?? '').trim()
                      if (!t) return
                      patch((d) => ({ ...d, sections: d.sections.map((x) => (x.key === s.key ? { ...x, lines: [...x.lines, { id: generateId(), text: t, on: true, source: { type: 'manual', id: 'staff' } }] } : x)) }))
                      setAddText((a) => ({ ...a, [s.key]: '' }))
                    }}
                    className="t-sub min-h-10 min-w-0 flex-1 basis-56 rounded-(--radius-control) border border-dashed border-slate-300 px-2.5"
                    data-testid="report-line-add"
                  />
                  <Button size="sm" variant="ghost" onClick={() => {
                    const t = (addText[s.key] ?? '').trim()
                    if (!t) return
                    patch((d) => ({ ...d, sections: d.sections.map((x) => (x.key === s.key ? { ...x, lines: [...x.lines, { id: generateId(), text: t, on: true, source: { type: 'manual', id: 'staff' } }] } : x)) }))
                    setAddText((a) => ({ ...a, [s.key]: '' }))
                  }}>
                    <Plus aria-hidden="true" className="size-4" /> 더하기
                  </Button>
                </div>
              </section>
            ))}
            <label className="flex flex-col gap-1 border-t border-slate-100 pt-3">
              <span className="t-sub font-semibold text-slate-700">담당자 한마디 <span className="font-normal text-slate-500">(선택 · 고객에게 보여요)</span></span>
              <textarea value={draft.staffNote} maxLength={1000} rows={2} onChange={(e) => patch((d) => ({ ...d, staffNote: e.target.value }))} className="t-body rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="report-staff-note" />
            </label>
            {correcting && (
              <label className="flex flex-col gap-1">
                <span className="t-sub font-semibold text-slate-700">무엇을 고쳤나요? <span className="font-normal text-danger-700">(꼭 · 고객에게 보여요)</span></span>
                <input value={correction} maxLength={300} onChange={(e) => setCorrection(e.target.value)} placeholder="예: 법인설립 완료일을 11/4 로 고쳤습니다" className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 px-3" data-testid="report-correction" />
              </label>
            )}
            <p className="t-meta text-slate-500" data-testid="report-line-count">고객에게 가는 줄 {payload?.lineCount ?? 0}개</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
