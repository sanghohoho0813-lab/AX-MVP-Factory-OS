/**
 * D-248 명세서 쓰기 — 대표만(useOwnerAiAccess 'yes' 일 때만 그리고, 서버 /api/ai-assist 가 대표 권한을 다시 본다).
 *
 *   SpecAiPanel     본문 · 청구항 AI 초안 — 다섯 번 차례로(spec.a~e). 받는 대로 저장 · 고친 칸은 덮지 않고 새 안으로 · 못 쓴 묶음만 다시.
 *   IdeaImportPanel AI 작업실 '특허 아이디어' 결과 → 1단계 빈 칸 · 단계 · 종속항 씨앗(이미 적은 칸은 그대로).
 */
import { useEffect, useRef, useState } from 'react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { AssistError, assistMessage, callAssist } from '../../services/aiAssist/client'
import { answerOf } from '../../services/aiAssist/looseJson'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { SECTION_LABEL, cleanAiText, draftFromIdea, mergeSpecAi, type PatentIdeaLike, type SectionKey, type SpecDraft } from '../../services/patent/specDraft'
import { SPEC_BATCHES, buildSpecContext, joinDetail, specItemsOf, type SpecBatch } from '../../services/patent/specDraftAi'
import { useOwnerAiRepo } from '../ownerAi/shared'
import type { CompanyCase } from '../../services/ownerAi/types'

type RowState = { phase: 'wait' | 'run' | 'done' | 'fail'; text: string }
type Merge = { draft: SpecDraft; replaced: string[]; kept: string[] }

/** 이 오류면 다음 묶음도 똑같이 실패한다 — 거기서 멈춘다 */
const STOP_CODES = new Set(['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed', 'provider_auth', 'rate_limited', 'network'])

const KEY_LABEL: Record<string, string> = { ...SECTION_LABEL, claims: '청구항', detail2: '구체적인 내용(뒷부분)' }

