/**
 * 콘텐츠 수첩 (D-194) — 저장한 아이디어를 단계로만 옮긴다(아이디어 → 제작 예정 → 대본 준비 → 촬영 완료 → 게시 완료).
 * 큰 프로젝트 관리가 아니다 — 단계 고르기 · 메모 한 줄 · 브리프 복사 · 빼기(한 번 더 묻기)만.
 */
import { useState } from 'react'
import { ClipboardCopy, NotebookPen, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Fold } from '../../../components/ui/fold'
import { IDEA_STATUSES, IDEA_STATUS_LABEL, briefText, type ContentIdea, type IdeaStatus } from '../../../services/marketing/radarStore'
import { AxisBadge } from './RadarParts'

export function IdeaNotebook({
  ideas,
  readOnly,
  onStatus,
  onMemo,
  onRemove,
  onCopy,
}: {
  ideas: ContentIdea[]
  readOnly: boolean
  onStatus: (i: ContentIdea, s: IdeaStatus) => void
  onMemo: (i: ContentIdea, memo: string) => void
  onRemove: (i: ContentIdea) => void
  onCopy: (text: string, what: string) => void
}) {
  const active = ideas.filter((i) => i.status !== 'published').length
  return (
    <Fold
      panel
      id="radar.notebook"
      title="콘텐츠 수첩"
      icon={<NotebookPen aria-hidden="true" className="size-4" />}
      count={ideas.length}
      countTone="brand"
      defaultOpen={ideas.length > 0}
      summary={ideas.length ? `진행 중 ${active}개` : '아직 저장한 아이디어가 없습니다'}
      testId="radar-notebook"
    >
      {readOnly && <p className="t-meta mb-2 text-warning-700">팀장 화면을 보는 중에는 수첩을 바꾸지 않습니다(읽기만).</p>}
      {ideas.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">후보 카드에서 [아이디어 저장] 을 누르면 여기에 쌓입니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {ideas.map((i) => (
            <IdeaRow key={i.id} i={i} readOnly={readOnly} onStatus={onStatus} onMemo={onMemo} onRemove={onRemove} onCopy={onCopy} />
          ))}
        </ul>
      )}
    </Fold>
  )
}

function IdeaRow({ i, readOnly, onStatus, onMemo, onRemove, onCopy }: { i: ContentIdea; readOnly: boolean; onStatus: (i: ContentIdea, s: IdeaStatus) => void; onMemo: (i: ContentIdea, memo: string) => void; onRemove: (i: ContentIdea) => void; onCopy: (text: string, what: string) => void }) {
  const [memo, setMemo] = useState(i.memo)
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <li className="flex flex-col gap-2 py-3" data-testid="radar-idea" data-status={i.status}>
      <div className="flex flex-wrap items-center gap-2">
        <AxisBadge axis={i.type} />
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap t-body min-w-0 flex-[1_1_12rem] text-left font-bold break-keep text-slate-900 [overflow-wrap:anywhere] hover:text-brand-700">
          {i.topic}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">단계</span>
          <select value={i.status} disabled={readOnly} onChange={(e) => onStatus(i, e.target.value as IdeaStatus)} className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5 text-slate-800" data-testid="radar-idea-status">
            {IDEA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {IDEA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="t-sub break-keep text-slate-600">{i.angle}</p>
      {open && (
        <div className="flex flex-col gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2">
          <ol className="t-sub flex list-decimal flex-col gap-0.5 pl-5 break-keep text-slate-800">
            {i.titleCandidates.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          {i.benchmarkTitles.length > 0 && <p className="t-meta break-keep text-slate-500">참고 영상 {i.benchmarkTitles.length}편 — {i.benchmarkTitles[0]}</p>}
          <label className="flex flex-col gap-1">
            <span className="t-meta font-semibold text-slate-600">메모</span>
            <input
              value={memo}
              disabled={readOnly}
              onChange={(e) => setMemo(e.target.value)}
              onBlur={() => memo !== i.memo && onMemo(i, memo)}
              placeholder="예: 다음 주 화요일 촬영 · 사례는 A사"
              className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2"
              data-testid="radar-idea-memo"
            />
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onCopy(briefText(i), '브리프')} data-testid="radar-idea-brief">
          <ClipboardCopy aria-hidden="true" className="size-4" /> 브리프 복사
        </Button>
        {confirm ? (
          <span className="flex flex-wrap items-center gap-2" data-testid="radar-idea-confirm">
            <span className="t-sub font-semibold text-danger-700">수첩에서 뺄까요?</span>
            <Button size="sm" variant="danger" onClick={() => onRemove(i)} disabled={readOnly}>
              빼기
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              그대로 두기
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={readOnly} aria-label={`수첩에서 빼기 — ${i.topic}`} data-testid="radar-idea-remove">
            <Trash2 aria-hidden="true" className="size-4" /> 빼기
          </Button>
        )}
      </div>
    </li>
  )
}
