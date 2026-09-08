/**
 * 최신 공식 기준 확인 기록 — POLICY FRESHNESS GATE (Master K9).
 * 출원(특허로)·신청(벤처확인종합관리시스템) 직전 30일 안에 한 번은 기록해야 S7/S14 를 완료할 수 있다.
 */

import { useState } from 'react'
import { Badge } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { FRESHNESS_DAYS } from '../../domain/consulting/gateEngine'
import { nowIso } from '../../lib/appClock'
import type { PolicyFreshness } from '../../types/consulting'
import { TextField } from './studioParts'

const SOURCE_HINT: Record<PolicyFreshness['scope'], string> = {
  patent_filing: '특허로 (patent.go.kr) — 서식·요약서 글자수·수수료',
  venture_application: '벤처확인종합관리시스템 — 글자수·첨부수·첨부용량·발급기준·요구연도',
}

export function FreshnessBlock({ scope, title, ok, highlighted = false }: { scope: PolicyFreshness['scope']; title: string; ok: boolean; highlighted?: boolean }) {
  const { project: p, update, decide } = useEditor()
  const [source, setSource] = useState('')
  const [diff, setDiff] = useState('')
  const records = p.freshness.filter((f) => f.scope === scope).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))

  const add = async () => {
    const rec: PolicyFreshness = { scope, checkedAt: nowIso().slice(0, 10), source: source.trim() || SOURCE_HINT[scope].split(' — ')[0], differences: diff.trim() }
    update((cur) => ({ ...cur, freshness: [rec, ...cur.freshness] }))
    await decide({ stageKey: scope === 'patent_filing' ? 'S7' : 'S14', kind: 'policy', summary: `최신 공식 기준 확인 · ${rec.source}`, reason: rec.differences || '이 Master 와 차이 없음' })
    setSource('')
    setDiff('')
  }

  return (
    <section className={`flex flex-col gap-3 rounded-(--radius-panel) border bg-white p-4 sm:p-5 ${highlighted ? 'border-brand-400 ring-1 ring-brand-300' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="t-card text-slate-900">{title}</h3>
        <Badge tone={ok ? 'success' : 'warning'}>{ok ? `${FRESHNESS_DAYS}일 이내 확인됨` : '확인 필요'}</Badge>
      </div>
      <p className="t-sub break-keep text-slate-500">공식 최신 기준이 이 Master 보다 우선합니다. 확인처: {SOURCE_HINT[scope]}. 오래된 수치를 영구 고정값으로 취급하지 않습니다.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="확인한 곳" value={source} onCommit={setSource} placeholder={SOURCE_HINT[scope].split(' — ')[0]} />
        <TextField label="이 Master 와 달랐던 점" value={diff} onCommit={setDiff} placeholder="없으면 비워 둡니다" />
      </div>
      <Button variant="primary" className="self-start" onClick={() => void add()}>오늘 확인했다고 기록</Button>
      {records.length > 0 && (
        <ul className="flex flex-col gap-1">
          {records.slice(0, 5).map((r, i) => (
            <li key={`${r.checkedAt}-${i}`} className="t-sub break-keep text-slate-600">
              {r.checkedAt} · {r.source}{r.differences ? ` · 차이: ${r.differences}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
