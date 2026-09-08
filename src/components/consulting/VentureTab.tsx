/**
 * 벤처 작업공간 — 사업계획서 7항목 · 기본 제출서류 8종 · P0 Red Flag 12 · Judge 10축 · 신청 기록 · 최신 기준 확인.
 * 점수는 사람이 매긴다. 코드는 합계와 남은 것만 센다.
 */

import { Badge, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { JUDGE_AXES, PLAN_SECTIONS, RED_FLAGS, judgeTotal, judgeVerdict } from '../../domain/consulting/qaRules'
import { VENTURE_DOCUMENTS } from '../../domain/consulting/projectModel'
import { freshnessOk, redFlagsRemaining } from '../../domain/consulting/gateEngine'
import type { JudgeAxis, VentureWorkspace } from '../../types/consulting'
import { Block, CheckRow, TextField } from './studioParts'
import { FreshnessBlock } from './FreshnessBlock'

export function VentureTab({ focus }: { focus?: string }) {
  const { project: p, update, goTo, today, decide } = useEditor()
  const v = p.venture
  const set = (patch: Partial<VentureWorkspace>) => update((cur) => ({ ...cur, venture: { ...cur.venture, ...patch } }))
  const total = judgeTotal(v.judgeScores)
  const remaining = redFlagsRemaining(p)
  const docsDone = VENTURE_DOCUMENTS.filter((d) => v.documents[d.key]).length

  return (
    <div className="flex flex-col gap-4">
      <Surface edge="brand" showEdge>
        <h2 className="t-section text-slate-900">벤처기업확인 (혁신성장유형) — 사업계획서 · QA · 신청</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">
          공식 7개 작성축 + 실제 신청화면의 10개 첨부 슬롯. 신청 당일 화면이 최종 기준입니다. 숫자는 사실표에서만 가져옵니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('prompts', 'VENTURE_PLAN_SECTION')}>항목 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'VENTURE_FULL_REVIEW')}>전체 검토 (Judge/Devil)</Button>
          <Button size="sm" onClick={() => goTo('evidence')}>증빙 10슬롯</Button>
        </div>
      </Surface>

      <Block title="S11 · 사업계획서 7항목" hint="항목마다 요지를 적고, 본문은 프롬프트 결과로 들여옵니다. '경쟁사 없음' 금지 · 현재/개발중/향후 구분 · 특허·MVP 와 같은 기술명.">
        <div className="flex flex-col gap-2">
          {PLAN_SECTIONS.map((s) => {
            const st = v.sections[s.no]
            return (
              <div key={s.no} className={`rounded-(--radius-card) border p-3 ${st.done ? 'border-success-200 bg-success-50/40' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-card text-slate-900">{s.no}. {s.title}</span>
                  <span className="t-sub text-slate-500">{s.question}</span>
                  <span className="t-meta text-slate-400">슬롯 {s.slots.join('·')}</span>
                </div>
                <p className="t-meta mt-1 break-keep text-slate-500">반드시: {s.must.join(' / ')}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <TextField label="요지 (초안 방향)" value={st.outline} multiline rows={2} onCommit={(val) => set({ sections: { ...v.sections, [s.no]: { ...st, outline: val } } })} />
                  <div className="flex flex-col gap-2 sm:w-48">
                    <CheckRow label="초안 완료" checked={st.done} onChange={(val) => set({ sections: { ...v.sections, [s.no]: { ...st, done: val } } })} />
                    <Button size="sm" onClick={() => goTo('prompts', `VENTURE_PLAN_SECTION:${s.no}`)}>프롬프트</Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Block>

      <Block title={`기본 제출서류 8종 — ${docsDone}/8`} hint="신청일 근접 발급본을 요구할 수 있습니다 (법인등기·4대보험·주주명부). 신청 직전 최신 기준을 확인합니다 (§24).">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {VENTURE_DOCUMENTS.map((d) => (
            <CheckRow key={d.key} label={d.label} hint={d.hint || undefined} checked={v.documents[d.key] === true} onChange={(val) => set({ documents: { ...v.documents, [d.key]: val } })} />
          ))}
        </div>
      </Block>

      <div id="redflags" className={focus === 'redflags' ? 'rounded-(--radius-panel) ring-2 ring-brand-300' : ''}>
        <Block title={`S13 · P0 Red Flags — 남은 것 ${remaining.length}/12`} hint="하나라도 남아 있으면 제출 전 수정. '문제 없음' 을 확인한 것만 표시합니다 (§41).">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RED_FLAGS.map((f) => (
              <CheckRow key={f.no} label={`#${f.no} ${f.text}`} hint={v.redFlagsCleared[f.no] ? '문제 없음 확인' : '아직 확인 안 함'} checked={v.redFlagsCleared[f.no] === true} onChange={(val) => set({ redFlagsCleared: { ...v.redFlagsCleared, [f.no]: val } })} />
            ))}
          </div>
          {remaining.length === 0 && <p className="t-body text-success-700">P0 = 0. 이제 Judge 점수와 최종 QA 산출물을 남깁니다.</p>}
        </Block>
      </div>

      <Block title="Judge Scorecard — 10축 × 10점 (사람이 매김)" hint={total === null ? '10축을 모두 매기면 합계와 해석이 나옵니다.' : `합계 ${total}/100 · ${judgeVerdict(total)} — P0 가 남아 있으면 점수와 무관하게 Final 아님`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {JUDGE_AXES.map((a) => (
            <label key={a.key} className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
              <span className="t-sub min-w-0 flex-1 break-keep text-slate-700">{a.key}. {a.label}</span>
              <input
                type="number"
                min={0}
                max={10}
                aria-label={`${a.key} 점수`}
                value={v.judgeScores[a.key] ?? ''}
                onChange={(e) => {
                  const n = e.target.value === '' ? null : Math.max(0, Math.min(10, Number(e.target.value)))
                  set({ judgeScores: { ...v.judgeScores, [a.key as JudgeAxis]: n } })
                }}
                className="t-body h-10 w-16 shrink-0 rounded-(--radius-control) border border-slate-300 px-2 text-right"
              />
            </label>
          ))}
        </div>
        {total !== null && (
          <div className="flex items-center gap-2">
            <Badge tone={total >= 90 ? 'success' : total >= 80 ? 'warning' : 'danger'}>{total}/100</Badge>
            <span className="t-body text-slate-700">{judgeVerdict(total)}</span>
            <Button size="sm" onClick={() => void decide({ stageKey: 'S13', kind: 'other', summary: `Judge 합계 ${total}/100 · ${judgeVerdict(total)}` })}>결정 로그에 남기기</Button>
          </div>
        )}
      </Block>

      <div id="freshness">
        <FreshnessBlock scope="venture_application" title="신청 직전 최신 공식 기준 확인 (벤처확인종합관리시스템)" ok={freshnessOk(p, 'venture_application', today)} highlighted={focus === 'freshness'} />
      </div>

      <Block title="S14 · 신청 기록" hint="신청 당일: 입력항목 변경 · 글자수 · 첨부 개수/용량/형식 · 발급일 · 3개년 기준연도 · 제출본 백업 (§53).">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <TextField label="신청일" type="date" value={v.submittedAt} onCommit={(val) => { set({ submittedAt: val }); if (val) void decide({ stageKey: 'S14', kind: 'stage', summary: `벤처기업확인 신청 ${val}` }) }} />
          <TextField label="제출 메모 (접수번호·백업 위치 …)" value={v.submissionNote} onCommit={(val) => set({ submissionNote: val })} />
        </div>
      </Block>
    </div>
  )
}
