import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronDown, ChevronUp, Trash2, Wrench } from 'lucide-react'
import type { ClientOpsRecord, ToolResult } from '../../types/clientOps'
import { toolOf } from '../../config/toolRegistry'
import { withoutToolResult } from '../../services/clientOpsService'
import { activityTimeText } from '../../services/clientOpsActivity'
import { toolResultGroups } from '../../services/toolResultGroups'
import { Badge, Section, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'

/**
 * 업체 상세 > 도구 결과 (D-88).
 *
 * 창업감면 판정·크레탑 분석·정책자금 진단 같은 도구 결과가 이 업체에 붙어 있으면 여기 보인다.
 * 최신이 위. D-134: 모듈마다 가장 최근 결과 하나만 크게, 옛 결과는 '지난 결과' 로 접는다. 요약은 접혀 있고 펴서 본다. 지우면 활동 기록에 남는다.
 * 고객 플랫폼에 발행한 것은 그렇게 표시한다 — 두 번 발행하지 않기 위해.
 * 도구가 기한을 함께 심었으면 그것도 한 줄로 알려 준다 (D-89) — 달력에 이미 올라가 있다.
 */
export function ToolResultsCard({ record, onChange }: { record: ClientOpsRecord; onChange: (next: ClientOpsRecord) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const [olderOpen, setOlderOpen] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ToolResult | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // D-134: 도구에서 '보러 가기' 로 오면(#tool-results) 이 카드로 내려 준다
  useEffect(() => {
    if (window.location.hash === '#tool-results') boxRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  if (record.toolResults.length === 0) return null
  const groups = toolResultGroups(record.toolResults)

  /** 결과 한 건 — 가장 최근 것은 크게, 지난 것은 한 줄로 */
  const row = (r: ToolResult, latest: boolean) => {
    const tool = toolOf(r.toolKey)
    const isOpen = open === r.id
    const href = r.openPath ? r.openPath : tool?.path ? `${tool.path}?client=${encodeURIComponent(record.id)}` : ''
    return (
      <div key={r.id} className={`flex flex-col gap-2 ${latest ? '' : 'border-t border-slate-100 pt-2'}`} data-tool-result={r.toolKey} data-latest={latest}>
        <div className="flex flex-wrap items-center gap-2">
          {latest && <Wrench aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
          <span className={`${latest ? 't-body font-bold text-slate-900' : 't-sub font-semibold text-slate-700'} break-keep`}>{r.title}</span>
          {r.verdictLabel && <Badge tone={latest ? 'brand' : 'neutral'}>{r.verdictLabel}</Badge>}
          {r.publishedUpdateId && <Badge tone="success">고객 플랫폼 발행됨</Badge>}
          <span className="t-meta ml-auto text-slate-500">{activityTimeText(r.createdAt)}</span>
        </div>
        {r.deadlines.length > 0 && (
          <p className="t-meta flex items-center gap-1.5 text-slate-500">
            <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
            {[
              r.deadlines.some((d) => !d.todo) ? `기한 ${r.deadlines.filter((d) => !d.todo).length}건` : '',
              r.deadlines.some((d) => d.todo) ? `할 일 ${r.deadlines.filter((d) => d.todo).length}건` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            이 달력에 있습니다 — 가장 이른 것 {r.deadlines.map((d) => d.date).sort()[0].replace(/-/g, '.')}
          </p>
        )}
        {isOpen && <pre className="t-sub break-keep whitespace-pre-wrap rounded-(--radius-control) bg-slate-50 p-3 text-slate-700">{r.summary || '(요약 없음)'}</pre>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
            {isOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            {isOpen ? '접기' : '요약 보기'}
          </Button>
          {href && (
            <Link to={href} className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline" data-testid="tool-result-open">
              {r.openPath ? '만든 화면 다시 열기' : `${tool?.label ?? '도구'} 열기`}
            </Link>
          )}
          <Button size="sm" variant="ghost" className="ml-auto text-slate-500" onClick={() => setRemoving(r)} aria-label={`${r.title} 결과 지우기`}>
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    // 머리줄 · 탭 줄이 위에 붙어 있어 제목까지 보이게 넉넉히 띄운다
    <div ref={boxRef} id="tool-results" className="scroll-mt-36">
    <Section title="도구 결과" count={groups.length}>
      <div className="flex flex-col gap-2" data-testid="tool-results">
        {groups.map((g) => {
          const showOlder = olderOpen === g.toolKey
          return (
            <div key={g.toolKey} data-tool-group={g.toolKey}>
            <Surface className="flex flex-col gap-2 p-4">
              {row(g.latest, true)}
              {g.older.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOlderOpen(showOlder ? null : g.toolKey)}
                  aria-expanded={showOlder}
                  className="tap t-sub inline-flex items-center gap-1 self-start font-medium text-slate-600 hover:text-slate-900"
                  data-testid="tool-result-older"
                >
                  {showOlder ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                  지난 결과 {g.older.length}개 {showOlder ? '접기' : '보기'}
                </button>
              )}
              {showOlder && g.older.map((r) => row(r, false))}
            </Surface>
            </div>
          )
        })}
      </div>
      {removing && (
        <ConfirmModal
          open
          title="도구 결과를 지울까요?"
          message={`${removing.title} · ${removing.verdictLabel || ''}\n지워도 고객 플랫폼에 이미 발행한 글은 그대로 남습니다.`}
          confirmLabel="지우기"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            onChange(withoutToolResult(record, removing.id))
            setRemoving(null)
          }}
        />
      )}
    </Section>
    </div>
  )
}
