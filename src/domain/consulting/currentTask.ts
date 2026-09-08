/**
 * 지금 할 일 하나 — 운영자 레이어의 전부.
 *
 * 화면은 단계도 프롬프트 종류도 모른다. 이 함수가 돌려주는 CurrentTask 하나만 그린다.
 * "17단계를 사람이 관리하는 것이 아니라, 17단계가 사람을 안내한다" 를 코드로 옮긴 것이다.
 *
 * 규칙
 *   - 순수 함수다. 같은 상태 → 같은 CurrentTask(id 포함). 테스트가 이것을 고정한다.
 *   - 한 번에 하나만 묻는다. 폼 전체를 던지지 않는다.
 *   - 이미 아는 것은 묻지 않는다. 비어 있는 칸만 묻는다.
 *   - 자동 추정 금지 목록(매출·직원수·특허상태 …)은 반드시 사람에게 묻는다.
 */

import type {
  ArtifactType,
  ConsultingArtifact,
  ConsultingEvidence,
  ConsultingProject,
  ConsultingPromptPackage,
  CoreThreadKey,
  FactKey,
  MvpWorkspace,
  PatentWorkspace,
  PromptPackageType,
  StageKey,
} from '../../types/consulting'
import { STAGE_ORDER, stageDef } from './workflowDefinition'
import { factDef, factFilled, missingFacts } from './factsheetSchema'
import { artifactTypeForPrompt } from './artifactDefinitions'
import { freshnessOk, redFlagsRemaining } from './gateEngine'
import { evidenceIssues } from './gateEngine'
import { AX_MODE_CHOICES, CORE_PROBLEM_CHOICES, CURRENT_METHOD_CHOICES, GATE_CHOICES, PLATFORM_USER_CHOICES } from './operatorChoices'
import { KIPO_SYSTEM_STARTERS, kipoByCode } from './kipoReferences'
import { parseReturnBlock } from './returnBlock'

/* ------------------------------------------------------------------ */
/* 타입                                                                 */
/* ------------------------------------------------------------------ */

export type OperatorActionType =
  | 'CONFIRM'
  | 'SELECT'
  | 'INPUT'
  | 'UPLOAD'
  | 'GENERATE_PROMPT'
  | 'IMPORT_RESULT'
  | 'CONTINUE'

/** 입력값이 어디로 저장되는지 */
export type InputTarget =
  | { kind: 'fact'; key: FactKey }
  | { kind: 'mvp'; key: keyof MvpWorkspace }
  | { kind: 'patent'; key: keyof PatentWorkspace }
  | { kind: 'thread'; key: CoreThreadKey }
  | { kind: 'venture'; key: 'submittedAt' | 'submissionNote' }
  | { kind: 'review'; key: 'result' | 'reviewDate' }

export interface TaskInput {
  target: InputTarget
  label: string
  placeholder: string
  multiline: boolean
  /** 숫자형이면 기준연도·출처를 함께 권한다 */
  numeric: boolean
}

export interface TaskChoice {
  value: string
  label: string
  hint?: string
}

export interface ReadyItem {
  label: string
  ok: boolean
}

export interface ConfirmItem {
  label: string
  value: string
  /** 확인이 필요한 값(미확인·시연용) — 사람이 봐야 한다 */
  needsCheck?: boolean
}

export interface CurrentTask {
  /** 같은 상태 → 같은 id */
  id: string
  stageKey: StageKey
  /** 화면 맨 위 한 줄 */
  headline: string
  /** 한 문장 설명 */
  detail: string
  actionType: OperatorActionType
  /** 버튼 글자 */
  primaryAction: string
  /** "준비된 정보 8/9" 용 */
  ready: ReadyItem[]
  /** 다음에 무엇이 오는지 한 줄 */
  nextPreview: string

  confirmItems?: ConfirmItem[]
  choices?: TaskChoice[]
  /** 여러 개 고르기 (참고자료 2~5종) */
  multi?: { min: number; max: number }
  /** 고른 값을 어디에 저장하나 (SELECT) */
  selectTarget?: InputTarget | { kind: 'gate' } | { kind: 'kipo' } | { kind: 'axMode' }
  /** 직접 입력 허용 (SELECT) */
  allowFreeText?: boolean
  inputs?: TaskInput[]
  promptType?: PromptPackageType
  promptSection?: number
  /** IMPORT_RESULT 가 저장할 종류 */
  artifactType?: ArtifactType
  /** CONFIRM 이 기록할 일 (freshness 등) */
  confirmKind?: 'stage_done' | 'freshness_patent' | 'freshness_venture' | 'kipo_pdf' | 'redflags'
  /**
   * 서류(사업자등록증·법인등기부등본)를 올려 회사 기본정보를 한 번에 채울 수 있는 할 일인가.
   * 손으로 일곱 칸을 적는 대신 서류 한 장이면 끝나는 자리에만 붙인다.
   */
  docImport?: boolean
  /** 프로젝트가 끝났다 */
  finished?: boolean
}

