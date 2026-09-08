/**
 * 기록 — 감사 로그가 아니라 읽는 타임라인 (§29).
 *
 * 사용자가 따로 적지 않아도 행동이 그대로 남는다. 날짜별로 묶어 시간만 보여 준다.
 */

import { useMemo } from 'react'
import { useEditor } from '../editorContext'
import { artifactDef } from '../../../domain/consulting/artifactDefinitions'
import { PROMPT_TYPE_LABEL } from '../../../domain/consulting/promptPackageBuilder'
import { Blank } from '../../ui/primitives'
import { History } from 'lucide-react'

interface Row {
  at: string
  text: string
  kind: '결정' | '자료' | '프롬프트'
}

function dayLabel(iso: string, today: string): string {
  const d = iso.slice(0, 10)
  if (d === today) return '오늘'
  const y = new Date(new Date(today).getTime() - 86_400_000).toISOString().slice(0, 10)
  if (d === y) return '어제'
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
}

export function TimelineTab() {
  const { artifacts, prompts, decisions, today } = useEditor()

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [
      ...decisions.map((d) => ({ at: d.createdAt, text: d.summary, kind: '결정' as const })),
      ...artifacts.map((a) => ({ at: a.createdAt, text: `${artifactDef(a.type).label} 가져옴${a.version > 1 ? ` (${a.version}번째)` : ''}`, kind: '자료' as const })),
      ...prompts.map((p) => ({ at: p.createdAt, text: `${PROMPT_TYPE_LABEL[p.type]} 프롬프트 생성`, kind: '프롬프트' as const })),
    ]
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 120)
  }, [artifacts, prompts, decisions])

  if (rows.length === 0) {
    return <Blank icon={<History className="size-7" />} title="아직 기록이 없습니다. 진행하면 자동으로 쌓입니다." />
  }

  const days: { label: string; items: Row[] }[] = []
  for (const r of rows) {
    const label = dayLabel(r.at, today)
    const last = days[days.length - 1]
    if (last && last.label === label) last.items.push(r)
    else days.push({ label, items: [r] })
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((d) => (
        <section key={d.label}>
          <h2 className="t-section text-slate-900">{d.label}</h2>
          <ul className="mt-2 flex flex-col">
            {d.items.map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex gap-3 border-l-2 border-slate-100 py-2 pl-4">
                <span className="t-meta w-11 shrink-0 pt-0.5 tabular-nums text-slate-400">{r.at.slice(11, 16)}</span>
                <span className="min-w-0 flex-1">
                  <span className="t-body block break-keep text-slate-800">{r.text}</span>
                  <span className="t-meta text-slate-400">{r.kind}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
