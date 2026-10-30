/**
 * AI 결과 한 장 — 읽기 · 판단(채택 · 일부 채택 · 폐기) · 고치기(수정 이력) · 복사 · 기억에 넣기.
 * 원래 결과는 지우지 않는다. 고친 글은 새 번호로 쌓이고, 화면은 마지막으로 고친 글을 보여 준다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Copy, PencilLine, RotateCcw, X } from 'lucide-react'
import { PATENT_WARNING, runParts, runTitle } from '../../../services/ownerAi/render'
import { EVALUATION_LABEL, type AiRevision, type AiRun, type Evaluation } from '../../../services/ownerAi/types'
import { Badge, Surface, type Tone } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { revisedText } from '../../../services/ownerAi/render'
import { Md, TierBadge, copyToClipboard, fmtDateTime, fmtUsd } from '../shared'
import { IconTile } from '../../../components/ui/visual'
import { skillVisual } from '../skillVisual'

const EVAL_TONE: Record<Evaluation, Tone> = { draft: 'neutral', adopted: 'success', partially_adopted: 'brand', rejected: 'danger' }

export function runText(run: AiRun, rev: AiRevision | undefined): string {
  // D-219: 스튜디오에서 고친 판(구조)도 글로 — 예전엔 '고친 글 n번째' 배지를 달고 원래 AI 글을 보여 주고 복사했다
  return (rev ? revisedText(run.skillId, rev.content) : '') || run.rendered
}

export function RunCard({
  run,
  revision,
  defaultOpen,
  busy,
  onEvaluate,
  onRevise,
  onToMemory,
  onRegenerate,
  toast,
}: {
  run: AiRun
  revision?: AiRevision
  defaultOpen: boolean
  busy: boolean
  /** 저장됐으면 true — D-219: 창은 저장된 뒤에만 닫는다 */
  onEvaluate: (evaluation: Evaluation, note: string, part: unknown) => Promise<boolean>
  onRevise: (text: string, note: string) => Promise<boolean>
  onToMemory: () => void
  /** D-282 같은 작업 창을 다시 연다(고를 것 · 자료 · 비용 확인은 그 창 그대로). 없으면 단추 없음 */
  onRegenerate?: () => void
  toast: (m: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [dialog, setDialog] = useState<null | 'partial' | 'reject' | 'edit'>(null)
  const text = runText(run, revision)
  const adopted = run.evaluation === 'adopted' || run.evaluation === 'partially_adopted'
  const studio = run.skillId === 'SANGHO_PROPOSAL' ? 'proposal' : run.skillId === 'AX_FRONT' ? 'front' : null
  const isMessage = run.skillId === 'CONSULTANT_MESSAGE'
  const sv = skillVisual(run.skillId)

  return (
    <div data-run={run.id} data-skill={run.skillId} data-evaluation={run.evaluation}>
    <Surface as="article" className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="tap -m-1 flex min-h-11 items-start gap-3 p-1 text-left">
        <IconTile icon={sv.icon} tone={sv.tone} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="t-card font-bold break-keep text-slate-900">{runTitle(run)}</span>
            <TierBadge tier={run.tier} />
            <Badge tone={EVAL_TONE[run.evaluation]}>{EVALUATION_LABEL[run.evaluation]}</Badge>
            {run.status === 'parse_fallback' && <Badge tone="warning">형식 확인 필요</Badge>}
            {revision && <Badge>고친 글 {revision.revisionNo}번째</Badge>}
          </span>
          <span className="t-meta mt-0.5 block text-slate-500">
            {fmtDateTime(run.createdAt)}
            {run.tier !== 'manual' && run.model ? ` · ${run.model}` : ''}
            {run.contextVersion ? ` · 기억 v${run.contextVersion} 사용` : run.tier === 'manual' ? '' : ' · 기억 없이'}
            {run.evaluationNote && ` · 메모: ${run.evaluationNote}`}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={`mt-1 size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {run.status === 'parse_fallback' && (
            <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-warning-700">
              AI 가 약속한 모양으로 답하지 않아 원문을 그대로 보관했습니다. 읽고 쓸 만하면 채택하거나 고쳐서 쓰세요.
            </p>
          )}
          {run.skillId === 'PATENT_IDEA' && run.status !== 'succeeded' && (
            <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-warning-700">⚠ {PATENT_WARNING}</p>
          )}
          <div className="max-h-[32rem] overflow-y-auto rounded-(--radius-control) bg-slate-50 px-3 py-3 sm:px-4" data-testid="run-text">
            {isMessage || run.status === 'pasted' || run.status === 'parse_fallback' ? <p className="t-body break-words whitespace-pre-wrap text-slate-800">{text}</p> : <Md text={text} />}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* D-282 주 단추는 하나 — 검토 전이면 [채택], 채택했으면 [기억에 넣기] */}
            <Button size="sm" variant={run.evaluation === 'draft' ? 'primary' : 'secondary'} aria-pressed={run.evaluation === 'adopted'} disabled={busy} onClick={() => onEvaluate('adopted', '', null)} data-testid="eval-adopt">
              <Check aria-hidden="true" className="size-4" />
              채택
            </Button>
            <Button size="sm" variant="secondary" aria-pressed={run.evaluation === 'partially_adopted'} disabled={busy} onClick={() => setDialog('partial')} data-testid="eval-partial">
              일부 채택
            </Button>
            <Button size="sm" variant={run.evaluation === 'rejected' ? 'danger' : 'secondary'} disabled={busy} onClick={() => setDialog('reject')} data-testid="eval-reject">
              <X aria-hidden="true" className="size-4" />
              폐기
            </Button>
            {studio ? (
              <Link
                to={`/ai/cases/${run.caseId}/${studio}/${run.id}`}
                className="tap t-sub inline-flex h-10 items-center rounded-(--radius-control) border border-brand-600 bg-brand-600 px-3 font-medium text-white hover:bg-brand-700"
                data-testid="open-studio"
              >
                {studio === 'proposal' ? '제안서 스튜디오' : '화면 스튜디오'}
              </Link>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog('edit')} data-testid="run-edit">
                <PencilLine aria-hidden="true" className="size-4" />
                고치기
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => toast((await copyToClipboard(text)) ? '복사했습니다.' : '복사하지 못했습니다. 글을 길게 눌러 복사해 주세요.')}
              data-testid="run-copy"
            >
              <Copy aria-hidden="true" className="size-4" />
              복사
            </Button>
            {adopted && (
              <Button size="sm" variant="primary" disabled={busy} onClick={onToMemory} data-testid="run-to-memory">
                기억에 넣기
              </Button>
            )}
            {onRegenerate && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={onRegenerate} data-testid="run-regenerate">
                <RotateCcw aria-hidden="true" className="size-4" />
                다시 만들기
              </Button>
            )}
          </div>
          <details className="t-meta text-slate-500">
            <summary className="tap min-h-11 cursor-pointer py-2">실행 기록</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pb-1">
              <dt>스킬</dt>
              <dd>{run.skillId} v{run.skillVersion}</dd>
              <dt>공급자 · 모델</dt>
              <dd className="break-all">{run.provider} · {run.model}</dd>
              <dt>토큰</dt>
              <dd>입력 {run.usage.input.toLocaleString('ko-KR')} · 출력 {run.usage.output.toLocaleString('ko-KR')}</dd>
              <dt>예상 비용</dt>
              <dd>{run.tier === 'manual' ? '없음(붙여넣기)' : fmtUsd(run.estimatedCostUsd)}</dd>
              <dt>기억 판</dt>
              <dd>{run.contextVersion == null ? '없음' : `v${run.contextVersion}`}</dd>
              <dt>평가 시각</dt>
              <dd>{run.evaluatedAt ? fmtDateTime(run.evaluatedAt) : '아직'}</dd>
            </dl>
          </details>
        </>
      )}

      {dialog === 'partial' && <PartialDialog run={run} busy={busy} onClose={() => setDialog(null)} onSave={async (note, part) => { if (await onEvaluate('partially_adopted', note, part)) setDialog(null) }} />}
      {dialog === 'reject' && <RejectDialog busy={busy} onClose={() => setDialog(null)} onSave={async (note) => { if (await onEvaluate('rejected', note, null)) setDialog(null) }} />}
      {dialog === 'edit' && <EditDialog initial={text} busy={busy} onClose={() => setDialog(null)} onSave={async (t, note) => { if (await onRevise(t, note)) setDialog(null) }} />}
    </Surface>
    </div>
  )
}

function PartialDialog({ run, busy, onClose, onSave }: { run: AiRun; busy: boolean; onClose: () => void; onSave: (note: string, part: unknown) => Promise<void> }) {
  const parts = runParts(run)
  const [index, setIndex] = useState<number>(parts[0]?.index ?? -1)
  const [note, setNote] = useState('')
  return (
    <Modal
      open
      title="일부 채택"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || (!parts.length && !note.trim())} onClick={() => onSave(note.trim(), index >= 0 ? { index } : null)} data-testid="partial-save">
            일부 채택
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {parts.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="t-sub font-semibold text-slate-700">어느 부분을 쓸까요?</legend>
            {parts.map((p) => (
              <label key={p.index} className="tap flex min-h-11 items-center gap-2">
                <input type="radio" name="part" className="size-5 accent-brand-600" checked={index === p.index} onChange={() => setIndex(p.index)} />
                <span className="t-body break-keep text-slate-800">{p.title}</span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">{parts.length ? '메모(선택)' : '어느 부분을 쓰는지 적어 주세요'}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="partial-note" />
        </label>
      </div>
    </Modal>
  )
}

function RejectDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return (
    <Modal
      open
      title="폐기"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="danger" disabled={busy} onClick={() => onSave(note.trim())} data-testid="reject-save">
            폐기
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="t-sub break-keep text-slate-700">왜 안 쓰는지 한 줄(선택) — 다음 결과를 고를 때 참고합니다. 기록은 지우지 않습니다.</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" data-testid="reject-note" />
      </label>
    </Modal>
  )
}

function EditDialog({ initial, busy, onClose, onSave }: { initial: string; busy: boolean; onClose: () => void; onSave: (text: string, note: string) => Promise<void> }) {
  const [text, setText] = useState(initial)
  const [note, setNote] = useState('')
  return (
    <Modal
      open
      size="lg"
      title="결과 고치기"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || !text.trim() || text === initial} onClick={() => onSave(text, note.trim())} data-testid="edit-save">
            고친 글 저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-500">원래 결과는 그대로 남고, 고친 글이 새 번호로 쌓입니다.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} maxLength={30000} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 font-[inherit]" data-testid="edit-text" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="무엇을 고쳤나요(선택)" className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3" />
      </div>
    </Modal>
  )
}
