/**
 * 한 번 누르면 뒤에서 벌어지는 일 (§43 AUTO SIDE EFFECTS).
 *
 * 사용자는 [계속하기] 하나를 눌렀지만 여기서:
 *   값 저장 → 핵심 줄기 갱신 → 결정 기록 → 단계 완료 → 다음 단계 이동
 * 까지 한 번에 처리한다. 다섯 화면을 더 돌게 하지 않기 위한 것이다.
 *
 * 순수 함수다. 저장은 부르는 쪽이 한다.
 */

import type { ConsultingProject, DecisionKind, StageKey } from '../../types/consulting'
import type { CurrentTask, InputTarget, TaskContext } from './currentTask'
import { activeStage, stageSatisfied } from './currentTask'
import { STAGE_ORDER, stageDef } from './workflowDefinition'
import { emptyFact } from './factsheetSchema'
import { GATE_CHOICES } from './operatorChoices'
import { RED_FLAGS } from './qaRules'
import { kipoByCode } from './kipoReferences'

export interface TaskSubmission {
  /** INPUT — inputs 순서대로의 값 */
  values?: string[]
  /** SELECT — 고른 값들 */
  selected?: string[]
}

export interface PendingDecision {
  stageKey: StageKey
  kind: DecisionKind
  summary: string
  reason: string
}

export interface TaskOutcome {
  project: ConsultingProject
  decisions: PendingDecision[]
}

/* ------------------------------------------------------------------ */
/* 값 쓰기                                                              */
/* ------------------------------------------------------------------ */

function writeTarget(p: ConsultingProject, target: InputTarget, value: string, at: string, source: string): ConsultingProject {
  const v = value.trim()
  if (v === '') return p
  switch (target.kind) {
    case 'fact': {
      const prev = p.factsheet[target.key] ?? emptyFact()
      return {
        ...p,
        factsheet: {
          ...p.factsheet,
          // 사람이 직접 확인해 넣은 값이므로 '확인됨'. 출처는 어디서 왔는지 그대로 남긴다.
          [target.key]: { ...prev, value: v, status: 'confirmed', source: prev.source || source, asOfDate: prev.asOfDate || at.slice(0, 10), updatedAt: at },
        },
      }
    }
    case 'mvp':
      return { ...p, mvp: { ...p.mvp, [target.key]: v } }
    case 'patent':
      return { ...p, patent: { ...p.patent, [target.key]: v } }
    case 'thread':
      return { ...p, coreThread: { ...p.coreThread, [target.key]: v } }
    case 'venture':
      return { ...p, venture: { ...p.venture, [target.key]: v } }
    case 'review':
      return { ...p, fieldReview: { ...p.fieldReview, [target.key]: v } }
    default:
      return p
  }
}

/** 핵심 줄기는 사람이 따로 적지 않는다 — 사실표·작업공간에서 자동으로 따라온다 */
function syncCoreThread(p: ConsultingProject): ConsultingProject {
  const t = { ...p.coreThread }
  const pick = (cur: string, next: string | undefined) => (cur.trim() !== '' ? cur : (next ?? '').trim())
  t.fieldProblem = pick(t.fieldProblem, p.factsheet.coreProblem?.value)
  t.existingMethod = pick(t.existingMethod, p.factsheet.currentMethod?.value)
  t.coreTech = pick(t.coreTech, p.factsheet.coreTech?.value)
  t.axCore = pick(t.axCore, p.mvp.axCoreFeature)
  t.platformSurface = pick(t.platformSurface, p.mvp.platformSurface || p.factsheet.platformUsers?.value)
  t.ventureSentence = pick(t.ventureSentence, p.factsheet.coreTech?.value)
  return { ...p, coreThread: t }
}

/* ------------------------------------------------------------------ */
/* 단계 자동 전환                                                        */
/* ------------------------------------------------------------------ */

function completeStage(p: ConsultingProject, stage: StageKey, at: string): ConsultingProject {
  return {
    ...p,
    stages: { ...p.stages, [stage]: { ...p.stages[stage], status: 'completed', completedAt: at, updatedAt: at } },
  }
}

