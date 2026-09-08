/**
 * 현장실사 준비 — 3분 Script · Demo 동선 · 예상 Q&A 10~15 · 외울 숫자 8~12 · Evidence Pack · 금지표현 · Mock Review · 결과.
 * "곧 실사래" 가 오면 이 탭이 7종 세트다 (Master PART 8).
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { EVIDENCE_PACK, FIELD_QUESTION_POOL, FORBIDDEN_PHRASES, SCRIPT_SKELETON, findForbiddenPhrases } from '../../domain/consulting/qaRules'
import { FACTS, FACT_STATUS_LABEL, factFilled } from '../../domain/consulting/factsheetSchema'
import type { FactKey, FieldReviewWorkspace } from '../../types/consulting'
import { Block, CheckRow, CopyButton, TextField } from './studioParts'

export function FieldReviewTab({ focus }: { focus?: string }) {
  const { project: p, update, goTo, decide } = useEditor()
  const fr = p.fieldReview
  const set = (patch: Partial<FieldReviewWorkspace>) => update((cur) => ({ ...cur, fieldReview: { ...cur.fieldReview, ...patch } }))
  const [newQ, setNewQ] = useState('')
  const forbidden = findForbiddenPhrases(`${fr.script}\n${fr.qa.map((q) => q.keyPoint).join('\n')}`)
  const numberCandidates = FACTS.filter((f) => f.numeric || ['establishedAt', 'patent'].includes(f.key)).filter((f) => factFilled(p.factsheet[f.key]))
  const numbersText = fr.numbersToMemorize.map((k) => {
    const f = FACTS.find((x) => x.key === k)
    const v = p.factsheet[k]
    return `${f?.label ?? k}: ${v?.value ?? ''}`
  }).join('\n')

  return (
    <div className="flex flex-col gap-4">
      <Surface edge="brand" showEdge>
        <h2 className="t-section text-slate-900">S15 · 현장실사 준비 세트</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">대표자 3분 Script · MVP 3분 Demo · 예상질문 10~15 · 답변 Key Point · 증빙 체크 · 외울 숫자 8~12 · 금지표현 · Mock Review 1회.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('prompts', 'FIELD_REVIEW_SCRIPT')}>Script 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'FIELD_REVIEW_QA')}>Q&A 프롬프트</Button>
        </div>
        <div className="mt-3">
          <TextField label="실사 예정일" type="date" value={fr.reviewDate} onCommit={(v) => set({ reviewDate: v })} />
        </div>
      </Surface>

      {forbidden.length > 0 && (
        <Surface edge="danger" showEdge>
          <p className="t-card text-danger-700">금지 표현이 들어 있습니다</p>
          <p className="t-body mt-1 break-keep text-slate-700">{forbidden.join(' · ')} — 증빙이 없으면 말하지 않습니다 (§49).</p>
        </Surface>
      )}

      <Block title="대표자 3분 Script" hint={SCRIPT_SKELETON.join(' → ')} action={fr.script ? <CopyButton text={fr.script} /> : undefined}>
        <TextField label="Script (대표자 말투로)" value={fr.script} multiline rows={10} onCommit={(v) => set({ script: v })} />
      </Block>

      <Block title="MVP 3분 Demo 동선" hint="문제 → 대시보드 → 핵심 입력 → AX 분석/판단 → 결과 → Action → 고객/거래처 Surface → Future Preview. 모든 메뉴를 보여주지 않는다.">
        <TextField label="클릭 순서" value={fr.demoFlow} multiline rows={5} onCommit={(v) => set({ demoFlow: v })} />
      </Block>

      <div id="qa" className={focus === 'qa' ? 'rounded-(--radius-panel) ring-2 ring-brand-300' : ''}>
        <Block title={`예상질문 · 답변 Key Point — ${fr.qa.length}개 (10~15)`} hint="회사에 맞게 바꾼 질문. Key Point 는 사실표·핵심 줄기와 어긋나지 않게.">
          <div className="flex flex-col gap-2">
            {fr.qa.map((item, i) => (
              <div key={i} className="rounded-(--radius-card) border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <span className="t-meta mt-1 w-6 shrink-0 text-right font-bold text-slate-500">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <TextField label="질문" value={item.question} onCommit={(v) => set({ qa: fr.qa.map((q, j) => (j === i ? { ...q, question: v } : q)) })} />
                    <TextField label="답변 Key Point" value={item.keyPoint} multiline rows={2} onCommit={(v) => set({ qa: fr.qa.map((q, j) => (j === i ? { ...q, keyPoint: v } : q)) })} />
                  </div>
                  <button type="button" aria-label="질문 삭제" onClick={() => set({ qa: fr.qa.filter((_, j) => j !== i) })} className="tap mt-1 rounded-(--radius-control) p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-600">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <TextField label="새 질문" value={newQ} onCommit={setNewQ} placeholder="직접 적거나 아래 기본 풀에서 고릅니다" />
            </div>
            <Button size="sm" disabled={newQ.trim() === ''} onClick={() => { set({ qa: [...fr.qa, { question: newQ.trim(), keyPoint: '' }] }); setNewQ('') }}>
              <Plus aria-hidden="true" className="size-4" /> 추가
            </Button>
          </div>
          <details>
            <summary className="t-sub cursor-pointer font-medium text-slate-600">기본 질문 풀 15개에서 고르기</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FIELD_QUESTION_POOL.map((q) => {
                const has = fr.qa.some((x) => x.question === q)
                return (
                  <button key={q} type="button" disabled={has} onClick={() => set({ qa: [...fr.qa, { question: q, keyPoint: '' }] })} className="t-meta rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40">
                    {q}
                  </button>
                )
              })}
            </div>
          </details>
        </Block>
      </div>

      <Block title={`대표가 외울 숫자 — ${fr.numbersToMemorize.length}개 (8~12)`} hint="사실표의 값만. 시연용(demo) 값은 넣을 수 없습니다 — 실사에서 실적처럼 말하게 됩니다." action={numbersText ? <CopyButton text={numbersText} /> : undefined}>
        {numberCandidates.length === 0 ? (
          <p className="t-body text-slate-500">사실표에 숫자가 아직 없습니다. <button type="button" className="text-brand-700 hover:underline" onClick={() => goTo('factsheet')}>사실표 열기</button></p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {numberCandidates.map((f) => {
              const v = p.factsheet[f.key]!
              const on = fr.numbersToMemorize.includes(f.key)
              const demo = v.status === 'demo'
              return (
                <CheckRow
                  key={f.key}
                  label={`${f.label}: ${v.value}`}
                  hint={`${FACT_STATUS_LABEL[v.status]}${demo ? ' — 시연용은 외울 숫자로 쓰지 않는다' : ''}`}
                  checked={on}
                  onChange={(val) => {
                    if (val && demo) return
                    set({ numbersToMemorize: val ? [...fr.numbersToMemorize, f.key as FactKey] : fr.numbersToMemorize.filter((k) => k !== f.key) })
                  }}
                />
              )
            })}
          </div>
        )}
      </Block>

      <Block title="Evidence Pack — 한 폴더에" hint="회사 · 대표자 · 기술 · 개발 · 사업 · 시장 (§47)">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {EVIDENCE_PACK.map((e) => (
            <CheckRow key={e.key} label={`[${e.group}] ${e.label}`} checked={fr.evidencePackChecked[e.key] === true} onChange={(v) => set({ evidencePackChecked: { ...fr.evidencePackChecked, [e.key]: v } })} />
          ))}
        </div>
      </Block>

      <Block title="금지 표현 — 증빙 없이는 말하지 않는다" hint="Script 와 Key Point 에서 자동으로 찾아 위에 표시합니다.">
        <div className="flex flex-wrap gap-1.5">
          {FORBIDDEN_PHRASES.map((f) => (
            <Badge key={f.label} tone={forbidden.includes(f.label) ? 'danger' : 'neutral'}>{f.label} — {f.why}</Badge>
          ))}
        </div>
      </Block>

      <div id="mock" className={focus === 'mock' ? 'rounded-(--radius-panel) ring-2 ring-brand-300' : ''}>
        <Block title="Mock Review · 결과">
          <CheckRow label="실사 전 Mock Judge 점검 1회 했음" checked={fr.mockReviewDone} onChange={(v) => { set({ mockReviewDone: v }); if (v) void decide({ stageKey: 'S15', kind: 'stage', summary: '실사 Mock Review 1회 완료' }) }} />
          <div id="result">
            <TextField label="S16 · 결과 · 후속 (본개발 · 정책자금 · 지원사업 연계)" value={fr.result} multiline rows={4} onCommit={(v) => set({ result: v })} />
          </div>
          <Button size="sm" className="self-start" onClick={() => goTo('artifacts', 'RESULT_RECORD')}>결과 기록 산출물로 저장</Button>
        </Block>
      </div>
    </div>
  )
}
