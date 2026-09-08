/**
 * 특허 작업공간 — 5개 고정 질문 · 선행기술 · 발명자/출원인 · KIPO 참고자료(2~5종) · 출원 기록 · 최신 기준 확인.
 */

import { useState } from 'react'
import { ExternalLink, Search, Trash2 } from 'lucide-react'
import { Badge, Disclosure, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import { KIPO_CATEGORY_LABEL, KIPO_MAX, KIPO_SYSTEM_STARTERS, kipoByCode, kipoPdfUrl, kipoRequestText, kipoSelectionIssues, searchKipo } from '../../domain/consulting/kipoReferences'
import { freshnessOk } from '../../domain/consulting/gateEngine'
import { todayLocalDate } from '../../lib/appClock'
import type { KipoCategory, PatentWorkspace } from '../../types/consulting'
import { Block, CheckRow, CopyButton, SelectField, TextField } from './studioParts'
import { FreshnessBlock } from './FreshnessBlock'

export function PatentTab({ focus }: { focus?: string }) {
  const { project: p, update, goTo, today, decide } = useEditor()
  const set = (patch: Partial<PatentWorkspace>) => update((cur) => ({ ...cur, patent: { ...cur.patent, ...patch } }))
  const pt = p.patent

  return (
    <div className="flex flex-col gap-4">
      <Surface edge="brand" showEdge>
        <h2 className="t-section text-slate-900">특허 — 아이디어부터 출원까지</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">
          아이디어·기술구조·명세서 초안은 미래AI랩이 직접 정리합니다. 고객에게 발명설명서·도면을 새로 요구하지 않습니다. 출원 ≠ 등록.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('prompts', 'PATENT_IDEA')}>아이디어 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'PRIOR_ART_REVIEW')}>선행기술 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'PATENT_SPEC_DRAFT')}>명세서 프롬프트</Button>
        </div>
      </Surface>

      <Block title="S3 · 특허 아이디어 — 5개 고정 질문" hint="Master §8. 특허명은 마케팅 문구가 아니라 기술구조가 읽혀야 합니다.">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="① 현재 문제" value={pt.problem} multiline rows={3} placeholder="무엇이 반복적으로 어렵거나 비효율적인가" onCommit={(v) => set({ problem: v })} />
          <TextField label="② 기존 방식" value={pt.existingMethod} multiline rows={3} placeholder="지금은 어떻게 해결하며 왜 부족한가" onCommit={(v) => set({ existingMethod: v })} />
          <TextField label="③ 차별 구조" value={pt.differentStructure} multiline rows={3} placeholder="기존과 무엇이 구조적으로 다른가" onCommit={(v) => set({ differentStructure: v })} />
          <TextField label="④ 처리 흐름" value={pt.processFlow} multiline rows={3} placeholder="입력 → 정리 → 판단/분석/추천/최적화 → 출력 → Action → 재반영" onCommit={(v) => set({ processFlow: v })} />
          <TextField label="⑤ 권리화 포인트" value={pt.claimPoint} multiline rows={3} placeholder="경쟁사가 가장 쉽게 베낄 구조·처리순서·연결관계" onCommit={(v) => set({ claimPoint: v })} />
          <TextField label="특허 제목 후보" value={pt.titleCandidates} multiline rows={3} placeholder="[대상/데이터] 기반 [핵심 판단·처리] 및 [실행·결과] 시스템/방법" onCommit={(v) => set({ titleCandidates: v })} />
        </div>
      </Block>

      <Block title="S4 · 선행기술 검토" hint="KIPRIS 조사 = 신규성·진보성. KIPO 예시 = 표현 참고. 둘은 다릅니다 (§10).">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="검색 키워드" value={pt.priorArtKeywords} multiline rows={3} placeholder="한국어·영어·동의어" onCommit={(v) => set({ priorArtKeywords: v })} />
          <TextField label="확인 결과 · 차별화 포인트" value={pt.priorArtFindings} multiline rows={3} placeholder="무엇을 빼고 좁히고 강조할지" onCommit={(v) => set({ priorArtFindings: v })} />
        </div>
      </Block>

      <Block title="발명자 · 출원인 · 권리귀속 — Integrity Gate" hint="발명자는 '구체적인 기술적 사상의 창작에 실제로 기여했는가' 로 판단합니다 (§9). 스토리를 위해 지정하지 않습니다.">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="발명자 (실제 기여 기준)" value={pt.inventors} onCommit={(v) => set({ inventors: v })} />
          <TextField label="출원인 (개인 / 법인)" value={pt.applicant} onCommit={(v) => set({ applicant: v })} />
          <TextField label="승계·양도 메모" value={pt.rightsNote} onCommit={(v) => set({ rightsNote: v })} placeholder="발명자≠출원인이면 관계 설명" />
        </div>
      </Block>

      <div id="kipo">
        <KipoBlock highlighted={focus === 'kipo'} />
      </div>

      <Block title="S7 · 출원 기록" hint="출원번호통지서·제출본·납부자료를 보관합니다. 등록 전에는 '특허출원 중' 으로만 씁니다 (§14).">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="출원 상태"
            value={pt.filingStatus}
            options={[{ value: 'none', label: '미출원' }, { value: 'filed', label: '출원 중' }, { value: 'registered', label: '등록' }]}
            onChange={(v) => {
              set({ filingStatus: v })
              if (v !== pt.filingStatus) void decide({ stageKey: 'S7', kind: 'stage', summary: `특허 상태 → ${v === 'none' ? '미출원' : v === 'filed' ? '출원 중' : '등록'}` })
            }}
          />
          <TextField label="출원번호" value={pt.applicationNumber} placeholder="10-2026-0000000" onCommit={(v) => set({ applicationNumber: v })} />
          <TextField label="출원일" type="date" value={pt.filedAt} onCommit={(v) => set({ filedAt: v })} />
          <TextField label="심사청구 기한" type="date" value={pt.examRequestDue} onCommit={(v) => set({ examRequestDue: v })} />
        </div>
        {pt.filingStatus === 'filed' && <p className="t-meta mt-2 text-slate-500">사실표 '특허' 항목에도 "출원 중 · {pt.applicationNumber || '번호'} · {pt.filedAt || '날짜'}" 로 적어 두면 사업계획서 프롬프트에 그대로 들어갑니다.</p>}
      </Block>

      <div id="freshness">
        <FreshnessBlock scope="patent_filing" title="출원 직전 최신 공식 기준 확인 (특허로)" ok={freshnessOk(p, 'patent_filing', today)} highlighted={focus === 'freshness'} />
      </div>
    </div>
  )
}

