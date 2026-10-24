/**
 * 업체 작업실(Company Case) — /ai/cases/:caseId 와 업체 상세 'AI 전략실' 탭이 같은 부품을 쓴다.
 *
 * 흐름: 생성(빠른 작업) → 판단(채택 · 일부 채택 · 폐기) → 기록(기억 새 판 · 수정 이력 · 타임라인) → 재사용(다음 작업의 맥락).
 * 저장은 모두 덧붙이기 — 기억 · 실행 · 수정 이력은 지우거나 덮지 않는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ExternalLink } from 'lucide-react'
import { AiCallError } from '../../services/ownerAi/aiClient'
import { caseSnapshot } from '../../services/ownerAi/context'
import { caseDocs, docsNotIn } from '../../services/ownerAi/caseDocs'
import { factsFromExtract, newUuid, withCaseActivity } from '../../services/ownerAi/caseUtil'
import { applyContext } from '../../services/ownerAi/memory'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import { skillName } from '../../services/ownerAi/skillCatalog'
import { CASE_RELATIONS, RELATION_LABEL, emptyContext, type AiRun, type CaseRelation, type CurrentContext, type Evaluation, type SkillId } from '../../services/ownerAi/types'
import { evaluate, latestSnapshot, loadBundle, pasteChatGpt, patchCase, runSkill, saveContext, saveRevision, type CaseBundle } from '../../services/ownerAi/workflow'
import { todayLocalDate } from '../../lib/appClock'
import { useToast } from '../../components/ui/toastContext'
import { Badge, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { AiSetupBanner, fmtDateTime, useAiSetup, useFindClient, useOwnerAiIdentity, useOwnerAiRepo } from './shared'
import { SnapshotCard } from './parts/SnapshotCard'
import { QuickActions, type RunRequest } from './parts/QuickActions'
import { RunCard } from './parts/RunCard'
import { MemoryCard, MemoryEditor } from './parts/MemoryCard'
import { MaterialsCard } from './parts/MaterialsCard'

type Phase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'missing' } | { kind: 'db_setup' } | { kind: 'error'; message: string }

export function CaseWorkspace({ caseId, embedded = false }: { caseId: string; embedded?: boolean }) {
  const repo = useOwnerAiRepo()
  const findClient = useFindClient()
  const { userId } = useOwnerAiIdentity()
  const { showToast } = useToast()
  const { setup } = useAiSetup()
  const today = todayLocalDate()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [bundle, setBundle] = useState<CaseBundle | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [memoryApply, setMemoryApply] = useState<null | { run: AiRun; proposed: CurrentContext }>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [showOld, setShowOld] = useState(false)
  // AI-2 첫 화면 [서류 넣기] → 업체 자료의 서류함 창(숫자가 바뀔 때마다 연다)
  const [docsOpen, setDocsOpen] = useState(0)

  const load = useCallback(async () => {
    try {
      const b = await loadBundle(repo, caseId, findClient)
      if (!b) {
        setPhase({ kind: 'missing' })
        return
      }
      setBundle(b)
      setPhase({ kind: 'ready' })
    } catch (e) {
      if (e instanceof OwnerAiSetupError) setPhase({ kind: 'db_setup' })
      else setPhase({ kind: 'error', message: e instanceof Error ? e.message : '불러오지 못했습니다.' })
    }
  }, [repo, caseId, findClient])

  useEffect(() => {
    void load()
  }, [load])

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : '저장하지 못했습니다. 다시 시도해 주세요.')

  /** 저장 하나씩(두 번 눌림 · 겹침 막기) */
  const guard = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (saving) return null
    setSaving(true)
    try {
      return await fn()
    } catch (e) {
      fail(e)
      return null
    } finally {
      setSaving(false)
    }
  }

  const currentContext = useMemo(() => (bundle ? latestSnapshot(bundle)?.content ?? emptyContext() : emptyContext()), [bundle])
  const newDocs = useMemo(() => (bundle?.client ? docsNotIn(caseDocs(bundle.client), bundle.c.materials).length : 0), [bundle])
  const snapshotFields = useMemo(() => (bundle ? caseSnapshot(bundle.c, bundle.client, currentContext, bundle.runs, today) : []), [bundle, currentContext, today])

  if (phase.kind === 'loading') return <p className="t-sub text-slate-500" role="status">AI 전략실을 여는 중…</p>
  if (phase.kind === 'missing')
    return (
      <Surface>
        <p className="t-body text-slate-700">이 업체 작업실을 찾지 못했습니다.</p>
        <Link to="/ai" className="t-body tap mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700">AI 전략실 목록으로</Link>
      </Surface>
    )
  if (phase.kind === 'db_setup')
    return (
      <Surface>
        <p className="t-body font-semibold text-slate-900" data-testid="owner-ai-db-setup">AI 전략실을 쓰려면 관리자 설정이 한 번 필요합니다.</p>
        {/* AI-1 개발자 말은 접어 둔다(대표 · 관리자만 펼쳐 봄) */}
        <details className="t-sub mt-1 text-slate-600">
          <summary className="tap cursor-pointer font-semibold">관리자용 자세히</summary>
          <p className="mt-1 break-keep">Supabase 에 0021 마이그레이션을 실행하면 열립니다(docs/OWNER_AI_WORKSPACE_V1.md).</p>
        </details>
      </Surface>
    )
  if (phase.kind === 'error' || !bundle)
    return (
      <Surface>
        <p className="t-body text-danger-700" role="alert">{phase.kind === 'error' ? phase.message : '불러오지 못했습니다.'}</p>
        <Button className="mt-2" onClick={() => void load()}>다시 불러오기</Button>
      </Surface>
    )

  const b = bundle
  const aiReady = setup.state === 'ready'

  const doRun = async (req: RunRequest): Promise<boolean> => {
    if (running) return false
    setRunning(req.label)
    try {
      const { run, c, replayed } = await runSkill({ repo, bundle: b, skill: req.skill, input: req.input, requestId: req.requestId, today, userId, materialIds: req.materialIds })
      setBundle((prev) => (prev ? { ...prev, c, runs: [run, ...prev.runs.filter((r) => r.id !== run.id)] } : prev))
      showToast(replayed ? '같은 요청이라 앞서 만든 결과를 그대로 보여 드립니다.' : run.status === 'parse_fallback' ? `${req.label} — 형식이 달라 원문을 보관했습니다.` : `${req.label} 결과가 나왔습니다. 채택 · 일부 채택 · 폐기 중 골라 주세요.`)
      return true
    } catch (e) {
      // NX-2 같은 오류가 되풀이되면 관리자가 서버 기록을 찾을 수 있게 문의 번호(요청 번호 끝 6자리)
      const ref = ['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'rate_limited'].includes(e instanceof AiCallError ? e.code : '') ? '' : ` · 문의 번호 ${req.requestId.slice(-6)}`
      if (e instanceof AiCallError) showToast(e.retryAfter ? `${e.message} (${e.retryAfter}초 뒤)` : `${e.message}${ref}`)
      else fail(e)
      return false
    } finally {
      setRunning(null)
    }
  }

  // D-219: 자료를 고르지 않는 작업은 작업마다 정한 자료를 보낸다(undefined) — 예전엔 빈 목록 [] 을 '이것만' 으로 읽어
  // '자료 요약 · 업체 정보 채우기' 가 올린 자료를 하나도 보내지 않았다
  const runInternal = (skill: SkillId, label: string, input: RunRequest['input'] = {}) => doRun({ skill, label, input, requestId: newUuid() })

  const onEvaluate = (run: AiRun) => async (evaluation: Evaluation, note: string, part: unknown) => {
    const r = await guard(() => evaluate(repo, b, run, evaluation, note, part, currentContext))
    if (!r) return false
    let c = r.c
    // 자료 요약을 채택하면 자료에 있던 값만 업체 정보 칸으로(이미 적힌 칸은 덮지 않는다)
    if (run.skillId === 'SNAPSHOT_EXTRACT' && (evaluation === 'adopted' || evaluation === 'partially_adopted')) {
      const fresh = await guard(() => patchCase(repo, c, (x) => ({ ...x, facts: factsFromExtract(run.structured, x.facts, new Date().toISOString()) })))
      if (fresh) c = fresh
    }
    setBundle((prev) => (prev ? { ...prev, c, runs: prev.runs.map((x) => (x.id === run.id ? r.run : x)) } : prev))
    showToast(`${skillName(run.skillId)} — ${evaluation === 'rejected' ? '폐기했습니다(기록은 남습니다).' : evaluation === 'adopted' ? "채택했습니다. '기억에 넣기' 로 다음 작업에 이어 쓸 수 있습니다." : '일부 채택했습니다.'}`)
    if (Object.keys(r.proposal).length) setMemoryApply({ run: r.run, proposed: applyContext(currentContext, r.proposal) })
    return true
  }

  const onRevise = (run: AiRun) => async (text: string, note: string) => {
    const r = await guard(() => saveRevision(repo, b, run, text, note))
    if (!r) return false
    setBundle((prev) => {
      if (!prev) return prev
      const m = new Map(prev.latestRevision)
      m.set(run.id, r.rev)
      return { ...prev, c: r.c, latestRevision: m }
    })
    showToast('고친 글을 저장했습니다(원래 결과도 그대로 남습니다).')
    return true
  }

  const toMemory = (run: AiRun) => {
    // 채택 뒤 다시 누를 때 — 같은 규칙으로 제안을 다시 만든다
    void (async () => {
      const { proposeFromRun } = await import('../../services/ownerAi/memory')
      const rev = b.latestRevision.get(run.id)?.content
      const p = proposeFromRun(run, currentContext, rev)
      if (!Object.keys(p).length) {
        showToast('기억에 새로 넣을 내용이 없습니다(이미 같은 글이 있습니다). 직접 고치기로 적어 주세요.')
        return
      }
      setMemoryApply({ run, proposed: applyContext(currentContext, p) })
    })()
  }

  const saveMemory = async (content: CurrentContext, source: string, note: string): Promise<boolean> => {
    const r = await guard(() => saveContext(repo, b, content, source, note))
    if (!r) return false
    setBundle((prev) => (prev ? { ...prev, c: r.c, snapshots: [...prev.snapshots, r.snap] } : prev))
    showToast(`업체 기억 v${r.snap.version} 저장 — 예전 판은 그대로 남습니다.`)
    return true
  }

  const setRelation = async (relation: CaseRelation) => {
    const c = await guard(() => patchCase(repo, b.c, (x) => withCaseActivity({ ...x, relation }, `관계 상태 → ${RELATION_LABEL[relation]}`, new Date().toISOString())))
    if (c) setBundle((prev) => (prev ? { ...prev, c } : prev))
  }

  const archive = async () => {
    const c = await guard(() => patchCase(repo, b.c, (x) => withCaseActivity({ ...x, archivedAt: x.archivedAt ? null : new Date().toISOString() }, x.archivedAt ? '보관 풀기' : '보관(목록에서 숨김 · 기록은 그대로)', new Date().toISOString())))
    if (c) setBundle((prev) => (prev ? { ...prev, c } : prev))
  }

  // 맞춤법 검사는 제안서 스튜디오 안에서 쓰는 것 — 결과 목록에는 안 보인다(기록 · 사용량에는 남는다)
  const recentRuns = b.runs.filter((r) => r.skillId !== 'PROOFREAD' && (r.skillId !== 'CONTEXT_UPDATE' || r.evaluation === 'draft'))
  const shownRuns = showOld ? recentRuns : recentRuns.slice(0, 8)

  return (
    <div className="flex flex-col gap-4" data-testid="case-workspace" data-case={b.c.id}>
      {/* 머리 — 업체 · 관계 · 이어 둔 고객 */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!embedded && <h1 className="t-page min-w-0 break-words text-slate-900" data-testid="case-title">{b.c.companyName}</h1>}
          <label className="flex items-center gap-1.5">
            <span className="sr-only">관계 상태</span>
            <select
              value={b.c.relation}
              onChange={(e) => void setRelation(e.target.value as CaseRelation)}
              disabled={saving}
              className="t-sub min-h-11 rounded-full border border-slate-300 bg-white px-3 font-semibold text-slate-700"
              data-testid="case-relation"
            >
              {CASE_RELATIONS.map((r) => (
                <option key={r} value={r}>{RELATION_LABEL[r]}</option>
              ))}
            </select>
          </label>
          {b.c.archivedAt && <Badge tone="warning">보관됨</Badge>}
          {b.c.origin.startsWith('partner:') && <Badge tone="brand">Partner OS 요청</Badge>}
        </div>
        <div className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
          {b.c.requester && <span>요청 {b.c.requester}</span>}
          {b.client ? (
            !embedded && (
              <Link to={`/ops/clients/${b.client.id}`} className="tap inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid="case-client-link">
                고객 관리에서 보기
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            )
          ) : (
            <span>고객 관리와 아직 잇지 않음</span>
          )}
          {embedded ? (
            <Link to={`/ai/cases/${b.c.id}`} className="tap inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline">
              AI 전략실 크게 보기
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>
          ) : (
            <button type="button" onClick={() => void archive()} disabled={saving} className="tap inline-flex min-h-11 items-center gap-1 text-slate-500 hover:text-slate-800">
              <Archive aria-hidden="true" className="size-4" />
              {b.c.archivedAt ? '보관 풀기' : '보관'}
            </button>
          )}
        </div>
      </div>

      <AiSetupBanner setup={setup} />
      <SnapshotCard fields={snapshotFields} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <QuickActions bundle={b} today={today} running={running} setup={setup} onRun={doRun} onPaste={() => setPasteOpen(true)} docsHint={newDocs} onDocs={() => setDocsOpen((n) => n + 1)} />
          <section className="flex flex-col gap-3" aria-label="AI 결과">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="t-section text-slate-900">결과</h2>
              <span className="t-sub text-slate-500">{b.runs.length}개 · 지우지 않고 쌓입니다</span>
            </div>
            {recentRuns.length === 0 ? (
              <p className="t-sub rounded-(--radius-panel) border border-dashed border-slate-200 bg-white px-4 py-6 text-center break-keep text-slate-500">
                아직 결과가 없습니다. 위 '추천' 단추를 누르면 여기에 결과가 쌓입니다.
              </p>
            ) : (
              <div className="flex flex-col gap-3" data-testid="run-list">
                {shownRuns.map((run, i) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    revision={b.latestRevision.get(run.id)}
                    defaultOpen={i === 0 && run.evaluation === 'draft'}
                    busy={saving || !!running}
                    onEvaluate={onEvaluate(run)}
                    onRevise={onRevise(run)}
                    onToMemory={() => toMemory(run)}
                    toast={showToast}
                  />
                ))}
                {recentRuns.length > shownRuns.length && (
                  <Button variant="ghost" onClick={() => setShowOld(true)}>
                    지난 결과 {recentRuns.length - shownRuns.length}개 더 보기
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MemoryCard
            snapshots={b.snapshots}
            busy={saving || !!running}
            aiReady={aiReady}
            onSave={saveMemory}
            onAiTidy={() => void runInternal('CONTEXT_UPDATE', '기억 정리')}
          />
          <MaterialsCard
            openDocs={docsOpen}
            materials={b.c.materials}
            client={b.client}
            busy={saving || !!running}
            aiReady={aiReady}
            toast={showToast}
            onSummarize={() => void runInternal('SNAPSHOT_EXTRACT', '자료 요약')}
            onAdd={async (list, note) => {
              const c = await guard(() => patchCase(repo, b.c, (x) => withCaseActivity({ ...x, materials: [...list, ...x.materials].slice(0, 200) }, note, new Date().toISOString())))
              if (c) {
                setBundle((prev) => (prev ? { ...prev, c } : prev))
                const excluded = list.filter((m) => m.excluded).length
                showToast(excluded ? `${note} — ${excluded}개는 명부(개인별 원문)라 AI 에 보내지 않습니다.` : `${note}.`)
              }
              return !!c
            }}
            onToggleExclude={async (id, excluded) => {
              const c = await guard(() =>
                patchCase(repo, b.c, (x) => ({ ...x, materials: x.materials.map((m) => (m.id === id ? (excluded ? { ...m, excluded } : (({ excluded: _drop, ...rest }) => rest)(m)) : m)) })),
              )
              if (c) setBundle((prev) => (prev ? { ...prev, c } : prev))
            }}
          />
          <TimelineCard activity={b.c.activity} />
        </div>
      </div>

      {memoryApply && (
        <MemoryEditor
          title={`기억에 넣기 — ${skillName(memoryApply.run.skillId)}`}
          current={currentContext}
          proposed={memoryApply.proposed}
          busy={saving}
          note={`${skillName(memoryApply.run.skillId)} v${memoryApply.run.skillVersion} 채택`}
          onClose={() => setMemoryApply(null)}
          onSave={async (content, note) => {
            if (await saveMemory(content, `run:${memoryApply.run.id}`, note)) setMemoryApply(null)
          }}
        />
      )}
      {pasteOpen && (
        <PasteDialog
          busy={saving}
          onClose={() => setPasteOpen(false)}
          onSave={async (skill, text) => {
            const r = await guard(() => pasteChatGpt(repo, b, skill, text, userId))
            if (!r) return
            setBundle((prev) => (prev ? { ...prev, c: r.c, runs: [r.run, ...prev.runs] } : prev))
            setPasteOpen(false)
            showToast('ChatGPT 결과를 기록했습니다. 채택하면 기억에 넣을 수 있습니다.')
          }}
        />
      )}
    </div>
  )
}

function TimelineCard({ activity }: { activity: CaseBundle['c']['activity'] }) {
  const [all, setAll] = useState(false)
  const list = all ? activity : activity.slice(0, 8)
  return (
    <Surface className="flex flex-col gap-2">
      <h2 className="t-section text-slate-900">타임라인</h2>
      {activity.length === 0 ? (
        <p className="t-sub text-slate-500">아직 기록이 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-2" data-testid="case-timeline">
          {list.map((a) => (
            <li key={a.id} className="flex flex-col">
              <span className="t-meta text-slate-600">{fmtDateTime(a.at)}</span>
              <span className="t-sub break-words text-slate-700">{a.text}</span>
            </li>
          ))}
        </ol>
      )}
      {activity.length > list.length && (
        <button type="button" onClick={() => setAll(true)} className="t-sub tap min-h-11 self-start font-semibold text-brand-700">
          {activity.length - list.length}개 더 보기
        </button>
      )}
    </Surface>
  )
}

const PASTE_SKILLS: SkillId[] = ['AX_PENGUIN', 'AX_IDEA', 'AX_MVP', 'SANGHO_PROPOSAL', 'PATENT_IDEA', 'VENTURE_PLAN', 'FUNDING_STRATEGY', 'CONSULTANT_MESSAGE', 'FREE_CHAT']

function PasteDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (skill: SkillId, text: string) => Promise<void> }) {
  const [skill, setSkill] = useState<SkillId>('AX_PENGUIN')
  const [text, setText] = useState('')
  return (
    <Modal
      open
      size="lg"
      title="ChatGPT 결과 붙여넣기"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || !text.trim()} onClick={() => onSave(skill, text)} data-testid="paste-save">
            기록으로 남기기
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-500">ChatGPT 에서 만든 결과를 그대로 붙여넣으면 이 업체 결과로 남습니다. 채택하면 기억에 넣어 다음 작업이 이어서 씁니다.</p>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">어떤 작업의 결과인가요?</span>
          <select value={skill} onChange={(e) => setSkill(e.target.value as SkillId)} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="paste-skill">
            {PASTE_SKILLS.map((s) => (
              <option key={s} value={s}>{skillName(s)}</option>
            ))}
          </select>
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} maxLength={30000} placeholder="여기에 붙여넣기" className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="paste-text" />
      </div>
    </Modal>
  )
}


