/**
 * D-246 벤처 사업계획서 AI 초안 — 대표만(화면은 useOwnerAiAccess 'yes' 일 때만 그리고, 서버 /api/ai-assist 가 다시 막는다).
 *
 * 여섯 번으로 나눠 차례로 부른다(서버 함수 60초 안 · 요약은 마지막). 묶음마다 받는 대로 저장 — 중간에 실패해도 앞의 것은 남고
 * 실패한 묶음만 다시 누를 수 있다. 사람이 고친 칸은 덮지 않고 '새 안' 으로 따로 둔다(mergeDraft).
 */
import { useRef, useState } from 'react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { AssistError, assistMessage, callAssist } from '../../services/aiAssist/client'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { VPLAN_FIELD, mergeDraft, readPlan, type VPlanBatch, type VPlanFacts } from '../core/venturePlan'
import { VPLAN_BATCHES, buildBatchContext, draftItemsOf, fieldsOfBatch } from '../integration/venturePlanAi'

type RowState = { phase: 'wait' | 'run' | 'done' | 'fail'; text: string }

/** 이 오류면 다음 묶음도 똑같이 실패한다 — 거기서 멈춘다 */
const STOP_CODES = new Set(['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed', 'provider_auth', 'rate_limited', 'network'])

export function VenturePlanAi({
  notes,
  facts,
  today,
  hasMaterial,
  onSave,
  onGoMaterials,
  onGoField,
  onClose,
}: {
  notes: Record<string, string>
  facts: VPlanFacts
  today: string
  hasMaterial: boolean
  onSave: (patch: Record<string, string>) => Promise<void>
  onGoMaterials: () => void
  onGoField: (id: string) => void
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [busy, setBusy] = useState(false)
  const [asks, setAsks] = useState<{ id: string; text: string }[]>([])
  // 묶음 사이에 화면 기록이 늦게 따라와도 앞 묶음 결과를 보고 이어 쓰게
  const notesRef = useRef(notes)
  notesRef.current = notes
  // 여섯 번 저장하는 동안 화면이 바뀌어도 늘 가장 최근 저장 함수로
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const pending = useRef<Record<string, string>>({})

  const setRow = (k: string, r: RowState) => setRows((cur) => ({ ...cur, [k]: r }))

  /** 묶음 하나 — 성공이면 [새로 쓴 칸, 그대로 둔 칸], 멈춰야 하면 'stop' */
  const runOne = async (key: VPlanBatch): Promise<[number, number] | 'stop' | 'fail'> => {
    const b = VPLAN_BATCHES.find((x) => x.key === key)!
    setRow(key, { phase: 'run', text: '쓰는 중…(30초쯤)' })
    try {
      const state = readPlan({ ...notesRef.current, ...pending.current })
      const run = await callAssist({ requestId: newRequestId(), assistId: b.assistId, page: 'venture', choice: readChoice(), context: buildBatchContext({ batch: key, state, facts, today }) })
      const items = draftItemsOf(run.structured, key)
      if (!items.length) throw new AssistError('provider_error', 'AI 답에서 칸을 찾지 못했습니다 — 다시 눌러 주세요')
      const m = mergeDraft(readPlan({ ...notesRef.current, ...pending.current }), items)
      await saveRef.current(m.patch)
      Object.assign(pending.current, m.patch)
      const got = items.filter((i) => i.note).map((i) => ({ id: i.id, text: i.note! }))
      setAsks((cur) => [...cur.filter((x) => !items.some((i) => i.id === x.id)), ...got])
      setRow(key, { phase: 'done', text: `${m.replaced.length}칸 씀${m.kept.length ? ` · 고친 칸 ${m.kept.length}개는 그대로(새 안 따로)` : ''}` })
      return [m.replaced.length, m.kept.length]
    } catch (e) {
      const code = e instanceof AssistError ? e.code : 'save'
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setRow(key, { phase: 'fail', text: why })
      return STOP_CODES.has(code) ? 'stop' : 'fail'
    }
  }

  const runAll = async (keys: VPlanBatch[]) => {
    if (busy) return
    setBusy(true)
    pending.current = {}
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
    pending.current = {}
    setBusy(false)
    showToast(`AI 초안 — ${wrote}칸 썼습니다${kept ? ` · 고치신 칸 ${kept}개는 그대로 두고 새 안을 칸 아래에` : ''}${failed ? ` · ${failed}묶음은 못 씀(다시 누르기)` : ''}`)
  }

  const failedKeys = VPLAN_BATCHES.filter((b) => rows[b.key]?.phase === 'fail').map((b) => b.key)

  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="vplan-ai">
        <div className="flex flex-col gap-1">
          <h3 className="t-body font-bold text-slate-900">AI 초안 만들기 · 대표만</h3>
          <p className="t-sub break-keep text-slate-700">
            재료(특허 · AX · 메모)와 회사 기록만 보고 여섯 번에 나눠 씁니다(한 번에 1~2칸 · 요약은 마지막). 받는 대로 저장하고, <b className="font-semibold">고치신 칸은 덮지 않고 새 안으로 따로</b> 둡니다.
          </p>
          <p className="t-sub break-keep text-warning-800">누르면 재료 · 이미 쓴 칸 · 회사 숫자가 고른 AI 회사로 갑니다(사람 이름 · 연락처는 서버가 한 번 더 지움). 아직 출원 전 발명을 밖으로 보내면 안 되는 경우엔 누르지 마세요.</p>
          {/* D-255 모델 이름만 보이던 줄 → 누르면 고르는 단추(고른 모델은 모든 AI 단추가 같이) */}
          <ModelPicker className="mt-1" />
        </div>
        {!hasMaterial ? (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 sm:flex-row sm:items-center" data-testid="vplan-ai-need">
            <p className="t-sub min-w-0 flex-1 break-keep text-warning-900">재료(특허 명세서 또는 AX · MVP)가 없으면 AI 가 지어낼 수 있어 막아 두었습니다.</p>
            <Button variant="primary" size="sm" onClick={onGoMaterials}>
              재료 넣기
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void runAll(VPLAN_BATCHES.map((b) => b.key))} data-testid="vplan-ai-run">
              {busy ? '쓰는 중…' : '여섯 묶음 모두 쓰기'}
            </Button>
            {failedKeys.length > 0 && !busy && (
              <Button variant="secondary" size="sm" onClick={() => void runAll(failedKeys)} data-testid="vplan-ai-retry">
                못 쓴 {failedKeys.length}묶음만 다시
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              닫기
            </Button>
          </div>
        )}
        <ul className="flex flex-col" data-testid="vplan-ai-rows">
          {VPLAN_BATCHES.map((b) => {
            const r = rows[b.key]
            return (
              <li key={b.key} className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center" data-testid="vplan-ai-row" data-key={b.key} data-phase={r?.phase ?? ''}>
                <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                  <b className="font-semibold">{b.label}</b>
                  <span className="text-slate-500"> · {fieldsOfBatch(b.key).length}칸</span>
                  {r && <span className={`block ${r.phase === 'fail' ? 'text-danger-700' : r.phase === 'done' ? 'text-success-700' : 'text-slate-600'}`}>{r.phase === 'done' ? '✓ ' : r.phase === 'fail' ? '△ ' : ''}{r.text}</span>}
                </p>
                {hasMaterial && (
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" disabled={busy} onClick={() => void runAll([b.key])} data-testid="vplan-ai-one">
                    {r?.phase === 'done' ? '다시 쓰기' : '이것만 쓰기'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {asks.length > 0 && (
          <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid="vplan-ai-asks">
            <p className="t-sub font-semibold text-slate-800">AI 가 확인해 달라는 점</p>
            <ul className="flex flex-col gap-1">
              {asks.map((a) => (
                <li key={a.id} className="t-sub flex flex-wrap items-center gap-x-2 break-keep text-slate-700">
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{VPLAN_FIELD[a.id]?.title ?? a.id}</b> · {a.text}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => onGoField(a.id)}>
                    그 칸으로
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Surface>
  )
}