/**
 * 조건을 채운 단계를 이어서 완료 처리하고 현재 단계를 옮긴다.
 * 되돌릴 수 없거나 사실 확인이 필요한 단계는 taskForStage 가 계속 할 일을 내므로 여기서 멈춘다.
 */
export function autoAdvance(p: ConsultingProject, ctx: TaskContext, at: string): { project: ConsultingProject; decisions: PendingDecision[] } {
  let cur = p
  const decisions: PendingDecision[] = []
  const startIndex = STAGE_ORDER.indexOf(activeStage(cur))

  for (let i = Math.max(0, startIndex); i < STAGE_ORDER.length; i += 1) {
    const stage = STAGE_ORDER[i]
    const st = cur.stages[stage].status
    if (st === 'completed' || st === 'skipped') continue
    if (!stageSatisfied(cur, stage, ctx)) {
      cur = { ...cur, currentStage: stage }
      if (cur.stages[stage].status === 'not_started') {
        cur = { ...cur, stages: { ...cur.stages, [stage]: { ...cur.stages[stage], status: 'in_progress', startedAt: cur.stages[stage].startedAt ?? at, updatedAt: at } } }
      }
      return { project: cur, decisions }
    }
    cur = completeStage(cur, stage, at)
    decisions.push({ stageKey: stage, kind: 'stage', summary: `${stage} · ${stageDef(stage).label} 완료`, reason: '필요한 정보와 산출물이 갖춰짐' })
  }
  return { project: { ...cur, currentStage: STAGE_ORDER[STAGE_ORDER.length - 1], status: 'done' }, decisions }
}

/* ------------------------------------------------------------------ */
/* 제출 처리                                                            */
/* ------------------------------------------------------------------ */

/**
 * 사용자가 지금 할 일을 마쳤을 때.
 * ctx 는 **이 행동 이후의** 상태여야 한다(결과 가져오기라면 새 산출물이 들어 있어야 한다).
 */
