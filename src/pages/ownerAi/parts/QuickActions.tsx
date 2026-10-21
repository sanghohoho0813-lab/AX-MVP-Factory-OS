/**
 * 빠른 작업 10가지 — 모두 같은 업체 기억을 쓴다.
 * 누르면 창: 고를 것 · 적을 것 · 이번에 보낼 자료(최소 묶음) · 얼마나 보내는지 → 'AI 로 만들기'.
 *  - 요청 번호는 창을 열 때 한 번 만든다 → 두 번 눌러도 서버가 같은 결과를 돌려준다(중복 과금 없음).
 *  - 하나가 도는 동안 다른 단추는 잠긴다.
 *  - '깊게' 작업을 이미 한 번 만들었으면 다시 만들기 전에 한 번 묻는다(비용).
 */
import { useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { buildAiContext, materialsFor, payloadChars } from '../../../services/ownerAi/context'
import { newUuid } from '../../../services/ownerAi/caseUtil'
import { QUICK_ACTIONS, SKILL_META, TIER_LABEL, type QuickAction } from '../../../services/ownerAi/skillCatalog'
import { latestSnapshot, type CaseBundle } from '../../../services/ownerAi/workflow'
import { MATERIAL_KIND_LABEL, type AiRunInput, type SkillId } from '../../../services/ownerAi/types'
import { BottomSheet, Surface } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/Button'
import { TierBadge, type AiSetup } from '../shared'
import { ModelPicker } from '../../../components/ai/ModelPicker'

export interface RunRequest {
  skill: SkillId
  input: AiRunInput
  requestId: string
  /** 사람이 고른 자료 — 없으면 작업마다 정한 자료(빈 목록이면 '하나도 보내지 않음') */
  materialIds?: string[]
  label: string
}

export function QuickActions({
  bundle,
  today,
  running,
  setup,
  onRun,
  onPaste,
}: {
  bundle: CaseBundle
  today: string
  /** 지금 도는 작업 이름(없으면 null) */
  running: string | null
  setup: AiSetup
  onRun: (req: RunRequest) => Promise<boolean>
  onPaste: () => void
}) {
  const [open, setOpen] = useState<QuickAction | null>(null)
  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="t-section break-keep text-slate-900">빠른 작업</h2>
          <span className="t-sub break-keep text-slate-500">모두 이 업체 기억 · 자료를 같이 씁니다</span>
        </div>
        {/* D-255 AI 작업실도 고른 모델로 — 고르지 않으면 일마다 빠르게 · 보통 · 깊게 모델(전과 같음) */}
        <ModelPicker popover testId="owner-ai-model" />
      </div>
      {/* 칸 폭이 좁아도 이름이 한 줄씩 읽히게 — 최소 10.5rem 칸을 들어가는 만큼(휴대폰 2칸 · PC 3~5칸) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]" data-testid="quick-actions">
        {QUICK_ACTIONS.map((a) => {
          const tier = SKILL_META[a.skill].tier
          const isRunning = running === a.label
          return (
            <button
              key={a.key}
              type="button"
              data-action={a.key}
              disabled={!!running}
              onClick={() => setOpen(a)}
              className="tap flex min-h-[4.75rem] flex-col items-start gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="t-body font-semibold break-keep text-slate-900">{a.label}</span>
              <span className="t-meta break-keep text-slate-500">{isRunning ? '만드는 중…' : a.hint}</span>
              <span className="mt-auto pt-1">{isRunning ? <Loader2 aria-hidden="true" className="size-4 animate-spin text-brand-600" /> : <TierBadge tier={tier} />}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onPaste} data-testid="paste-chatgpt-open">
          ChatGPT 결과 붙여넣기
        </Button>
        <span className="t-meta break-keep text-slate-500">ChatGPT 대화 · 기억은 OS 가 읽지 못합니다 — 가져온 결과만 기록으로 남겨 채택할 수 있습니다.</span>
      </div>
      {open && (
        <ActionSheet
          action={open}
          bundle={bundle}
          today={today}
          setup={setup}
          busy={!!running}
          onClose={() => setOpen(null)}
          onRun={async (req) => {
            const ok = await onRun(req)
            if (ok) setOpen(null)
            return ok
          }}
        />
      )}
    </Surface>
  )
}

function ActionSheet({
  action,
  bundle,
  today,
  setup,
  busy,
  onClose,
  onRun,
}: {
  action: QuickAction
  bundle: CaseBundle
  today: string
  setup: AiSetup
  busy: boolean
  onClose: () => void
  onRun: (req: RunRequest) => Promise<boolean>
}) {
  const skill = action.skill
  const meta = SKILL_META[skill]
  const [requestId, setRequestId] = useState(() => newUuid())
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries((action.choices ?? []).map((c) => [c.key, c.initial])))
  const [ask, setAsk] = useState('')
  const defaults = useMemo(() => materialsFor(skill, bundle.c.materials).map((m) => m.id), [skill, bundle.c.materials])
  const [picked, setPicked] = useState<string[]>(defaults)
  const usable = bundle.c.materials.filter((m) => !m.excluded && m.text.trim())
  const [confirmDeep, setConfirmDeep] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const snap = latestSnapshot(bundle)
  const chars = useMemo(
    () =>
      payloadChars(
        buildAiContext({ skill, c: bundle.c, client: bundle.client, memory: snap ? { version: snap.version, content: snap.content } : null, runs: bundle.runs, revisions: bundle.latestRevision, today, materialIds: picked }),
      ),
    [skill, bundle, snap, today, picked],
  )
  const madeBefore = bundle.runs.some((r) => r.skillId === skill && r.status !== 'pasted')
  const ready = setup.state === 'ready'
  const missingAsk = !!action.ask?.required && !ask.trim()

  const submit = async () => {
    if (submitting || busy) return
    if (meta.tier === 'deep' && madeBefore && !confirmDeep) {
      setConfirmDeep(true)
      return
    }
    setSubmitting(true)
    const input: AiRunInput = { task: ask.trim() || undefined, options: choices }
    const ok = await onRun({ skill, input, requestId, materialIds: picked, label: action.label })
    setSubmitting(false)
    // 실패하면 새 요청 번호(다시 누르면 새로 시도)
    if (!ok) setRequestId(newUuid())
  }

  return (
    <BottomSheet
      title={action.label}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {confirmDeep && (
            <p className="t-sub rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-700" data-testid="deep-confirm">
              이 작업은 '깊게'(비용이 큰 모델)로 이미 한 번 만들었습니다. 다시 만들까요? 지난 결과는 그대로 남습니다.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button variant="primary" onClick={submit} disabled={!ready || busy || submitting || missingAsk} data-testid="ai-run">
              {submitting || busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
              {submitting || busy ? '만드는 중…' : confirmDeep ? '깊게 다시 만들기' : `AI 로 만들기 · ${TIER_LABEL[meta.tier]}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="t-body break-keep text-slate-700">{meta.description}</p>
        {!ready && (
          <p className="t-sub rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-700">
            AI 기능 설정이 필요합니다. 지금은 ChatGPT 결과 붙여넣기로 기록을 남길 수 있습니다.
          </p>
        )}
        {(action.choices ?? []).map((c) => (
          <fieldset key={c.key} className="flex flex-col gap-1.5">
            <legend className="t-sub font-semibold text-slate-700">{c.label}</legend>
            <div className="flex flex-wrap gap-2">
              {c.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={choices[c.key] === o.value}
                  onClick={() => setChoices((p) => ({ ...p, [c.key]: o.value }))}
                  className={`tap t-body min-h-11 rounded-full border px-4 font-semibold ${choices[c.key] === o.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {action.ask && (
          <label className="flex flex-col gap-1.5">
            <span className="t-sub font-semibold text-slate-700">{action.ask.label}</span>
            <textarea
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder={action.ask.placeholder}
              rows={3}
              maxLength={2000}
              data-testid="ai-ask"
              className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            />
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">이번에 같이 보낼 자료</span>
          {usable.length === 0 ? (
            <p className="t-sub break-keep text-slate-500">자료가 없습니다 — 업체 정보 · 기억만 보냅니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {usable.map((m) => (
                <li key={m.id}>
                  <label className="tap flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-brand-600"
                      checked={picked.includes(m.id)}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
                    />
                    <span className="t-body min-w-0 flex-1 truncate text-slate-700">{m.title}</span>
                    <span className="t-meta shrink-0 text-slate-500">{MATERIAL_KIND_LABEL[m.kind]}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="t-meta break-keep text-slate-500" data-testid="payload-chars">
            보낼 글 약 {chars.toLocaleString('ko-KR')}자 · 업체 정보 · 지금까지의 기억(v{snap?.version ?? 0}) · 채택한 결과 요약 포함 · 대표자 이름 · 연락처 · 주민번호 · 명부 원문은 보내지 않습니다
          </p>
        </div>
      </div>
    </BottomSheet>
  )
}
