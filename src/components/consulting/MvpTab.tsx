/**
 * MVP 작업공간 — Strategy Lock (MVP_SPEC) + LIVE/DEMO/FUTURE + Not Building.
 * Master PART 3 §2 · PART 4 §17~22. AX 방식이 실제 AI 가 아니면 AI 라 부르지 않는다.
 */

import { Badge, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import type { MvpWorkspace } from '../../types/consulting'
import { Block, SelectField, TextField } from './studioParts'

const AX_MODES: { value: MvpWorkspace['axMode']; label: string; ai: boolean }[] = [
  { value: '', label: '아직 안 정함', ai: false },
  { value: 'rule', label: 'Rule — 조건이 명확한 판단', ai: false },
  { value: 'scoring', label: 'Scoring — 여러 조건에 점수', ai: false },
  { value: 'optimization', label: 'Optimization — 일정·조합 최적화', ai: false },
  { value: 'ml', label: 'ML 예측모델 (실제 학습·추론)', ai: true },
  { value: 'rag', label: 'RAG — 문서 기반 답변', ai: true },
  { value: 'llm', label: 'LLM — 자연어 생성·상담', ai: true },
  { value: 'demo', label: 'Demo Logic — 시연용', ai: false },
]

export function MvpTab({ focus }: { focus?: string }) {
  const { project: p, update, goTo } = useEditor()
  const m = p.mvp
  const set = (patch: Partial<MvpWorkspace>) => update((cur) => ({ ...cur, mvp: { ...cur.mvp, ...patch } }))
  const mode = AX_MODES.find((x) => x.value === m.axMode)

  return (
    <div className="flex flex-col gap-4">
      <Surface edge="brand" showEdge>
        <h2 className="t-section text-slate-900">MVP — 전략 잠금 → 구현·QA</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">
          Less Scope, Same Polish. 핵심 Journey 1개 · AX 핵심기능 1개 · Platform Surface 1개 · Future Preview 6~10. Primary Journey 는 특허 핵심기술과 같아야 합니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('prompts', 'MVP_STRATEGY')}>전략 잠금 프롬프트</Button>
          <Button size="sm" onClick={() => goTo('prompts', 'MVP_CLAUDE_CODE_BUILD')}>Claude Code 빌드 프롬프트</Button>
        </div>
      </Surface>

      <Block title="S8 · MVP_SPEC" hint="핵심가설: [대상 고객]이 [기존 문제] 때문에 겪는 불편을 [핵심 기능/방식]으로 해결하면 [핵심 행동/전환]을 만들 수 있다.">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="PRODUCT" value={m.productName} onCommit={(v) => set({ productName: v })} />
          <TextField label="ONE-LINE VALUE" value={m.oneLineValue} onCommit={(v) => set({ oneLineValue: v })} />
          <TextField label="TARGET USER" value={m.targetUser} onCommit={(v) => set({ targetUser: v })} />
          <TextField label="MVP URL" type="url" value={m.mvpUrl} placeholder="https://" onCommit={(v) => set({ mvpUrl: v })} hint="사실표 'MVP URL' 과 같은 값을 둡니다." />
          <div className="md:col-span-2">
            <TextField label="PRIMARY PROOF JOURNEY (특허 핵심기술과 동일)" value={m.primaryJourney} multiline rows={3} placeholder="예: 작업지시 입력 → 지연 위험 산출 → 우선순위 추천 → 담당자 Action → 결과 재반영" onCommit={(v) => set({ primaryJourney: v })} />
          </div>
          <div id="axCoreFeature" className={focus === 'axCoreFeature' ? 'rounded-(--radius-card) ring-2 ring-brand-300' : ''}>
            <TextField label="AX CORE FEATURE (1개, 최대 2)" value={m.axCoreFeature} multiline rows={3} placeholder="분석·추천·최적화 중 실제로 동작하는 것" onCommit={(v) => set({ axCoreFeature: v })} />
          </div>
          <div>
            <SelectField label="AX 방식 — AI 라 부를 수 있는 근거" value={m.axMode} options={AX_MODES.map((x) => ({ value: x.value, label: x.label }))} onChange={(v) => set({ axMode: v })} />
            {mode && mode.value !== '' && (
              <p className="t-meta mt-1 break-keep text-slate-500">
                {mode.ai ? <Badge tone="success">AI 라고 표현 가능</Badge> : <Badge tone="warning">AI 라 부르지 않는다</Badge>}{' '}
                {mode.ai ? '실제 모델·검색·생성이 동작할 때만 이 방식을 고릅니다.' : '분석로직 · 자동판단 · 점수기반 추천 · 최적화 로직 · 의사결정 지원 으로 씁니다 (§18-2). 결과 아래 근거 2~3개.'}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <TextField label="PLATFORM SURFACE (고객·거래처·현장 사용자 화면)" value={m.platformSurface} multiline rows={2} placeholder="예: 거래처 발주·납기 조회 Portal / 현장 직원 작업보고 모바일" onCommit={(v) => set({ platformSurface: v })} />
          </div>
        </div>
      </Block>

      <Block title="LIVE / DEMO / FUTURE — Integrity" hint="Future 기능을 현재처럼 표시하지 않습니다. Future 는 Modal/Sheet 로 설명만, 빈 페이지·404 없음 (§20~21).">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="LIVE — 실제 동작" value={m.live} multiline rows={4} onCommit={(v) => set({ live: v })} />
          <TextField label="DEMO — 시연 로직·데이터" value={m.demo} multiline rows={4} onCommit={(v) => set({ demo: v })} />
          <TextField label="FUTURE — Preview 6~10" value={m.future} multiline rows={4} placeholder="한 줄에 하나" onCommit={(v) => set({ future: v })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="NOT BUILDING (범위 폭증 방지)" value={m.notBuilding} multiline rows={3} placeholder="실제 결제 · SMS · OAuth 전체 · 다중 권한 · Native …" onCommit={(v) => set({ notBuilding: v })} />
          <TextField label="DEMO DATA ASSUMPTION" value={m.demoDataAssumption} multiline rows={3} placeholder="업종에 맞고 서로 일관된 가정. 실적처럼 보이지 않게." onCommit={(v) => set({ demoDataAssumption: v })} />
        </div>
        <TextField label="REFERENCE STYLE / DEFAULT THEME" value={m.referenceStyle} placeholder="예: Deep Teal · 흰 Enterprise UI · 참고 사이트" onCommit={(v) => set({ referenceStyle: v })} />
      </Block>

      <Block title="S9 · 구현·QA 체크 (사람이 확인)" hint="URL 열림 · 390/430 실측 · Primary Journey 클릭 완주 · 404/Dead CTA 0 · 3분 Demo — QA_REPORT 를 산출물 'MVP_STATE' 로 저장합니다.">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => goTo('artifacts', 'MVP_STATE')}>MVP_STATE / QA 기록</Button>
          {m.mvpUrl && (
            <a href={m.mvpUrl} target="_blank" rel="noreferrer" className="t-sub inline-flex h-10 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50">
              MVP 열기
            </a>
          )}
        </div>
      </Block>
    </div>
  )
}
