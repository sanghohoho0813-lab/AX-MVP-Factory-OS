/**
 * D-252 명세서 AI 작업판 — 대표: "하나하나 다 타자로 입력하는 거는 절대 없어야 돼. 조사해줘 · 아이디어 내줘 하면 LLM 이 MD 파일이랑 연계해서".
 *
 *   맨 위   [✨ 전부 써줘] 한 번 — 아이디어 → 조사 → 구성 → 본문 → 청구항 → 점검대로 고치기(약 4~5분 · 화면을 떠나도 계속)
 *   칸 여섯 아이디어 · 조사 · 구성 · 본문 · 청구항 · 점검 — 칸마다 [○○ 써줘 / 다시] · 결과 미리보기 · [직접 고치기]
 *   재료   회사 기록 · AI 작업실 자료 · 끌어다 놓은 파일(읽은 글만) — 타자 칠 칸이 없다
 * 기준 문서(Master v2.9 · AX펭귄)는 서버가 단추마다 붙인다. 대표 계정에서만(편집기가 ai === 'yes' 일 때만 그린다).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowRight, BookOpenCheck, Boxes, CheckCircle2, Circle, Download, ExternalLink, FileText, Lightbulb, Loader2, PenLine, Search, ShieldCheck, Sparkles, TriangleAlert, Upload } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { safeText, personNames, wonText } from '../../services/aiAssist/context'
import { parseSpecFile } from '../../services/patent/specParse'
import { MATERIAL_CHARS, MATERIAL_MAX, SECTION_KEYS, SECTION_LABEL, checkDraft, claimsOf, figureSubject, titleLine, type DraftStep, type IdeaPick, type SpecDraft } from '../../services/patent/specDraft'
import { CARD_STAGES, applyIdea, cardState, clearAfterIdea, hasLaterWork, partsHuman, planAll, stageBlock, stageOf, type AgentCard, type AgentCompany, type AgentStage } from '../../services/patent/specAgent'
import { specRun, specRunVersion, startSpecRun, subscribeSpecRun, type StageRow } from '../../services/patent/specRun'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { useOwnerAiRepo } from '../ownerAi/shared'
import type { ClientOpsRecord } from '../../types/clientOps'

type Act = (label: string, fn: (cur: SpecDraft) => SpecDraft) => void

/** 회사 기록 → 'AI 에 보낼 한 줄' 들(사람 이름 · 연락처는 가림) */
export function companyFactLines(r: ClientOpsRecord | null): string[] {
  if (!r) return []
  const f = clientFacts(r, new Date())
  const names = personNames(r)
  const out: string[] = []
  const add = (label: string, v: string | number | null | undefined) => {
    const t = typeof v === 'number' ? String(v) : String(v ?? '').trim()
    if (t) out.push(`${label}: ${t}`)
  }
  add('업종', f.industryText || f.industry || r.industry)
  add('업태', r.businessCategory)
  add('종목', [r.businessItem, r.businessItemsExtra].filter((x) => String(x ?? '').trim()).join(' · '))
  add('설립', f.establishedAt)
  add('업력(년)', f.years)
  add('직원 수', f.employeeCount)
  if (f.revenue) add('매출', `${wonText(f.revenue.won)}${f.revenue.estimated ? '(추정)' : ''}`)
  add('지역', String(f.address || r.businessAddress || '').split(/\s+/).slice(0, 2).join(' '))
  add('홈페이지', r.homepage)
  const memo = safeText(r.notes, names, 1200)
  if (memo) out.push(`상담 메모: ${memo}`)
  return out
}