export function applyTask(p: ConsultingProject, task: CurrentTask, sub: TaskSubmission, ctx: TaskContext, at: string): TaskOutcome {
  let cur = p
  const decisions: PendingDecision[] = []
  const stage = task.stageKey

  switch (task.actionType) {
    case 'INPUT': {
      const inputs = task.inputs ?? []
      inputs.forEach((input, i) => {
        const value = sub.values?.[i] ?? ''
        cur = writeTarget(cur, input.target, value, at, '대표 확인')
      })
      const filled = inputs.map((x, i) => `${x.label}: ${(sub.values?.[i] ?? '').trim()}`).filter((s) => !s.endsWith(': '))
      if (filled.length > 0) decisions.push({ stageKey: stage, kind: 'fact', summary: filled.join(' / ').slice(0, 160), reason: '' })
      // 출원번호를 적으면 특허 상태도 함께 바뀐다
      if (cur.patent.applicationNumber.trim() !== '' && cur.patent.filingStatus === 'none') {
        cur = { ...cur, patent: { ...cur.patent, filingStatus: 'filed' } }
        const label = `출원 중 · ${cur.patent.applicationNumber}${cur.patent.filedAt ? ` · ${cur.patent.filedAt}` : ''}`
        cur = { ...cur, factsheet: { ...cur.factsheet, patent: { ...emptyFact(), value: label, status: 'confirmed', source: '출원번호통지서', asOfDate: cur.patent.filedAt, updatedAt: at } } }
        decisions.push({ stageKey: 'S7', kind: 'stage', summary: `특허 출원 완료 · ${cur.patent.applicationNumber}`, reason: '등록이 아니라 출원 — 서류에는 "특허출원 중"' })
      }
      break
    }

    case 'SELECT': {
      const picked = sub.selected ?? []
      const target = task.selectTarget
      if (!target) break
      if (target.kind === 'gate') {
        const choice = GATE_CHOICES.find((c) => c.value === picked[0])
        if (choice) {
          cur = { ...cur, gate: { ...cur.gate, decision: choice.value, reason: choice.label, decidedAt: at } }
          decisions.push({ stageKey: 'S1', kind: 'gate', summary: `진행 판단 · ${choice.label}`, reason: choice.hint })
          if (choice.value === 'no_go') cur = { ...cur, status: 'on_hold' }
        }
      } else if (target.kind === 'kipo') {
        const add = picked
          .filter((code) => !cur.kipo.some((s) => s.code === code))
          .map((code) => ({ code, reason: kipoByCode(code)?.field ?? '', pdfAttached: false }))
        cur = { ...cur, kipo: [...cur.kipo, ...add] }
        if (add.length > 0) decisions.push({ stageKey: 'S5', kind: 'reference', summary: `참고자료 ${add.map((a) => a.code).join(', ')} 선정`, reason: '' })
      } else if (target.kind === 'axMode') {
        const mode = picked[0] as ConsultingProject['mvp']['axMode']
        cur = { ...cur, mvp: { ...cur.mvp, axMode: mode } }
        const label = task.choices?.find((c) => c.value === picked[0])?.label ?? mode
        decisions.push({ stageKey: 'S8', kind: 'scope', summary: `AX 구현 방식 · ${label}`, reason: mode === 'ml' || mode === 'rag' || mode === 'llm' ? 'AI 라고 표현 가능' : '규칙·점수 기반 — AI 라고 부르지 않는다' })
      } else {
        const value = picked[0] ?? ''
        cur = writeTarget(cur, target, value, at, '대표 선택')
        decisions.push({ stageKey: stage, kind: 'scope', summary: value.slice(0, 160), reason: '' })
      }
      break
    }

    case 'CONFIRM': {
      switch (task.confirmKind) {
        case 'freshness_patent':
          cur = { ...cur, freshness: [{ scope: 'patent_filing', checkedAt: at.slice(0, 10), source: '특허로', differences: '' }, ...cur.freshness] }
          decisions.push({ stageKey: 'S7', kind: 'policy', summary: '특허로 최신 서식 확인', reason: '' })
          break
        case 'freshness_venture':
          cur = { ...cur, freshness: [{ scope: 'venture_application', checkedAt: at.slice(0, 10), source: '벤처확인종합관리시스템', differences: '' }, ...cur.freshness] }
          decisions.push({ stageKey: 'S14', kind: 'policy', summary: '신청 화면 최신 기준 확인', reason: '' })
          break
        case 'kipo_pdf':
          cur = { ...cur, kipo: cur.kipo.map((s) => ({ ...s, pdfAttached: true })) }
          decisions.push({ stageKey: 'S5', kind: 'reference', summary: '참고자료 PDF 확보', reason: '' })
          break
        case 'redflags':
          cur = { ...cur, venture: { ...cur.venture, redFlagsCleared: Object.fromEntries(RED_FLAGS.map((f) => [f.no, true])) } }
          decisions.push({ stageKey: 'S13', kind: 'other', summary: '제출 전 위험 항목 12가지 확인', reason: '' })
          break
        case 'stage_done':
        default:
          decisions.push({ stageKey: stage, kind: 'stage', summary: `${task.headline} — 확인`, reason: '' })
          // "이대로 맞습니다" 는 그 단계를 끝낸다는 뜻이다.
          // 나머지 확인(최신 서식·PDF·위험 항목)은 단계의 일부일 뿐이므로 autoAdvance 가 판단한다.
          cur = completeStage(cur, stage, at)
          break
      }
      break
    }

    case 'IMPORT_RESULT':
    case 'GENERATE_PROMPT':
    case 'UPLOAD':
    case 'CONTINUE':
    default:
      // 산출물·프롬프트 저장은 서비스가 이미 했다. 여기서는 전환만 본다.
      break
  }

  cur = syncCoreThread(cur)
  const advanced = autoAdvance(cur, ctx, at)
  return { project: advanced.project, decisions: [...decisions, ...advanced.decisions] }
}