function KipoBlock({ highlighted }: { highlighted: boolean }) {
  const { project: p, update, decide } = useEditor()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<KipoCategory | 'all'>('all')
  const results = q.trim() === '' && cat === 'all' ? [] : searchKipo(q, cat).slice(0, 30)
  const issues = kipoSelectionIssues(p.kipo)
  const selectedCodes = new Set(p.kipo.map((s) => s.code))

  const add = (code: string) => {
    if (selectedCodes.has(code) || p.kipo.length >= KIPO_MAX) return
    update((cur) => ({ ...cur, kipo: [...cur.kipo, { code, reason: '', pdfAttached: false }] }))
    void decide({ stageKey: 'S5', kind: 'reference', summary: `KIPO 참고자료 ${code} 선정` })
  }
  const remove = (code: string) => update((cur) => ({ ...cur, kipo: cur.kipo.filter((s) => s.code !== code) }))
  const patch = (code: string, v: Partial<{ reason: string; pdfAttached: boolean }>) => update((cur) => ({ ...cur, kipo: cur.kipo.map((s) => (s.code === code ? { ...s, ...v } : s)) }))

  return (
    <section className={`flex flex-col gap-3 rounded-(--radius-panel) border bg-white p-4 sm:p-5 ${highlighted ? 'border-brand-400 ring-1 ring-brand-300' : 'border-slate-200'}`}>
      <div>
        <h3 className="t-card text-slate-900">S5 · KIPO 명세서 작성 예시 — 참고자료 2~5종</h3>
        <p className="t-sub mt-0.5 break-keep text-slate-500">118종 중 사람이 고릅니다. 기준 4축: 기술분야 · 발명형태 · 처리구조 · 청구항/도면 참고가치. 선행기술 조사를 대체하지 않습니다 (§11).</p>
      </div>

      {p.kipo.length > 0 && (
        <ul className="flex flex-col gap-2">
          {p.kipo.map((s) => {
            const ref = kipoByCode(s.code)
            return (
              <li key={s.code} className="rounded-(--radius-card) border border-slate-200 p-3">
                {/* 좁은 폭에서는 제목이 한 줄을 다 쓰고 PDF·빼기 단추는 다음 줄로 (flex-1 + shrink-0 짜부라짐 방지, D-23) */}
                <div className="flex flex-wrap items-start gap-2">
                  <span className="t-meta font-bold text-slate-500">{s.code}</span>
                  <span className="t-body order-3 w-full min-w-0 break-keep text-slate-900 sm:order-none sm:w-auto sm:flex-1">{ref?.title ?? '(목록에 없는 코드)'}</span>
                  <a href={kipoPdfUrl(s.code)} target="_blank" rel="noreferrer" className="t-meta inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                    PDF <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                  <button type="button" aria-label={`${s.code} 빼기`} onClick={() => remove(s.code)} className="tap rounded-(--radius-control) p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-600">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {ref && <p className="t-meta mt-0.5 text-slate-500">{KIPO_CATEGORY_LABEL[ref.category]} · {ref.field}</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <TextField label="선정 이유 (4축 중 무엇을 참고하나)" value={s.reason} onCommit={(v) => patch(s.code, { reason: v })} placeholder="예: 데이터 입력→AI 판단→제어 흐름의 청구항 구조" />
                  <CheckRow label="PDF 받아 첨부함" checked={s.pdfAttached} onChange={(v) => patch(s.code, { pdfAttached: v })} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {issues.map((i) => (
            <li key={i} className="t-sub flex items-start gap-2 break-keep text-slate-700">
              <Badge tone="warning">확인</Badge>
              {i}
            </li>
          ))}
        </ul>
      ) : p.kipo.length > 0 ? (
        <p className="t-sub text-success-700">선정 규칙 통과 — 2~5종 · 이유 · PDF.</p>
      ) : null}

      {p.kipo.length > 0 && <CopyButton text={kipoRequestText(p.kipo)} label="첨부 요청문 복사" />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="코드·분야·발명의 명칭 검색 (예: 머신 러닝, 제어, 0217)" aria-label="참고자료 검색" className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 pl-9 pr-3" />
        </label>
        <select aria-label="분야" value={cat} onChange={(e) => setCat(e.target.value as KipoCategory | 'all')} className="t-body h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3">
          <option value="all">모든 분야</option>
          {(Object.keys(KIPO_CATEGORY_LABEL) as KipoCategory[]).map((c) => (
            <option key={c} value={c}>{KIPO_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>

      {results.length === 0 && q.trim() === '' && (
        <div>
          <p className="t-meta text-slate-500">시스템/AX/플랫폼 발명이면 먼저 볼 만한 사례 (자동 선정 아님):</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {KIPO_SYSTEM_STARTERS.map((code) => {
              const r = kipoByCode(code)!
              return (
                <button key={code} type="button" disabled={selectedCodes.has(code)} onClick={() => add(code)} className="t-meta rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40">
                  {code} · {r.title.slice(0, 22)}{r.title.length > 22 ? '…' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-(--radius-card) border border-slate-200">
          {results.map((r) => (
            <li key={r.code} className="flex items-start gap-2 px-3 py-2">
              <span className="t-meta mt-0.5 w-10 shrink-0 font-bold text-slate-500">{r.code}</span>
              <span className="min-w-0 flex-1">
                <span className="t-sub block break-keep text-slate-900">{r.title}</span>
                <span className="t-meta block text-slate-500">{KIPO_CATEGORY_LABEL[r.category]} · {r.field}</span>
              </span>
              <Button size="sm" disabled={selectedCodes.has(r.code) || p.kipo.length >= KIPO_MAX} onClick={() => add(r.code)}>
                {selectedCodes.has(r.code) ? '선정됨' : '고르기'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Disclosure title="사용 금지" hint="Master §11-2">
        <ul className="list-disc pl-5">
          {['예시 문장을 그대로 복제', '예시의 발명구성을 고객사 기술인 것처럼 사용', '예시 특허가 있다는 이유로 신규성 판단 완료', 'KIPO 예시를 선행기술 조사 대체재로 사용'].map((t) => (
            <li key={t} className="t-sub text-slate-600">{t}</li>
          ))}
        </ul>
      </Disclosure>
      <p className="t-meta text-slate-400">오늘 {todayLocalDate()} 기준 목록. 특허청 예시 목록이 바뀌면 코드로 다시 확인합니다.</p>
    </section>
  )
}
