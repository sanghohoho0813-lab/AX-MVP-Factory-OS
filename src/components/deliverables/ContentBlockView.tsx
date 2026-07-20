import type { DeliverableBlockTone, DeliverableContentBlock } from '../../types/deliverables'

const TONE_CALLOUT: Record<DeliverableBlockTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-brand-200 bg-brand-50/60 text-brand-800',
  success: 'border-success-200 bg-success-50/60 text-success-800',
  warning: 'border-warning-200 bg-warning-50/60 text-warning-800',
  danger: 'border-danger-200 bg-danger-50/60 text-danger-800',
}

/**
 * 하나의 콘텐츠 블록을 렌더한다. showInternal=false 이면 내부 전용 블록을 숨긴다
 * (미리보기·인쇄의 고객·개발자·기관 모드에서 사용).
 */
export function ContentBlockView({ block, showInternal }: { block: DeliverableContentBlock; showInternal: boolean }) {
  if (block.internalOnly && !showInternal) return null
  const internalTag = block.internalOnly && showInternal ? (
    <span className="ml-2 rounded border border-danger-200 bg-danger-50 px-1.5 py-0.5 text-[10px] font-semibold text-danger-600">내부 전용</span>
  ) : null

  switch (block.type) {
    case 'heading':
      return <h3 className="mt-1 text-base font-bold break-keep text-slate-900">{block.text}{internalTag}</h3>
    case 'paragraph':
      return (
        <div>
          {block.title && <p className="text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <p className="text-[13px] leading-relaxed break-keep whitespace-pre-wrap text-slate-700">{block.text}</p>
        </div>
      )
    case 'callout':
    case 'warning':
      return (
        <div className={`rounded-(--radius-card) border px-4 py-3 ${TONE_CALLOUT[block.type === 'warning' ? 'warning' : block.tone]}`}>
          {block.title && <p className="text-[13px] font-semibold break-keep">{block.title}{internalTag}</p>}
          <p className="text-[13px] leading-relaxed break-keep whitespace-pre-wrap">{block.text}</p>
        </div>
      )
    case 'bullet_list':
    case 'checklist':
      return (
        <div>
          {block.title && <p className="mb-1 text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <ul className="flex flex-col gap-1">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <span className="min-w-0 whitespace-pre-wrap">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'numbered_list':
    case 'timeline':
      return (
        <div>
          {block.title && <p className="mb-1 text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <ol className="flex flex-col gap-1">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                <span className="min-w-0 whitespace-pre-wrap">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )
    case 'key_value':
      return (
        <div>
          {block.title && <p className="mb-1.5 text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {block.keyValues.map((kv, i) => (
              <div key={i} className="flex flex-col">
                <dt className="text-xs text-slate-400">{kv.key}</dt>
                <dd className="text-[13px] break-keep whitespace-pre-wrap text-slate-700">{kv.value || '-'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )
    case 'metric':
      return (
        <div className="flex items-baseline justify-between gap-3 rounded-(--radius-card) border border-slate-200 px-3.5 py-2">
          <span className="text-[13px] text-slate-500">{block.title}</span>
          <span className="text-sm font-semibold break-keep text-slate-800">{block.text}</span>
        </div>
      )
    case 'table':
      return (
        <div>
          {block.title && <p className="mb-1.5 text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              {block.tableHeaders.length > 0 && (
                <thead>
                  <tr className="border-b border-slate-200">
                    {block.tableHeaders.map((h, i) => (
                      <th key={i} scope="col" className="px-2.5 py-1.5 text-left font-semibold break-keep text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100">
                    {row.cells.map((cell, ci) => (
                      <td key={ci} className="px-2.5 py-1.5 align-top break-keep whitespace-pre-wrap text-slate-700">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    case 'code':
    case 'prompt':
      return (
        <div>
          {block.title && <p className="mb-1 text-[13px] font-semibold text-slate-700">{block.title}{internalTag}</p>}
          <pre className="overflow-x-auto rounded-(--radius-card) border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-700">{block.text}</pre>
        </div>
      )
    case 'divider':
      return <hr className="border-slate-200" />
    default:
      return null
  }
}

/** 블록 배열을 렌더한다. */
export function ContentBlocks({ blocks, showInternal }: { blocks: DeliverableContentBlock[]; showInternal: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b) => (
        <ContentBlockView key={b.id} block={b} showInternal={showInternal} />
      ))}
    </div>
  )
}
