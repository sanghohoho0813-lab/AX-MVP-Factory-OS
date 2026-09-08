/**
 * 다음 행동 — 규칙으로 1~3개를 낸다 (Master §2-2 NEXT_ACTION_1~3, K6, §55).
 *
 * 같은 입력이면 같은 출력이다. 우선순위:
 *   1 막힘 해소 → 2 게이트 미결 → 3 현재 단계의 빈 필요 사실 → 4 필요 산출물(없으면 프롬프트, 있으면 들여오기)
 *   → 5 참고자료 선정/PDF → 6 최신 기준 확인 → 7 단계 완료 (또는 완료 조건 채우기)
 */

import type {
  ArtifactType,
  ConsultingArtifact,
  ConsultingEvidence,
  ConsultingProject,
  ConsultingPromptPackage,
  NextAction,
  StageKey,
} from '../../types/consulting'
import { stageDef } from './workflowDefinition'
import { factDef, missingFacts } from './factsheetSchema'
import { artifactDef, artifactTypeForPrompt } from './artifactDefinitions'
import { canCompleteStage, freshnessOk } from './gateEngine'
import { blockedStages } from './projectModel'
import { CORE_THREAD_KEYS, CORE_THREAD_LABEL } from './projectModel'
import { coreThreadWarnings } from './coreThread'

export interface ResolverContext {
  artifacts: ConsultingArtifact[]
  prompts: ConsultingPromptPackage[]
  evidence: ConsultingEvidence[]
  today: string
}

const MAX = 3