const CARD_META: Record<AgentCard, { n: number; title: string; icon: ReactNode; run: string; again: string; help: string }> = {
  idea: { n: 1, title: '아이디어', icon: <Lightbulb aria-hidden="true" className="size-5" />, run: '아이디어 내줘', again: '다른 아이디어 더', help: '회사 기록 · 자료로 출원할 만한 아이디어 3개를 냅니다. 추천 1번이 바로 들어가고, 다른 것을 누르면 그걸로 바뀝니다.' },
  research: { n: 2, title: '선행기술 조사', icon: <Search aria-hidden="true" className="size-5" />, run: '조사해줘', again: '다시 조사', help: '비슷한 기술 · 차별화 · 위험 · KIPRIS 검색어. 검색 근거가 붙으면 출처가 같이 나옵니다.' },
  parts: { n: 3, title: '구성 · 단계 · 도면', icon: <Boxes aria-hidden="true" className="size-5" />, run: '구성 써줘', again: '다시 써줘', help: '권리축 7줄 · 구성요소(부호 110~) · 방법 단계 · 종속항 씨앗. 도면 설명은 구성에서 자동으로.' },
  body: { n: 4, title: '본문 7칸', icon: <FileText aria-hidden="true" className="size-5" />, run: '본문 써줘', again: '본문 다시', help: '기술분야 · 배경 · 과제 · 해결 수단 · 효과 · 구체적인 내용 · 요약 — 네 번에 나눠 씁니다.' },
  claims: { n: 5, title: '청구항', icon: <BookOpenCheck aria-hidden="true" className="size-5" />, run: '청구항 써줘', again: '청구항 다시', help: '시스템 독립항 · 종속항 · 방법 독립항. 조사에서 나온 차별화를 독립항에 넣습니다.' },
  check: { n: 6, title: '점검 · 내보내기', icon: <ShieldCheck aria-hidden="true" className="size-5" />, run: '점검대로 고쳐줘', again: '한 번 더 고쳐줘', help: '특허로 편집기 기준 점검(규칙 계산) → 걸린 글만 AI 가 고칩니다. 다 되면 MD · 제출 묶음을 받으세요.' },
}

const CARDS: AgentCard[] = ['idea', 'research', 'parts', 'body', 'claims', 'check']

const PHASE_TONE: Record<StageRow['phase'], string> = { wait: 'text-slate-500', run: 'text-violet-800', done: 'text-success-700', fail: 'text-danger-700', skip: 'text-slate-600' }

function PhaseIcon({ phase }: { phase: StageRow['phase'] }) {
  if (phase === 'run') return <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-violet-700" />
  if (phase === 'done') return <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" />
  if (phase === 'fail') return <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
  return <Circle aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
}