export function SpecAiPanel({ d, today, apply, onClose }: { d: SpecDraft; today: string; apply: (fn: (cur: SpecDraft) => Merge) => Promise<Merge>; onClose: () => void }) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [busy, setBusy] = useState(false)
  const [asks, setAsks] = useState<{ key: string; text: string }[]>([])
  const ready = !!d.title.trim() && d.components.filter((c) => c.name.trim()).length >= 2
  // 다섯 번 부르는 동안 화면이 바뀌어도 늘 가장 최근 초안으로
  const dRef = useRef(d)
  dRef.current = d
  const applyRef = useRef(apply)
  applyRef.current = apply

  const setRow = (k: string, r: RowState) => setRows((cur) => ({ ...cur, [k]: r }))

  const runOne = async (key: SpecBatch): Promise<[number, number] | 'stop' | 'fail'> => {
    const b = SPEC_BATCHES.find((x) => x.key === key)!
    setRow(key, { phase: 'run', text: '쓰는 중…(30초쯤)' })
    try {
      const run = await callAssist({ requestId: newRequestId(), assistId: b.assistId, page: 'patent', choice: readChoice(), context: buildSpecContext({ batch: key, draft: dRef.current, today }) })
      const items = specItemsOf(answerOf(run), key)
      if (!items.length) throw new AssistError('provider_error', 'AI 답에서 칸을 찾지 못했습니다 — 다시 눌러 주세요')
      const m = await applyRef.current((cur) => {
        // 구체적인 내용은 앞(c) · 뒤(d) 두 번에 나눠 받아 한 칸으로 잇는다 — 앞 · 뒤를 따로 기억해 다시 받아도 겹치지 않게
        if (key === 'c' || key === 'd') {
          const part = cleanAiText(items[0].text)
          const ai = { ...cur.ai, [key === 'c' ? 'detailFront' : 'detailBack']: part }
          return mergeSpecAi({ ...cur, ai }, [{ key: 'detail', text: joinDetail(ai.detailFront ?? '', ai.detailBack ?? '') }])
        }
        return mergeSpecAi(cur, items.map((i) => ({ key: i.key as SectionKey | 'claims', text: i.text })))
      })
      const got = items.filter((i) => i.note).map((i) => ({ key: i.key === 'detail2' ? 'detail' : i.key, text: i.note! }))
      setAsks((cur) => [...cur.filter((x) => !got.some((g) => g.key === x.key)), ...got])
      setRow(key, { phase: 'done', text: `${m.replaced.length ? `${m.replaced.length}칸 씀` : '바꾼 칸 없음'}${m.kept.length ? ` · 고친 칸 ${m.kept.length}개는 그대로(새 안 따로)` : ''}` })
      return [m.replaced.length, m.kept.length]
    } catch (e) {
      const code = e instanceof AssistError ? e.code : 'save'
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setRow(key, { phase: 'fail', text: why })
      return STOP_CODES.has(code) ? 'stop' : 'fail'
    }
  }

  const runAll = async (keys: SpecBatch[]) => {
    if (busy) return
    setBusy(true)
    let wrote = 0
    let kept = 0
    let failed = 0
    for (const k of keys) setRow(k, { phase: 'wait', text: '차례 기다림' })
    for (const [i, k] of keys.entries()) {
      const r = await runOne(k)
      if (r === 'stop') {
        for (const rest of keys.slice(i + 1)) setRow(rest, { phase: 'wait', text: '멈춤 — 위 오류부터' })
        failed += keys.length - i
        break
      }
      if (r === 'fail') failed += 1
      else {
        wrote += r[0]
        kept += r[1]
      }
    }
    setBusy(false)
    showToast(`AI 초안 — ${wrote}칸 썼습니다${kept ? ` · 고치신 칸 ${kept}개는 그대로 두고 새 안을 칸 아래에` : ''}${failed ? ` · ${failed}묶음은 못 씀(다시 누르기)` : ''}`)
  }

  const failedKeys = SPEC_BATCHES.filter((b) => rows[b.key]?.phase === 'fail').map((b) => b.key)

  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="spec-ai">
        <div className="flex flex-col gap-1">
          <h3 className="t-body font-bold text-slate-900">AI 초안 만들기 · 대표만</h3>
          <p className="t-sub break-keep text-slate-700">
            앞 단계(아이디어 · 권리축 · 구성요소 · 단계 · 도면)만 보고 다섯 번에 나눠 씁니다. 이름 · 부호 · 도면 번호는 정해 둔 그대로 쓰게 했고, <b className="font-semibold">고치신 칸은 덮지 않고 새 안으로 따로</b> 둡니다.
          </p>
          <p className="t-sub break-keep text-warning-800">누르면 위 내용이 고른 AI 회사로 갑니다. 출원 전 발명이므로, 밖으로 보내면 안 되는 경우엔 누르지 마세요.</p>
          {/* D-255 모델 이름만 보이던 줄 → 누르면 고르는 단추(고른 모델은 모든 AI 단추가 같이) */}
          <ModelPicker className="mt-1" />
        </div>
        {!ready ? (
          <p className="t-sub break-keep rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 text-warning-900" data-testid="spec-ai-need">
            명칭(1단계)과 구성요소 2개 이상(2단계)이 있어야 AI 가 지어내지 않습니다 — 먼저 채워 주세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void runAll(SPEC_BATCHES.map((b) => b.key))} data-testid="spec-ai-run">
              {busy ? '쓰는 중…' : '다섯 묶음 모두 쓰기'}
            </Button>
            {failedKeys.length > 0 && !busy && (
              <Button variant="secondary" size="sm" onClick={() => void runAll(failedKeys)} data-testid="spec-ai-retry">
                못 쓴 {failedKeys.length}묶음만 다시
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              닫기
            </Button>
          </div>
        )}
        <ul className="flex flex-col" data-testid="spec-ai-rows">
          {SPEC_BATCHES.map((b) => {
            const r = rows[b.key]
            return (
              <li key={b.key} className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center" data-testid="spec-ai-row" data-key={b.key} data-phase={r?.phase ?? ''}>
                <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                  <b className="font-semibold">{b.label}</b>
                  {r && <span className={`block ${r.phase === 'fail' ? 'text-danger-700' : r.phase === 'done' ? 'text-success-700' : 'text-slate-600'}`}>{r.phase === 'done' ? '✓ ' : r.phase === 'fail' ? '△ ' : ''}{r.text}</span>}
                </p>
                {ready && (
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" disabled={busy} onClick={() => void runAll([b.key])} data-testid="spec-ai-one">
                    {r?.phase === 'done' ? '다시 쓰기' : '이것만 쓰기'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {asks.length > 0 && (
          <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid="spec-ai-asks">
            <p className="t-sub font-semibold text-slate-800">AI 가 확인해 달라는 점</p>
            <ul className="flex flex-col gap-1">
              {asks.map((a) => (
                <li key={a.key} className="t-sub break-keep text-slate-700">
                  <b className="font-semibold">{KEY_LABEL[a.key] ?? a.key}</b> · {a.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Surface>
  )
}

type IdeaChoice = { caseName: string; idea: PatentIdeaLike & { coreIdea?: string } }

/** AI 작업실 특허 아이디어 고르기 — 이 초안의 회사와 이어진 작업실을 먼저 */
export function IdeaImportPanel({ clientId, onPick, onClose }: { clientId: string; onPick: (d: (cur: SpecDraft) => SpecDraft, label: string) => void; onClose: () => void }) {
  const repo = useOwnerAiRepo()
  const [cases, setCases] = useState<CompanyCase[] | null>(null)
  const [caseId, setCaseId] = useState('')
  const [ideas, setIdeas] = useState<IdeaChoice[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    repo.listCases().then(
      (list) => {
        if (!alive) return
        const sorted = [...list].sort((a, b) => Number(b.clientId === clientId && !!clientId) - Number(a.clientId === clientId && !!clientId))
        setCases(sorted)
        if (sorted[0] && clientId && sorted[0].clientId === clientId) setCaseId(sorted[0].id)
      },
      () => alive && setError('AI 작업실 목록을 읽지 못했습니다'),
    )
    return () => {
      alive = false
    }
  }, [repo, clientId])

  useEffect(() => {
    if (!caseId) {
      setIdeas(null)
      return
    }
    let alive = true
    const name = cases?.find((c) => c.id === caseId)?.companyName ?? ''
    repo.listRuns(caseId).then(
      (runs) => {
        if (!alive) return
        const out: IdeaChoice[] = []
        for (const r of runs) {
          if (r.skillId !== 'PATENT_IDEA') continue
          const list = (r.structured as { ideas?: unknown } | null)?.ideas
          if (!Array.isArray(list)) continue
          for (const it of list) if (it && typeof it === 'object') out.push({ caseName: name, idea: it as IdeaChoice['idea'] })
        }
        setIdeas(out)
      },
      () => alive && setError('특허 아이디어 결과를 읽지 못했습니다'),
    )
    return () => {
      alive = false
    }
  }, [repo, caseId, cases])

  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="spec-import">
        <div className="flex flex-col gap-1">
          <h3 className="t-body font-bold text-slate-900">AI 작업실에서 가져오기</h3>
          <p className="t-sub break-keep text-slate-700">AI 작업실의 '특허 아이디어' 결과를 1단계 빈 칸 · 방법 단계 · 종속항 씨앗으로 옮깁니다. 이미 적은 칸은 그대로 둡니다. AI 를 다시 부르지 않습니다.</p>
        </div>
        {error && <p className="t-sub text-danger-700">{error}</p>}
        {cases && cases.length === 0 && <p className="t-sub text-slate-600">AI 작업실에 업체가 없습니다.</p>}
        {cases && cases.length > 0 && (
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 sm:max-w-md" aria-label="AI 작업실 업체" data-testid="spec-import-case">
            <option value="">AI 작업실 업체 고르기</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
                {clientId && c.clientId === clientId ? ' · 이 초안의 회사' : ''}
              </option>
            ))}
          </select>
        )}
        {ideas && ideas.length === 0 && <p className="t-sub break-keep text-slate-600" data-testid="spec-import-none">이 업체에는 아직 '특허 아이디어' 결과가 없습니다 — AI 작업실에서 먼저 돌려 주세요.</p>}
        {ideas && ideas.length > 0 && (
          <ul className="flex flex-col gap-2" data-testid="spec-import-ideas">
            {ideas.map((x, i) => (
              <li key={i} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 px-3 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="t-sub font-semibold break-keep text-slate-900">{x.idea.title || `아이디어 ${i + 1}`}</p>
                  {x.idea.coreIdea && <p className="t-sub break-keep text-slate-600">{x.idea.coreIdea}</p>}
                </div>
                <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => onPick((cur) => draftFromIdea(cur, x.idea, `AI 작업실 · ${x.caseName} · ${x.idea.title ?? `아이디어 ${i + 1}`}`), x.idea.title ?? '')} data-testid="spec-import-use">
                  이 아이디어로 채우기
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Surface>
  )
}