export interface TaskContext {
  artifacts: ConsultingArtifact[]
  prompts: ConsultingPromptPackage[]
  evidence: ConsultingEvidence[]
  today: string
}

/* ------------------------------------------------------------------ */
/* 도우미                                                               */
/* ------------------------------------------------------------------ */

function liveArtifacts(ctx: TaskContext, projectId: string): ConsultingArtifact[] {
  return ctx.artifacts.filter((a) => a.projectId === projectId && a.status !== 'superseded')
}

function latestOf(ctx: TaskContext, projectId: string, type: ArtifactType): ConsultingArtifact | null {
  const list = liveArtifacts(ctx, projectId).filter((a) => a.type === type)
  if (list.length === 0) return null
  return list.reduce((best, a) => (a.version > best.version ? a : best))
}

function hasPromptFor(ctx: TaskContext, projectId: string, type: PromptPackageType): boolean {
  return ctx.prompts.some((p) => p.projectId === projectId && p.type === type)
}

/** 지금 열려 있는 단계 — currentStage 가 이미 끝났으면 다음 미완료로 */
export function activeStage(p: ConsultingProject): StageKey {
  const from = STAGE_ORDER.indexOf(p.currentStage)
  for (let i = Math.max(0, from); i < STAGE_ORDER.length; i += 1) {
    const s = p.stages[STAGE_ORDER[i]].status
    if (s !== 'completed' && s !== 'skipped') return STAGE_ORDER[i]
  }
  return STAGE_ORDER[STAGE_ORDER.length - 1]
}

function factInput(key: FactKey): TaskInput {
  const d = factDef(key)
  return { target: { kind: 'fact', key }, label: d.label, placeholder: d.placeholder, multiline: d.multiline === true, numeric: d.numeric }
}

function readyFromFacts(p: ConsultingProject, keys: FactKey[]): ReadyItem[] {
  return keys.map((k) => ({ label: factDef(k).label, ok: factFilled(p.factsheet[k]) }))
}

function nextLabel(key: StageKey): string {
  const i = STAGE_ORDER.indexOf(key)
  for (let j = i + 1; j < STAGE_ORDER.length; j += 1) {
    return stageDef(STAGE_ORDER[j]).label
  }
  return '마무리'
}

/** 프롬프트 → 결과 → (선택) 3박자. 여러 단계가 같은 모양이라 함수로 묶는다 */
function promptCycle(
  p: ConsultingProject,
  ctx: TaskContext,
  opts: {
    stage: StageKey
    promptType: PromptPackageType
    headlineNew: string
    detailNew: string
    actionNew: string
    ready: ReadyItem[]
  },
): CurrentTask | null {
  const artifactType = artifactTypeForPrompt(opts.promptType)
  const art = latestOf(ctx, p.id, artifactType)
  const base = { stageKey: opts.stage, ready: opts.ready, nextPreview: `다음 · ${nextLabel(opts.stage)}` }

  if (art) return null // 결과가 있으면 이 사이클은 끝났다

  if (hasPromptFor(ctx, p.id, opts.promptType)) {
    return {
      ...base,
      id: `${opts.stage}:IMPORT:${artifactType}`,
      headline: 'GPT·Claude 결과를 가져올 차례입니다',
      detail: '만든 프롬프트를 붙여 넣고 나온 결과를 그대로 붙여 넣으면 됩니다. 종류와 버전은 시스템이 알아서 정합니다.',
      actionType: 'IMPORT_RESULT',
      primaryAction: '결과 가져오기',
      artifactType,
      promptType: opts.promptType,
    }
  }
  return {
    ...base,
    id: `${opts.stage}:PROMPT:${opts.promptType}`,
    headline: opts.headlineNew,
    detail: opts.detailNew,
    actionType: 'GENERATE_PROMPT',
    primaryAction: opts.actionNew,
    promptType: opts.promptType,
  }
}

/* ------------------------------------------------------------------ */
/* 단계별 판단                                                          */
/* ------------------------------------------------------------------ */