export function resolveNextActions(p: ConsultingProject, ctx: ResolverContext): NextAction[] {
  const out: NextAction[] = []
  const push = (a: NextAction) => {
    if (out.length < MAX && !out.some((x) => x.kind === a.kind && x.focus === a.focus && x.stageKey === a.stageKey)) out.push(a)
  }
  const cur = p.currentStage
  const def = stageDef(cur)

  if (p.status === 'done' || p.status === 'archived') return out

  // 1 막힘
  for (const k of blockedStages(p)) {
    push({
      kind: 'resolve_block', stageKey: k, tab: 'stages', focus: k,
      title: `${stageDef(k).label} 막힘 풀기`,
      why: p.stages[k].blockedBy.trim() !== '' ? `막힌 이유: ${p.stages[k].blockedBy.trim()}` : '막힘으로 표시된 단계가 있습니다.',
    })
  }

  // 2 게이트 (S1 이후인데 결정이 없으면 언제나 먼저)
  if (p.gate.decision === null && Number(cur.slice(1)) >= 1) {
    push({ kind: 'answer_gate', stageKey: 'S1', tab: 'stages', focus: 'S1', title: 'GO / HOLD / NO-GO 정하기', why: '판정 없이 특허·MVP 를 시작하면 되돌아오는 비용이 큽니다 (Master §4).' })
  }

  // 3 빈 필요 사실
  const missing = missingFacts(p.factsheet, def.requiredFacts)
  for (const k of missing.slice(0, 2)) {
    push({ kind: 'fill_fact', stageKey: cur, tab: 'factsheet', focus: k, title: `사실표 · ${factDef(k).label} 채우기`, why: `${def.label} 단계를 끝내려면 필요한 사실입니다.` })
  }

  // 3-b 핵심 줄기 — S2 이후에는 앞 3칸이 비어 있으면 채우게 한다
  if (Number(cur.slice(1)) >= 2) {
    const firstEmpty = CORE_THREAD_KEYS.slice(0, 3).find((k) => p.coreThread[k].trim() === '')
    if (firstEmpty) push({ kind: 'fill_thread', stageKey: cur, tab: 'thread', focus: firstEmpty, title: `핵심 줄기 · ${CORE_THREAD_LABEL[firstEmpty]} 적기`, why: '특허·MVP·사업계획서가 같은 기술을 말하게 하는 한 줄입니다 (Master §35).' })
  }

  // 4 산출물 — 없으면 프롬프트 만들기, 프롬프트는 있는데 결과가 없으면 들여오기
  const mine = ctx.artifacts.filter((a) => a.projectId === p.id && a.status !== 'superseded')
  const myPrompts = ctx.prompts.filter((x) => x.projectId === p.id)
  for (const type of def.requiredArtifacts) {
    if (mine.some((a) => a.type === type)) continue
    const promptType = def.promptTypes.find((pt) => artifactTypeForPrompt(pt) === type) ?? null
    if (promptType === null) {
      push({ kind: 'import_result', stageKey: cur, tab: 'artifacts', focus: type, title: `${labelOf(type)} 기록하기`, why: '이 단계의 산출물입니다. 직접 적어 저장합니다.' })
    } else if (myPrompts.some((x) => x.type === promptType)) {
      push({ kind: 'import_result', stageKey: cur, tab: 'prompts', focus: promptType, title: `${labelOf(type)} 결과 들여오기`, why: '프롬프트는 만들었는데 결과가 아직 없습니다. 붙여 넣어 저장합니다.' })
    } else {
      push({ kind: 'generate_prompt', stageKey: cur, tab: 'prompts', focus: promptType, title: `${labelOf(type)} 프롬프트 만들기`, why: '이 단계의 산출물을 만들 프롬프트 꾸러미입니다. 복사해 나가서 결과를 가져옵니다.' })
    }
  }

  // 5 참고자료
  if (cur === 'S5') {
    if (p.kipo.length < 2) push({ kind: 'select_reference', stageKey: cur, tab: 'patent', focus: 'kipo', title: 'KIPO 참고자료 2~5종 고르기', why: '명세서 구조·표현을 참고할 사례입니다. 선행기술 조사와는 다릅니다 (Master §11).' })
    else if (p.kipo.some((s) => !s.pdfAttached)) push({ kind: 'attach_pdf', stageKey: cur, tab: 'patent', focus: 'kipo', title: '참고자료 PDF 받기', why: 'PDF 를 받기 전에는 세부 문구를 추측해 쓰지 않습니다.' })
  }

  // 6 최신 기준
  if (cur === 'S7' && !freshnessOk(p, 'patent_filing', ctx.today)) {
    push({ kind: 'check_policy', stageKey: cur, tab: 'patent', focus: 'freshness', title: '특허로 최신 기준 확인 기록', why: '출원 직전 공식 기준이 이 Master 보다 우선합니다 (K9).' })
  }
  if (cur === 'S14' && !freshnessOk(p, 'venture_application', ctx.today)) {
    push({ kind: 'check_policy', stageKey: cur, tab: 'venture', focus: 'freshness', title: '벤처확인시스템 최신 기준 확인 기록', why: '글자수·첨부수·용량·발급일이 바뀔 수 있습니다 (K9).' })
  }

  // 6-b 실사
  if (cur === 'S15') {
    if (p.fieldReview.qa.length < 10) push({ kind: 'field_review', stageKey: cur, tab: 'review', focus: 'qa', title: '예상질문 10~15개 만들기', why: '실사 전 세트: Script · Demo · Q&A · Evidence Pack · 숫자 · 금지표현 · Mock (Master §43).' })
    if (!p.fieldReview.mockReviewDone) push({ kind: 'field_review', stageKey: cur, tab: 'review', focus: 'mock', title: 'Mock Review 1회', why: '실사 전에 한 번은 남이 물어봐야 합니다.' })
  }
  if (cur === 'S16') push({ kind: 'record_result', stageKey: cur, tab: 'review', focus: 'result', title: '결과 기록', why: '결과와 후속(본개발·자금)을 남깁니다.' })

  // 7 단계 완료
  if (out.length < MAX) {
    const gate = canCompleteStage(p, cur, ctx)
    if (gate.ok) {
      push({ kind: 'complete_stage', stageKey: cur, tab: 'stages', focus: cur, title: `${def.label} 완료로 넘기기`, why: '필요한 사실·산출물이 갖춰졌습니다. exit checklist 를 확인하고 넘깁니다.' })
    } else if (out.length === 0) {
      push({ kind: 'complete_stage', stageKey: cur, tab: 'stages', focus: cur, title: `${def.label} 완료 조건 채우기`, why: gate.blockers[0] })
    }
  }

  // 그래도 비면 핵심 줄기 P1
  if (out.length < MAX) {
    const w = coreThreadWarnings(p).find((x) => x.severity !== 'info')
    if (w) push({ kind: 'fill_thread', stageKey: cur, tab: w.tab, focus: w.focus, title: '핵심 줄기 경고 해결', why: w.message })
  }

  return out
}

function labelOf(type: ArtifactType): string {
  return artifactDef(type).label
}

/** 단계 자동 이동 — 완료 후 다음 미완료 단계 */
export function nextOpenStage(p: ConsultingProject, from: StageKey): StageKey {
  const order = Object.keys(p.stages) as StageKey[]
  const i = order.indexOf(from)
  for (let j = i + 1; j < order.length; j += 1) {
    const s = p.stages[order[j]].status
    if (s !== 'completed' && s !== 'skipped') return order[j]
  }
  return from
}