export function SpecAiBoard({
  draftId,
  d,
  act,
  apply,
  record,
  others,
  today,
  onEdit,
  onDownload,
  onPack,
  packing,
}: {
  draftId: string
  d: SpecDraft
  act: Act
  apply: (fn: (cur: SpecDraft) => SpecDraft) => Promise<void>
  record: ClientOpsRecord | null
  others: string[]
  today: string
  onEdit: (s: DraftStep) => void
  onDownload: () => void
  onPack: () => void
  packing: boolean
}) {
  const { showToast } = useToast()
  useSyncExternalStore(subscribeSpecRun, specRunVersion)
  const run = specRun(draftId)
  const repo = useOwnerAiRepo()
  const [caseMats, setCaseMats] = useState<AgentCompany['materials']>([])
  const [priorIdeas, setPriorIdeas] = useState<string[]>([])
  const [reading, setReading] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const clientId = record?.id ?? ''

  // AI 작업실 — 이 회사와 이어진 작업실의 자료 · '특허 아이디어' 결과를 재료로(실패하면 없이)
  useEffect(() => {
    if (!clientId) return
    let alive = true
    void (async () => {
      try {
        const cases = (await repo.listCases()).filter((c) => c.clientId === clientId)
        const mats = cases.flatMap((c) => c.materials.filter((m) => !m.excluded && m.text.trim()).map((m) => ({ title: m.title, kind: 'AI 작업실 자료', text: m.text })))
        const ideas: string[] = []
        for (const c of cases.slice(0, 2)) {
          for (const r of await repo.listRuns(c.id)) {
            if (r.skillId !== 'PATENT_IDEA') continue
            const list = (r.structured as { ideas?: { title?: string; coreIdea?: string }[] } | null)?.ideas
            if (Array.isArray(list)) for (const it of list) if (it?.title) ideas.push(`${it.title}${it.coreIdea ? ` — ${it.coreIdea}` : ''}`)
          }
        }
        if (alive) {
          setCaseMats(mats.slice(0, 6))
          setPriorIdeas(ideas.slice(0, 6))
        }
      } catch {
        /* 작업실을 못 읽어도 회사 기록 · 올린 자료로 쓴다 */
      }
    })()
    return () => {
      alive = false
    }
  }, [repo, clientId])

  const facts = useMemo(() => companyFactLines(record), [record])
  const company: AgentCompany = useMemo(
    () => ({ name: record?.companyName ?? '', facts, materials: [...d.materials.map((m) => ({ title: m.title, kind: m.kind, text: m.text })), ...caseMats].slice(0, 6), priorIdeas }),
    [record, facts, d.materials, caseMats, priorIdeas],
  )

  const busy = run.running
  const start = (stages: AgentStage[], forceParts = false) => {
    if (!startSpecRun(draftId, stages, { company, others, today, forceParts })) showToast('지금 쓰는 중입니다 — 끝나면 다시 눌러 주세요')
  }
  const all = () => {
    const plan = planAll(d)
    start(plan)
    showToast(`AI 가 ${plan.length}단계를 차례로 씁니다 — 이 화면을 떠나도 계속 씁니다`)
  }
  const runCard = (card: AgentCard) => {
    if (card === 'parts' && partsHuman(d) && !window.confirm('직접 고치신 구성요소 · 단계가 있습니다. AI 가 새로 써서 바꿀까요? (바꾼 뒤 되돌리기로 살릴 수 있어요)')) return
    start(CARD_STAGES[card], card === 'parts')
  }

  const pickIdea = (pick: IdeaPick) => {
    if (pick.title === d.title) return
    if (hasLaterWork(d) && !window.confirm('다른 아이디어로 바꾸면 지금 구성 · 본문 · 청구항은 새로 써야 합니다. 바꿀까요? (되돌리기로 살릴 수 있어요)')) return
    act(`'${pick.title}' 로 바꿨습니다 — [전부 써줘] 로 이어서 쓰세요`, (cur) => applyIdea(hasLaterWork(cur) ? clearAfterIdea(cur) : cur, pick))
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MATERIAL_MAX - d.materials.length
    if (room <= 0) {
      showToast(`자료는 ${MATERIAL_MAX}개까지 — 앞 자료를 빼고 넣어 주세요`)
      return
    }
    const got: SpecDraft['materials'] = []
    for (const f of Array.from(files).slice(0, room)) {
      setReading(`${f.name} 읽는 중…`)
      try {
        let text = ''
        if (/\.hwpx$/i.test(f.name)) {
          const doc = await parseSpecFile(f.name, new Uint8Array(await f.arrayBuffer()))
          text = doc.paras.map((p) => p.text).join('\n')
        } else if (canExtractText(f)) text = (await extractTextFromFile(f, (_p, label) => setReading(`${f.name} · ${label}`))).text
        else if (/^text\//.test(f.type) || /\.(txt|md|csv)$/i.test(f.name)) text = await f.text()
        const clean = safeText(text, personNames(record ?? ({} as ClientOpsRecord)), MATERIAL_CHARS)
        if (clean.length >= 20) got.push({ title: f.name.slice(0, 80), kind: '올린 자료', text: clean, at: new Date().toISOString() })
        else showToast(`${f.name} — 글자를 읽지 못했습니다(그림 · 스캔이면 PDF 로 다시)`)
      } catch {
        showToast(`${f.name} — 읽지 못했습니다`)
      }
    }
    setReading('')
    if (got.length) {
      await apply((cur) => ({ ...cur, materials: [...cur.materials, ...got].slice(0, MATERIAL_MAX) }))
      showToast(`자료 ${got.length}개를 재료로 넣었습니다 — 읽은 글만 남기고 원본 파일은 저장하지 않습니다`)
    }
  }

  const errs = checkDraft(d).filter((i) => i.level === 'error')
  const stagesShown = (Object.keys(run.stages) as AgentStage[]).sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b))
  const doneCards = CARDS.filter((c) => cardState(c, d).done).length

  return (
    <div className="flex flex-col gap-4" data-testid="spec-board" data-busy={busy ? 'yes' : 'no'}>
      <Surface>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Sparkles className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="t-section font-bold break-keep text-slate-900">AI 가 처음부터 끝까지 씁니다</h3>
              <p className="t-sub break-keep text-slate-700">
                회사 기록 · 자료 · <b className="font-semibold">미래AI랩 기준 문서(Master v2.9 · AX펭귄)</b>로 씁니다. 타자 칠 칸은 없습니다 — 결과를 보고 고르기만 하세요.
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-1.5" data-testid="spec-board-sources">
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{record ? `${record.companyName} 기록 ${facts.length}줄` : '회사 고르지 않음'}</li>
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">AI 작업실 자료 {caseMats.length}개</li>
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700" data-testid="spec-board-mats">올린 자료 {d.materials.length}개</li>
          </ul>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="primary" className="min-h-12 sm:min-w-56" disabled={busy} onClick={all} data-testid="spec-board-all">
              {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-5" />}
              {busy ? 'AI 가 쓰는 중…' : doneCards >= 5 ? '빠진 곳 전부 다시 써줘' : '전부 써줘'}
            </Button>
            <Button variant="secondary" disabled={!!reading} onClick={() => fileRef.current?.click()} data-testid="spec-board-file">
              <Upload aria-hidden="true" className="size-4" /> {reading || '자료 넣기(선택)'}
            </Button>
            <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.hwpx,.txt,.md,.xlsx,.png,.jpg,.jpeg" onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ''
            }} data-testid="spec-board-file-input" />
          </div>
          <p className="t-meta break-keep text-slate-500">한 번에 4~5분쯤 · 화면을 떠나도 계속 씁니다 · 직접 고치신 글은 덮지 않고 새 안으로 둡니다. 누르면 이 내용이 고른 AI 회사로 갑니다(출원 전 발명).</p>

          {stagesShown.length > 0 && (
            <ol className="flex flex-col gap-1 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-2" data-testid="spec-board-rows" aria-live="polite">
              {stagesShown.map((k) => {
                const r = run.stages[k]!
                return (
                  <li key={k} className="flex items-start gap-2" data-testid="spec-board-row" data-stage={k} data-phase={r.phase}>
                    <PhaseIcon phase={r.phase} />
                    <p className="t-sub min-w-0 break-keep text-slate-800">
                      <b className="font-semibold">{stageOf(k).label}</b> <span className={PHASE_TONE[r.phase]}>· {r.text}</span>
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
          {run.asks.length > 0 && (
            <div className="flex flex-col gap-1 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="spec-board-asks">
              <p className="t-sub font-semibold text-warning-900">AI 가 확인해 달라는 점</p>
              <ul className="flex flex-col gap-0.5">
                {run.asks.map((a) => (
                  <li key={a.key} className="t-sub break-keep text-slate-800">
                    <b className="font-semibold">{a.key}</b> · {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Surface>

      <div className="grid gap-3 lg:grid-cols-2">
        {CARDS.map((card) => {
          const meta = CARD_META[card]
          const st = cardState(card, d)
          const stageRows = CARD_STAGES[card].map((k) => run.stages[k]).filter(Boolean) as StageRow[]
          const live = stageRows.find((r) => r.phase === 'run') ?? stageRows.find((r) => r.phase === 'fail')
          const why = stageBlock(CARD_STAGES[card][0], d)
          const blocked = why.startsWith('아이디어') ? '아이디어부터' : why ? '구성부터' : ''
          return (
            <Surface key={card}>
              <section className="flex h-full flex-col gap-2.5" data-testid="spec-card" data-card={card} data-done={st.done ? 'yes' : 'no'} aria-labelledby={`spec-card-${card}`}>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${st.done ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-600'}`}>
                    {st.done ? <CheckCircle2 className="size-5" /> : meta.icon}
                  </span>
                  <h4 id={`spec-card-${card}`} className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">
                    {meta.n}. {meta.title}
                  </h4>
                  {st.human && <span className="t-meta shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">직접 고친 글 있음</span>}
                </div>
                <p className="t-meta break-keep text-slate-500">{meta.help}</p>

                <CardBody card={card} d={d} onPick={pickIdea} errs={errs.length} />

                {live && (
                  <p className={`t-sub flex items-center gap-1.5 break-keep ${PHASE_TONE[live.phase]}`} data-testid="spec-card-live">
                    <PhaseIcon phase={live.phase} /> {live.text}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button variant={st.done ? 'secondary' : 'primary'} size="sm" disabled={busy || !!blocked} onClick={() => runCard(card)} data-testid="spec-card-run" data-card={card} title={blocked || undefined}>
                    <Sparkles aria-hidden="true" className="size-4" /> {blocked ? `${meta.run} (${blocked})` : st.done ? meta.again : meta.run}
                  </Button>
                  {card === 'check' ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={onDownload} data-testid="spec-board-download">
                        <Download aria-hidden="true" className="size-4" /> MD 내려받기
                      </Button>
                      <Button variant="secondary" size="sm" disabled={packing} onClick={onPack} data-testid="spec-board-pack">
                        {packing ? '묶는 중…' : '제출 준비 묶음(ZIP)'}
                      </Button>
                    </>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(EDIT_STEP[card])} data-testid="spec-card-edit" data-card={card}>
                    <PenLine aria-hidden="true" className="size-4" /> {card === 'check' ? '점검 자세히' : '직접 고치기'}
                  </Button>
                </div>
              </section>
            </Surface>
          )
        })}
      </div>
    </div>
  )
}

const STAGE_ORDER: AgentStage[] = ['idea', 'research', 'parts', 'a', 'b', 'c', 'd', 'e', 'fix']
const EDIT_STEP: Record<AgentCard, DraftStep> = { idea: 'idea', research: 'idea', parts: 'parts', body: 'body', claims: 'claims', check: 'check' }

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function CardBody({ card, d, onPick, errs }: { card: AgentCard; d: SpecDraft; onPick: (p: IdeaPick) => void; errs: number }) {
  switch (card) {
    case 'idea':
      return (
        <div className="flex flex-col gap-2">
          {d.title.trim() ? (
            <div className="rounded-(--radius-control) border border-violet-300 bg-violet-50 px-3 py-2" data-testid="spec-board-title">
              <p className="t-meta font-semibold text-violet-800">
                {d.ideas[0]?.title === d.title && <span className="mr-1 rounded-full bg-violet-600 px-1.5 py-0.5 font-bold text-white">추천</span>}
                지금 쓰는 아이디어
              </p>
              <p className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{titleLine(d)}</p>
              {d.idea.problem && <p className="t-sub break-keep text-slate-600">문제 · {clip(d.idea.problem, 120)}</p>}
            </div>
          ) : (
            <p className="t-sub break-keep text-slate-600">아직 아이디어가 없습니다 — [아이디어 내줘] 를 누르세요.</p>
          )}
          {d.ideas.some((p) => p.title !== d.title) && (
            <p className="t-meta font-semibold text-slate-600">다른 후보 — 누르면 그걸로 바뀝니다</p>
          )}
          {d.ideas.some((p) => p.title !== d.title) && (
            <ul className="flex flex-col gap-1.5" data-testid="spec-ideas">
              {d.ideas.map((p, i) => {
                if (p.title === d.title) return null
                return (
                  <li key={`${p.title}-${i}`} className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-2 sm:flex-row sm:items-center" data-testid="spec-idea" data-current="no">
                    <div className="min-w-0 flex-1">
                      <p className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">
                        {i === 0 && <span className="t-meta mr-1 rounded-full bg-violet-600 px-1.5 py-0.5 font-bold text-white">추천</span>}
                        {p.title}
                      </p>
                      {p.why && <p className="t-meta break-keep text-slate-600">{clip(p.why, 140)}</p>}
                    </div>
                    <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => onPick(p)} data-testid="spec-idea-use">
                      이걸로 <ArrowRight aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )
    case 'research': {
      const r = d.research
      if (!r) return <p className="t-sub break-keep text-slate-600">아이디어가 정해지면 [조사해줘] — 비슷한 기술 · 차별화 · 위험을 정리합니다.</p>
      const stale = r.forTitle !== d.title
      const words = r.items.find((it) => /검색어/.test(it.tag))
      return (
        <div className="flex flex-col gap-2" data-testid="spec-research">
          {stale && <p className="t-meta break-keep text-warning-800">명칭이 바뀌어 예전 조사입니다 — [다시 조사] 하세요.</p>}
          {r.headline && <p className="t-sub font-semibold break-keep text-slate-900">{r.headline}</p>}
          <span className={`t-meta self-start rounded-full px-2 py-0.5 font-semibold ${r.grounded ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-900'}`} data-testid="spec-research-grounded" data-grounded={r.grounded ? 'yes' : 'no'}>
            {r.grounded ? `검색 근거 ${r.sources.length}곳` : 'AI 가 아는 범위 — KIPRIS 에서 확인 필요'}
          </span>
          <ul className="flex flex-col gap-1">
            {r.items.filter((it) => it !== words).slice(0, 5).map((it, i) => (
              <li key={i} className="t-sub break-keep text-slate-800">
                <b className="font-semibold">{it.tag || '메모'}</b> · {it.title}
                {it.detail ? <span className="text-slate-600"> — {clip(it.detail, 140)}</span> : null}
              </li>
            ))}
          </ul>
          {words && words.outline.length > 0 && (
            <p className="t-meta break-keep rounded-(--radius-control) bg-slate-50 px-2.5 py-1.5 text-slate-700" data-testid="spec-research-words">
              KIPRIS 검색어 · {words.outline.join(' / ')}
            </p>
          )}
          {r.sources.length > 0 && (
            <ul className="flex flex-col gap-0.5" data-testid="spec-research-sources">
              {r.sources.slice(0, 5).map((s) => (
                <li key={s.url} className="t-meta min-w-0">
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-brand-700 underline [overflow-wrap:anywhere]">
                    <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" /> {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    case 'parts': {
      const comps = d.components.filter((c) => c.name.trim())
      if (!comps.length) return <p className="t-sub break-keep text-slate-600">아이디어가 정해지면 [구성 써줘] — 구성요소 · 단계 · 종속항을 한 번에.</p>
      return (
        <div className="flex flex-col gap-1.5" data-testid="spec-board-parts">
          <ul className="flex flex-col gap-0.5">
            {comps.slice(0, 7).map((c) => (
              <li key={c.no} className="t-sub break-keep text-slate-800">
                <b className="font-semibold">
                  {c.name}({c.no})
                </b>{' '}
                <span className="text-slate-600">— {clip(c.does, 70)}</span>
              </li>
            ))}
          </ul>
          <p className="t-meta break-keep text-slate-600">
            단계 {d.steps.filter((s) => s.text.trim()).length}개 · 종속항 씨앗 {d.seeds.length}개 · 도면 {d.figures.length}장({d.figures.slice(0, 2).map((f) => `도 ${f.n} ${clip(figureSubject(d, f), 24)}`).join(' · ')}…)
          </p>
        </div>
      )
    }
    case 'body': {
      return (
        <ul className="flex flex-wrap gap-1.5" data-testid="spec-board-body">
          {SECTION_KEYS.map((k) => {
            const has = !!(d.text[k] ?? '').trim()
            return (
              <li key={k} className={`t-meta rounded-full px-2 py-0.5 font-semibold ${has ? 'bg-success-100 text-success-800' : 'bg-slate-100 text-slate-600'}`} data-has={has ? 'yes' : 'no'}>
                {has ? '✓ ' : ''}
                {SECTION_LABEL[k]}
              </li>
            )
          })}
        </ul>
      )
    }
    case 'claims': {
      const cs = claimsOf(d)
      if (!d.claims.length) return <p className="t-sub break-keep text-slate-600">{cs.length ? `규칙 뼈대 ${cs.length}개 — [청구항 써줘] 로 다듬습니다.` : '구성이 정해지면 [청구항 써줘].'}</p>
      return (
        <div className="flex flex-col gap-1" data-testid="spec-board-claims">
          <p className="t-sub font-semibold text-slate-900">청구항 {d.claims.length}개</p>
          <p className="t-meta break-keep text-slate-600">청구항 1 · {clip(d.claims[0], 150)}</p>
        </div>
      )
    }
    case 'check':
      return (
        <div className="flex flex-col gap-1" data-testid="spec-board-check" data-errors={errs}>
          <p className={`t-sub font-semibold break-keep ${errs ? 'text-danger-700' : 'text-success-700'}`}>{errs ? `고쳐야 할 것 ${errs}개 (규칙 점검)` : '고쳐야 할 것 없음 — 내려받아 특허로 편집기에 붙이세요'}</p>
          <p className="t-meta break-keep text-slate-500">점검은 규칙 계산입니다. 편집기 통과를 보장하지는 않습니다.</p>
        </div>
      )
  }
}
