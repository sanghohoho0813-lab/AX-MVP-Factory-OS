/**
 * D-559 올리기 전 점수 줄 — 스레드 · 릴스 글 칸 위.
 *  '92점 · 바로 올려도 돼요' / '75점 · 고칠 곳 4' (규칙 계산 — AI 아님) + ? 에 점수 매기는 법.
 *  90점 아래면 보라 단추 [AI로 고칠 곳만 고쳐 쓰기] — 감점 항목을 그대로 AI 에 보내 1안을 고쳐 받는다(AI 를 부르는 것은 이 단추뿐).
 *  고쳐 쓴 뒤에는 [고치기 전으로] 가 남는다.
 *  D-561 [완성 글 쓰기] 뒤 90점이 안 되면 AI 가 자동으로 한 번 더 다듬는다 — 그동안 이 단추 자리에 '90점까지 한 번 더 다듬는 중'.
 */
import { RotateCcw, Sparkles } from 'lucide-react'
import { AiConfirm } from '../../components/ai/AiConfirm'
import { Button } from '../../components/ui/Button'
import { HintTip } from '../../components/ui/fold'
import { PASS_SCORE, SCORE_RULES, type PostScore } from '../../services/marketing/postScore'

export function PostScoreBar({
  score,
  testPrefix,
  aiOk,
  busy,
  busyLabel,
  error,
  onFix,
  onUndo,
  undoLabel = '고치기 전으로',
  readOnly = false,
}: {
  score: PostScore | null
  testPrefix: string
  aiOk: boolean
  busy: boolean
  /** D-561 자동으로 한 번 더 다듬는 중이면 그 말 */
  busyLabel?: string
  error?: string
  onFix: () => void
  /** 고쳐 쓴 직후에만 — 고치기 전 글로 */
  onUndo?: (() => void) | null
  /** 되돌리기 단추 글 — 고쳐 쓴 뒤 '고치기 전으로' · 새로 쓴 뒤 '이전 글로 되돌리기' */
  undoLabel?: string
  readOnly?: boolean
}) {
  const tone = !score ? 'text-slate-500' : score.pass ? 'text-success-700' : score.bad ? 'text-danger-700' : 'text-warning-800'
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={`${testPrefix}-score`} data-score={score?.score ?? ''} data-pass={score?.pass ? '1' : '0'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <HintTip tip={`올리기 전에 이 글이 몇 점인지 규칙으로 매겨요(AI 아님). ${SCORE_RULES.join(' · ')}.`} label="올리기 전 점수" tight>
          <span className="t-sub font-semibold text-slate-700">올리기 전 점수</span>
        </HintTip>
        {score ? (
          <span className={`t-section font-bold ${tone}`} data-testid={`${testPrefix}-score-value`}>
            {score.score}점
            <span className="t-sub ml-1.5 font-semibold">{score.pass ? '· 바로 올려도 돼요' : `· ${PASS_SCORE}점까지 고칠 곳 ${score.items.length}`}</span>
          </span>
        ) : (
          <span className="t-sub text-slate-500">글을 쓰면 점수가 나와요</span>
        )}
      </div>
      {score && !score.pass && aiOk && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <AiConfirm>
            <Button size="sm" variant="primary" className="bg-violet-600 hover:bg-violet-700" onClick={onFix} disabled={busy} data-testid={`${testPrefix}-score-fix`} data-guide="fn-mk-fix">
              <Sparkles aria-hidden="true" className="size-4" /> {busy ? (busyLabel ?? 'AI가 고쳐 쓰는 중…') : `AI로 고칠 곳만 고쳐 쓰기 (${Math.min(8, score.items.length)}곳)`}
            </Button>
          </AiConfirm>
        </div>
      )}
      {onUndo && (
        <Button size="sm" variant="ghost" className="self-start" onClick={onUndo} data-testid={`${testPrefix}-score-undo`}>
          <RotateCcw aria-hidden="true" className="size-4" /> {undoLabel}
        </Button>
      )}
      {error && (
        <p className="t-sub break-keep text-danger-700" data-testid={`${testPrefix}-score-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