function taskForStage(p: ConsultingProject, stage: StageKey, ctx: TaskContext): CurrentTask | null {
  const def = stageDef(stage)
  const next = `다음 · ${nextLabel(stage)}`

  switch (stage) {
    /* ---------------- S0 회사 이해 ---------------- */
    case 'S0': {
      const need = missingFacts(p.factsheet, def.requiredFacts)
      const ready = readyFromFacts(p, def.requiredFacts)
      if (need.length > 0) {
        return {
          id: `S0:INPUT:${need.slice(0, 3).join(',')}`,
          stageKey: stage,
          headline: need.length <= 2 ? `${need.length}가지만 확인하면 시작할 수 있습니다` : '회사 기본정보를 채웁니다',
          detail: '사업자등록증이나 법인등기부등본을 올리면 아래 칸이 저절로 채워집니다. 직접 적어도 됩니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: need.slice(0, 3).map((k) => factInput(k)),
          docImport: true,
          ready,
          nextPreview: next,
        }
      }
      return {
        id: 'S0:CONFIRM',
        stageKey: stage,
        headline: '회사 기본정보를 이렇게 이해했습니다',
        detail: '틀린 것이 있으면 고쳐 주세요. 맞으면 다음으로 갑니다.',
        actionType: 'CONFIRM',
        primaryAction: '맞아요, 계속',
        confirmKind: 'stage_done',
        // 틀린 값이 보이면 서류를 다시 올려 덮어쓸 수 있게 여기에도 둔다
        docImport: true,
        confirmItems: def.requiredFacts.map((k) => {
          const v = p.factsheet[k]
          return { label: factDef(k).label, value: v?.value ?? '', needsCheck: v?.status === 'unverified' || v?.status === 'demo' }
        }),
        ready,
        nextPreview: next,
      }
    }

    /* ---------------- S1 진행 판단 ---------------- */
    case 'S1': {
      const ready = readyFromFacts(p, def.requiredFacts)
      // 진행 여부를 판단하려면 "무슨 문제를 푸는 회사인가" 부터 있어야 한다
      if (!factFilled(p.factsheet.coreProblem)) {
        return {
          id: 'S1:SELECT:coreProblem',
          stageKey: stage,
          headline: '이 회사에서 가장 먼저 해결할 문제를 골라 주세요',
          detail: '하나만 고릅니다. 특허·MVP·사업계획서가 모두 이 문제를 설명하게 됩니다.',
          actionType: 'SELECT',
          primaryAction: '선택',
          choices: CORE_PROBLEM_CHOICES.map((c) => ({ value: c.value, label: c.value, hint: c.hint })),
          selectTarget: { kind: 'fact', key: 'coreProblem' },
          allowFreeText: true,
          ready,
          nextPreview: next,
        }
      }
      if (!factFilled(p.factsheet.customers)) {
        return {
          id: 'S1:INPUT:customers',
          stageKey: stage,
          headline: '지금 고객이나 거래처가 몇 곳인가요?',
          detail: '숫자가 정확하지 않아도 됩니다. 다만 지어내지는 않습니다 — 모르면 비워 두고 나중에 채웁니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [factInput('customers')],
          ready,
          nextPreview: next,
        }
      }
      if (p.gate.decision === null) {
        return {
          id: 'S1:SELECT:gate',
          stageKey: stage,
          headline: '이 회사로 벤처인증을 진행할 수 있을까요?',
          detail: '지금 판단이 어려우면 "보강한 뒤에" 를 고르세요. 탈락이 아니라 되돌아오는 자리입니다.',
          actionType: 'SELECT',
          primaryAction: '선택',
          choices: GATE_CHOICES.map((c) => ({ value: c.value, label: c.label, hint: c.hint })),
          selectTarget: { kind: 'gate' },
          ready,
          nextPreview: next,
        }
      }
      return null // 결정했으면 자동 완료
    }

    /* ---------------- S2 기존 방식 ---------------- */
    case 'S2': {
      const ready = readyFromFacts(p, def.requiredFacts)
      if (!factFilled(p.factsheet.currentMethod)) {
        return {
          id: 'S2:SELECT:currentMethod',
          stageKey: stage,
          headline: '지금은 그 일을 어떻게 처리하고 있나요?',
          detail: '기존 방식의 한계가 특허의 출발점이 됩니다.',
          actionType: 'SELECT',
          primaryAction: '선택',
          choices: CURRENT_METHOD_CHOICES.map((c) => ({ value: c.value, label: c.value, hint: c.hint })),
          selectTarget: { kind: 'fact', key: 'currentMethod' },
          allowFreeText: true,
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S3 특허 아이디어 ---------------- */
    case 'S3': {
      const ready: ReadyItem[] = [
        ...readyFromFacts(p, ['coreProblem', 'currentMethod']),
        { label: '핵심 해결기술', ok: factFilled(p.factsheet.coreTech) },
      ]
      if (!factFilled(p.factsheet.coreTech)) {
        return {
          id: 'S3:INPUT:coreTech',
          stageKey: stage,
          headline: '이 문제를 어떤 방식으로 풀 생각인가요?',
          detail: '한 줄이면 됩니다. 특허·MVP·사업계획서가 이 이름을 그대로 쓰게 됩니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [factInput('coreTech')],
          ready,
          nextPreview: next,
        }
      }
      const cycle = promptCycle(p, ctx, {
        stage,
        promptType: 'PATENT_IDEA',
        headlineNew: '특허 아이디어를 구체화할 준비가 됐습니다',
        detailNew: '회사 정보와 현장문제를 담은 프롬프트를 만듭니다. GPT 나 Claude 에 붙여 넣기만 하면 됩니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
      if (cycle) return cycle

      // 결과가 왔다 → 후보가 있으면 고르게 한다
      const art = latestOf(ctx, p.id, 'PATENT_IDEA')
      if (art && p.coreThread.patentPoint.trim() === '') {
        const parsed = parseReturnBlock(art.content)
        if (parsed.decisionOptions.length > 0) {
          return {
            id: 'S3:SELECT:patentPoint',
            stageKey: stage,
            headline: '어느 방향으로 갈까요?',
            detail: 'GPT 가 낸 후보입니다. 고른 것이 특허의 권리화 포인트가 됩니다.',
            actionType: 'SELECT',
            primaryAction: '선택',
            choices: parsed.decisionOptions.map((o, i) => ({ value: o, label: `${i + 1}. ${o}` })),
            selectTarget: { kind: 'thread', key: 'patentPoint' },
            allowFreeText: true,
            ready,
            nextPreview: next,
          }
        }
        return {
          id: 'S3:INPUT:patentPoint',
          stageKey: stage,
          headline: '권리화 포인트를 한 줄로 정리해 주세요',
          detail: '경쟁사가 가장 쉽게 베낄 구조·처리순서가 무엇인지 적습니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [{ target: { kind: 'thread', key: 'patentPoint' }, label: '특허 권리화 포인트', placeholder: '예: 공정 데이터 정규화 → 위험 산출 → 우선순위 → 재반영 순서', multiline: true, numeric: false }],
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S4 선행기술 ---------------- */
    case 'S4':
      return promptCycle(p, ctx, {
        stage,
        promptType: 'PRIOR_ART_REVIEW',
        headlineNew: '선행기술을 검토할 차례입니다',
        detailNew: 'KIPRIS 검색 키워드와 차별화 방향을 만들 프롬프트입니다. 실제 검색은 사람이 합니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready: [{ label: '특허 아이디어', ok: latestOf(ctx, p.id, 'PATENT_IDEA') !== null }, { label: '권리화 포인트', ok: p.coreThread.patentPoint.trim() !== '' }],
      })

    /* ---------------- S5 참고자료 ---------------- */
    case 'S5': {
      const ready: ReadyItem[] = [{ label: '참고자료 선정', ok: p.kipo.length >= 2 }, { label: 'PDF 받기', ok: p.kipo.length > 0 && p.kipo.every((s) => s.pdfAttached) }]
      if (p.kipo.length < 2) {
        const picked = new Set(p.kipo.map((s) => s.code))
        return {
          id: 'S5:SELECT:kipo',
          stageKey: stage,
          headline: '명세서를 쓸 때 참고할 사례를 고릅니다',
          detail: '특허청 예시 118종 중 시스템·데이터 발명에 가까운 것을 먼저 보여 드립니다. 2~5개를 고르세요.',
          actionType: 'SELECT',
          primaryAction: '고르고 계속',
          multi: { min: 2, max: 5 },
          choices: KIPO_SYSTEM_STARTERS.filter((c) => !picked.has(c)).map((code) => {
            const r = kipoByCode(code)!
            return { value: code, label: `${code} · ${r.title}`, hint: r.field }
          }),
          selectTarget: { kind: 'kipo' },
          ready,
          nextPreview: next,
        }
      }
      if (p.kipo.some((s) => !s.pdfAttached)) {
        return {
          id: 'S5:CONFIRM:pdf',
          stageKey: stage,
          headline: '고른 사례의 PDF 를 받으셨나요?',
          detail: 'PDF 를 보기 전에는 그 사례의 문구를 명세서에 쓰지 않습니다. 아래 목록을 특허청에서 내려받아 주세요.',
          actionType: 'CONFIRM',
          primaryAction: '받았습니다, 계속',
          confirmKind: 'kipo_pdf',
          confirmItems: p.kipo.map((s) => ({ label: s.code, value: kipoByCode(s.code)?.title ?? '', needsCheck: !s.pdfAttached })),
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S6 명세서 ---------------- */
    case 'S6':
      return promptCycle(p, ctx, {
        stage,
        promptType: 'PATENT_SPEC_DRAFT',
        headlineNew: '명세서 초안을 만들 준비가 됐습니다',
        detailNew: '고른 참고자료와 회사 기술을 담아 명세서·청구항·요약서 초안 프롬프트를 만듭니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready: [{ label: '참고자료 2~5종', ok: p.kipo.length >= 2 }, { label: '권리화 포인트', ok: p.coreThread.patentPoint.trim() !== '' }],
      })

    /* ---------------- S7 출원 ---------------- */
    case 'S7': {
      const ready: ReadyItem[] = [
        { label: '명세서 초안', ok: latestOf(ctx, p.id, 'PATENT_SPEC_DRAFT') !== null },
        { label: '최신 서식 확인', ok: freshnessOk(p, 'patent_filing', ctx.today) },
        { label: '출원번호', ok: p.patent.applicationNumber.trim() !== '' },
      ]
      if (!freshnessOk(p, 'patent_filing', ctx.today)) {
        return {
          id: 'S7:CONFIRM:freshness',
          stageKey: stage,
          headline: '출원 전에 특허로에서 최신 서식을 확인해 주세요',
          detail: '요약서 글자수·수수료·서식은 바뀔 수 있습니다. 공식 기준이 이 시스템보다 우선합니다.',
          actionType: 'CONFIRM',
          primaryAction: '확인했습니다',
          confirmKind: 'freshness_patent',
          confirmItems: [{ label: '확인처', value: '특허로 (patent.go.kr)' }, { label: '볼 것', value: '서식 · 요약서 글자수 · 수수료' }],
          ready,
          nextPreview: next,
        }
      }
      if (p.patent.applicationNumber.trim() === '' || p.patent.filedAt.trim() === '') {
        return {
          id: 'S7:INPUT:filing',
          stageKey: stage,
          headline: '출원이 끝나면 번호와 날짜를 적어 주세요',
          detail: '출원번호통지서에 있는 그대로 적습니다. 등록이 아니라 출원입니다 — 서류에는 "특허출원 중" 으로 씁니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [
            { target: { kind: 'patent', key: 'applicationNumber' }, label: '출원번호', placeholder: '10-2026-0000000', multiline: false, numeric: false },
            { target: { kind: 'patent', key: 'filedAt' }, label: '출원일', placeholder: 'YYYY-MM-DD', multiline: false, numeric: false },
          ],
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S8 MVP 설계 ---------------- */
    case 'S8': {
      const m = p.mvp
      const ready: ReadyItem[] = [
        { label: '누가 쓰나', ok: m.targetUser.trim() !== '' },
        { label: '핵심 흐름', ok: m.primaryJourney.trim() !== '' },
        { label: '실제 동작 기능', ok: m.axCoreFeature.trim() !== '' },
        { label: '구현 방식', ok: m.axMode !== '' },
        { label: '향후로 미룰 것', ok: m.future.trim() !== '' },
      ]
      if (m.targetUser.trim() === '') {
        return {
          id: 'S8:INPUT:targetUser',
          stageKey: stage,
          headline: '이 시스템을 누가 쓰게 되나요?',
          detail: '회사 안에서 매일 쓰는 사람 한 종류만 적습니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [{ target: { kind: 'mvp', key: 'targetUser' }, label: '주 사용자', placeholder: '예: 공정 담당자 · 견적 담당자', multiline: false, numeric: false }],
          ready,
          nextPreview: next,
        }
      }
      if (m.primaryJourney.trim() === '') {
        return {
          id: 'S8:INPUT:primaryJourney',
          stageKey: stage,
          headline: '그 사람이 하는 가장 중요한 행동은 무엇인가요?',
          detail: '시작부터 끝까지 한 줄로 적습니다. 이 흐름 하나만 끝까지 동작하게 만듭니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [{ target: { kind: 'mvp', key: 'primaryJourney' }, label: '핵심 흐름', placeholder: '예: 작업지시 입력 → 지연 위험 확인 → 우선순위 조정 → 처리', multiline: true, numeric: false }],
          ready,
          nextPreview: next,
        }
      }
      if (m.axCoreFeature.trim() === '') {
        return {
          id: 'S8:INPUT:axCore',
          stageKey: stage,
          headline: '이 기능만큼은 실제로 동작해야 합니다',
          detail: '분석·추천·최적화 중 하나를 고릅니다. 특허의 핵심기술과 같은 것이어야 합니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [{ target: { kind: 'mvp', key: 'axCoreFeature' }, label: '핵심 기능', placeholder: '예: 작업지연 위험 점수를 매겨 우선순위를 보여준다', multiline: true, numeric: false }],
          ready,
          nextPreview: next,
        }
      }
      if (m.axMode === '') {
        return {
          id: 'S8:SELECT:axMode',
          stageKey: stage,
          headline: '그 기능은 어떻게 판단하나요?',
          detail: '실제 학습·생성 모델이 아니면 "AI" 라고 부르지 않습니다. 실사에서 가장 많이 받는 질문입니다.',
          actionType: 'SELECT',
          primaryAction: '선택',
          choices: AX_MODE_CHOICES.map((c) => ({ value: c.value, label: c.label, hint: c.hint })),
          selectTarget: { kind: 'axMode' },
          ready,
          nextPreview: next,
        }
      }
      if (!factFilled(p.factsheet.platformUsers)) {
        return {
          id: 'S8:SELECT:platformUsers',
          stageKey: stage,
          headline: '회사 밖에서는 누가 쓰나요?',
          detail: '거래처·고객·현장 직원이 쓰는 화면이 하나는 있어야 합니다.',
          actionType: 'SELECT',
          primaryAction: '선택',
          choices: PLATFORM_USER_CHOICES.map((c) => ({ value: c.value, label: c.value })),
          selectTarget: { kind: 'fact', key: 'platformUsers' },
          allowFreeText: true,
          ready,
          nextPreview: next,
        }
      }
      if (m.future.trim() === '') {
        return {
          id: 'S8:INPUT:future',
          stageKey: stage,
          headline: '지금은 안 만들고 나중으로 미룰 것은?',
          detail: '한 줄에 하나씩. 이걸 정해 두어야 범위가 커지지 않고, 사업계획서의 "향후 개발" 이 됩니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [{ target: { kind: 'mvp', key: 'future' }, label: '향후 기능', placeholder: '예: 수요예측\n거래처 자동 발주\n모바일 알림', multiline: true, numeric: false }],
          ready,
          nextPreview: next,
        }
      }
      return promptCycle(p, ctx, {
        stage,
        promptType: 'MVP_STRATEGY',
        headlineNew: 'MVP 설계를 잠글 준비가 됐습니다',
        detailNew: '지금까지 고른 내용으로 MVP_SPEC 프롬프트를 만듭니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
    }

    /* ---------------- S9 MVP 구현 ---------------- */
    case 'S9': {
      const ready: ReadyItem[] = [
        { label: 'MVP 설계', ok: latestOf(ctx, p.id, 'MVP_SPEC') !== null },
        { label: '빌드 프롬프트', ok: latestOf(ctx, p.id, 'MVP_BUILD_PROMPT') !== null },
        { label: 'MVP 주소', ok: factFilled(p.factsheet.mvpUrl) },
      ]
      const cycle = promptCycle(p, ctx, {
        stage,
        promptType: 'MVP_CLAUDE_CODE_BUILD',
        headlineNew: '이제 MVP 를 만들 차례입니다',
        detailNew: 'Claude Code 에 그대로 붙여 넣는 빌드 지시문을 만듭니다. 화면 품질 기준까지 함께 들어갑니다.',
        actionNew: 'Claude Code 프롬프트 만들기',
        ready,
      })
      if (cycle) return cycle
      if (!factFilled(p.factsheet.mvpUrl)) {
        return {
          id: 'S9:INPUT:mvpUrl',
          stageKey: stage,
          headline: 'MVP 주소를 적어 주세요',
          detail: '실사에서 이 주소를 열어 보여 주게 됩니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [factInput('mvpUrl')],
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S10 사실표 잠금 ---------------- */
    case 'S10': {
      const need = missingFacts(p.factsheet, def.requiredFacts)
      const ready = readyFromFacts(p, def.requiredFacts)
      if (need.length > 0) {
        const take = need.slice(0, 3)
        return {
          id: `S10:INPUT:${take.join(',')}`,
          stageKey: stage,
          headline: need.length <= 3 ? `사업계획서 전에 ${need.length}가지만 확인합니다` : '숫자를 확인할 차례입니다',
          detail: '지어내면 실사에서 무너집니다. 모르면 비워 두고 나중에 채워도 됩니다 — 다만 그 숫자를 쓰는 서류는 그때까지 미룹니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: take.map((k) => factInput(k)),
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S11 사업계획서 ---------------- */
    case 'S11': {
      const ready: ReadyItem[] = [
        { label: '시장 숫자', ok: factFilled(p.factsheet.tam) && factFilled(p.factsheet.sam) && factFilled(p.factsheet.som) },
        { label: '핵심 해결기술', ok: factFilled(p.factsheet.coreTech) },
        { label: '사업계획서 초안', ok: latestOf(ctx, p.id, 'VENTURE_PLAN_SECTION') !== null },
      ]
      return promptCycle(p, ctx, {
        stage,
        promptType: 'VENTURE_PLAN_SECTION',
        headlineNew: '사업계획서 초안을 만들 준비가 됐습니다',
        detailNew: '확인된 숫자와 특허·MVP 내용을 담아 항목별 프롬프트를 만듭니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
    }

    /* ---------------- S12 증빙 ---------------- */
    case 'S12': {
      const mine = ctx.evidence.filter((e) => e.projectId === p.id)
      const issues = evidenceIssues(mine)
      const ready: ReadyItem[] = [
        { label: '첨부 슬롯 채움', ok: issues.emptySlots.length === 0 },
        { label: '출처 있음', ok: issues.noSource === 0 },
      ]
      const cycle = promptCycle(p, ctx, {
        stage,
        promptType: 'EVIDENCE_REVIEW',
        headlineNew: '어떤 증빙이 필요한지 정리할 차례입니다',
        detailNew: '신청화면의 첨부 10칸에 무엇을 넣을지 GPT 로 정리합니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
      if (cycle) return cycle
      if (issues.emptySlots.length > 0) {
        return {
          id: `S12:CONTINUE:slots`,
          stageKey: stage,
          headline: `첨부할 자료가 ${issues.emptySlots.length}칸 비어 있습니다`,
          detail: '고급 보기의 증빙 화면에서 칸마다 무엇을 넣을지 적습니다.',
          actionType: 'CONTINUE',
          primaryAction: '증빙 채우러 가기',
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S13 최종 점검 ---------------- */
    case 'S13': {
      const remaining = redFlagsRemaining(p)
      const ready: ReadyItem[] = [
        { label: '전체 검토 결과', ok: latestOf(ctx, p.id, 'QA_REPORT') !== null },
        { label: '위험 항목 확인', ok: remaining.length === 0 },
      ]
      const cycle = promptCycle(p, ctx, {
        stage,
        promptType: 'VENTURE_FULL_REVIEW',
        headlineNew: '제출 전 전체를 한 번 검토합니다',
        detailNew: '심사위원과 반대 심문 관점으로 약점을 찾는 프롬프트입니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
      if (cycle) return cycle
      if (remaining.length > 0) {
        return {
          id: 'S13:CONFIRM:redflags',
          stageKey: stage,
          headline: `제출 전 확인할 것이 ${remaining.length}가지 남았습니다`,
          detail: '하나라도 남으면 제출하지 않습니다. 실제로 문제가 없는지 보고 표시해 주세요.',
          actionType: 'CONFIRM',
          primaryAction: '모두 확인했습니다',
          confirmKind: 'redflags',
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S14 신청 ---------------- */
    case 'S14': {
      const ready: ReadyItem[] = [
        { label: '최신 기준 확인', ok: freshnessOk(p, 'venture_application', ctx.today) },
        { label: '신청일', ok: p.venture.submittedAt.trim() !== '' },
      ]
      if (!freshnessOk(p, 'venture_application', ctx.today)) {
        return {
          id: 'S14:CONFIRM:freshness',
          stageKey: stage,
          headline: '신청 당일 화면을 한 번 확인해 주세요',
          detail: '글자수·첨부 개수·용량·발급일 기준이 바뀔 수 있습니다. 화면이 최종 기준입니다.',
          actionType: 'CONFIRM',
          primaryAction: '확인했습니다',
          confirmKind: 'freshness_venture',
          confirmItems: [{ label: '확인처', value: '벤처확인종합관리시스템' }, { label: '볼 것', value: '글자수 · 첨부 개수 · 용량 · 발급일' }],
          ready,
          nextPreview: next,
        }
      }
      if (p.venture.submittedAt.trim() === '') {
        return {
          id: 'S14:INPUT:submitted',
          stageKey: stage,
          headline: '신청을 마치면 날짜를 적어 주세요',
          detail: '제출본은 따로 백업해 두세요.',
          actionType: 'INPUT',
          primaryAction: '저장하고 계속',
          inputs: [
            { target: { kind: 'venture', key: 'submittedAt' }, label: '신청일', placeholder: 'YYYY-MM-DD', multiline: false, numeric: false },
            { target: { kind: 'venture', key: 'submissionNote' }, label: '메모 (접수번호·백업 위치)', placeholder: '비워 두어도 됩니다', multiline: false, numeric: false },
          ],
          ready,
          nextPreview: next,
        }
      }
      return null
    }

    /* ---------------- S15 현장실사 ---------------- */
    case 'S15': {
      const ready: ReadyItem[] = [
        { label: '3분 설명', ok: latestOf(ctx, p.id, 'FIELD_REVIEW_SCRIPT') !== null },
        { label: '예상 질문', ok: latestOf(ctx, p.id, 'FIELD_REVIEW_QA') !== null },
      ]
      const s = promptCycle(p, ctx, {
        stage,
        promptType: 'FIELD_REVIEW_SCRIPT',
        headlineNew: '실사에서 대표님이 하실 3분 설명을 만듭니다',
        detailNew: '회사 사실과 특허·MVP 내용을 담아 대본과 시연 동선을 만듭니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
      if (s) return s
      const q = promptCycle(p, ctx, {
        stage,
        promptType: 'FIELD_REVIEW_QA',
        headlineNew: '예상 질문과 답변을 준비합니다',
        detailNew: '실사에서 실제로 나오는 질문 위주로 만듭니다.',
        actionNew: 'GPT 프롬프트 만들기',
        ready,
      })
      if (q) return q
      return null
    }

    /* ---------------- S16 결과 ---------------- */
    case 'S16': {
      const ready: ReadyItem[] = [{ label: '결과 기록', ok: p.fieldReview.result.trim() !== '' }]
      if (p.fieldReview.result.trim() === '') {
        return {
          id: 'S16:INPUT:result',
          stageKey: stage,
          headline: '결과가 나오면 적어 주세요',
          detail: '후속으로 무엇을 할지도 함께 적어 두면 다음에 이어서 하기 좋습니다.',
          actionType: 'INPUT',
          primaryAction: '저장하고 마무리',
          inputs: [{ target: { kind: 'review', key: 'result' }, label: '결과와 후속', placeholder: '예: 벤처기업확인 승인 (2026-11-02). 후속으로 본개발 견적 진행', multiline: true, numeric: false }],
          ready,
          nextPreview: '마무리',
        }
      }
      return null
    }

    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/* 공개 API                                                             */
/* ------------------------------------------------------------------ */

/**
 * 지금 할 일 하나.
 * 현재 단계에서 할 일이 없으면(= 조건을 다 채웠으면) 다음 단계로 넘어가며 찾는다.
 * 화면은 이 함수만 부르고, 단계 전환은 applyTaskResult 가 저장할 때 함께 처리한다.
 */
export function resolveCurrentTask(p: ConsultingProject, ctx: TaskContext): CurrentTask {
  if (p.status === 'done' || p.status === 'archived') {
    return finishedTask(p, '이 프로젝트는 끝났습니다', '기록과 결과물은 그대로 남아 있습니다.')
  }
  if (p.gate.decision === 'no_go') {
    return finishedTask(p, '지금은 진행하지 않기로 했습니다', p.gate.reason || '판단을 바꾸려면 고급 보기에서 다시 정할 수 있습니다.')
  }

  const from = STAGE_ORDER.indexOf(activeStage(p))
  for (let i = Math.max(0, from); i < STAGE_ORDER.length; i += 1) {
    const stage = STAGE_ORDER[i]
    const st = p.stages[stage].status
    if (st === 'completed' || st === 'skipped') continue
    const task = taskForStage(p, stage, ctx)
    if (task) return task
    // 이 단계는 할 일이 없다 = 조건을 다 채웠다 → 다음 단계로 계속 찾는다
  }
  return finishedTask(p, '모든 단계를 마쳤습니다', '결과물 탭에서 만들어진 자료를 확인하세요.')
}

function finishedTask(p: ConsultingProject, headline: string, detail: string): CurrentTask {
  return {
    id: 'DONE',
    stageKey: p.currentStage,
    headline,
    detail,
    actionType: 'CONTINUE',
    primaryAction: '결과물 보기',
    ready: [],
    nextPreview: '',
    finished: true,
  }
}

/**
 * 이 단계를 끝내도 되는가 — 간단 모드의 자동 전환 판단.
 * taskForStage 가 null 을 주면(할 일 없음) 조건을 채운 것이다.
 */
export function stageSatisfied(p: ConsultingProject, stage: StageKey, ctx: TaskContext): boolean {
  return taskForStage(p, stage, ctx) === null
}

/** 전체 진행률 — 완료·건너뜀 단계 비율 */
export function overallPercent(p: ConsultingProject): number {
  const done = STAGE_ORDER.filter((k) => p.stages[k].status === 'completed' || p.stages[k].status === 'skipped').length
  return Math.round((done / STAGE_ORDER.length) * 100)
}
