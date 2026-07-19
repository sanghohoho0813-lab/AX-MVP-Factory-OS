import type {
  Question,
  SurveyModule,
  SurveySection,
  SurveyTemplate,
  TemplateQuestionPlacement,
} from '../../types/survey'
import type { RespondentRole } from '../../types'
import { COMMON_QUESTIONS } from './questions'
import { INDUSTRY_QUESTIONS } from './questionsIndustry'
import { OBJECTIVE_QUESTIONS } from './questionsObjective'
import { SEED_TS } from './surveyFactory'
import { estimateFromQuestions } from '../../lib/surveyEstimate'

/* ------------------------------------------------------------------ */
/* 전체 질문 은행                                                       */
/* ------------------------------------------------------------------ */

export const ALL_SEED_QUESTIONS: Question[] = [
  ...COMMON_QUESTIONS,
  ...INDUSTRY_QUESTIONS,
  ...OBJECTIVE_QUESTIONS,
]

const QUESTION_BY_CODE = new Map(ALL_SEED_QUESTIONS.map((q) => [q.code, q]))

function qid(code: string): string {
  const question = QUESTION_BY_CODE.get(code)
  if (!question) throw new Error(`시드 질문 코드를 찾을 수 없습니다: ${code}`)
  return question.id
}

function qids(codes: string[]): string[] {
  return codes.map(qid)
}

/* ------------------------------------------------------------------ */
/* 모듈 시드                                                           */
/* ------------------------------------------------------------------ */

function buildModule(
  m: Omit<SurveyModule, 'version' | 'createdAt' | 'updatedAt' | 'archivedAt'>,
): SurveyModule {
  return {
    ...m,
    version: 1,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    archivedAt: null,
  }
}

export const SEED_MODULES: SurveyModule[] = [
  buildModule({
    id: 'mod-mfg',
    name: '제조업 현장 운영',
    description: '생산계획·작업지시·공정 기록·불량·자재·설비·납기 등 제조 현장의 핵심 운영을 진단합니다.',
    kind: 'industry',
    keys: ['manufacturing'],
    recommendedRespondentRoles: ['worker', 'manager'],
    questionIds: qids([
      'MFG-PROD-001',
      'MFG-PROD-002',
      'MFG-PROD-003',
      'MFG-QUAL-001',
      'MFG-MAT-001',
      'MFG-EQP-001',
      'MFG-DUE-001',
      'MFG-REP-001',
      'MFG-FLOW-001',
      'MFG-VOL-001',
    ]),
    status: 'active',
  }),
  buildModule({
    id: 'mod-log',
    name: '물류·환경·폐기물 운영',
    description: '거래처 일정·배차·경로·수거량·증빙·정산·법정 기록 등 물류/환경 운영을 진단합니다.',
    kind: 'industry',
    keys: ['logistics_env'],
    recommendedRespondentRoles: ['worker', 'manager'],
    questionIds: qids([
      'LOG-SCH-001',
      'LOG-DIS-001',
      'LOG-ROUTE-001',
      'LOG-VOL-001',
      'LOG-PROOF-001',
      'LOG-LAW-001',
      'LOG-CAR-001',
      'LOG-SET-001',
      'LOG-MISS-001',
      'LOG-MAT-001',
    ]),
    status: 'active',
  }),
  buildModule({
    id: 'mod-pro',
    name: '전문서비스·컨설팅',
    description: '상담 접수·자료 요청·진행상태·검수·보고서·일정 등 전문서비스 업무를 진단합니다.',
    kind: 'industry',
    keys: ['professional'],
    recommendedRespondentRoles: ['worker', 'manager'],
    questionIds: qids([
      'PRO-INT-001',
      'PRO-DOC-001',
      'PRO-STAT-001',
      'PRO-REV-001',
      'PRO-REP-001',
      'PRO-SCH-001',
      'PRO-APR-001',
      'PRO-OUT-001',
      'PRO-DEP-001',
      'PRO-GUIDE-001',
    ]),
    status: 'active',
  }),
  buildModule({
    id: 'mod-med',
    name: '병원·의료지원',
    description: '환자·거래처 자료 수집, 일정, 반복 문서, 부서 전달, 개인정보, 통계 등을 진단합니다.',
    kind: 'industry',
    keys: ['medical'],
    recommendedRespondentRoles: ['worker', 'manager'],
    questionIds: qids([
      'MED-COL-001',
      'MED-SCH-001',
      'MED-DOC-001',
      'MED-DEP-001',
      'MED-PRIV-001',
      'MED-ERR-001',
      'MED-APR-001',
      'MED-STAT-001',
    ]),
    status: 'active',
  }),
  buildModule({
    id: 'mod-web',
    name: '기업 홈페이지 제작 사전진단',
    description: '홈페이지 목적·고객·서비스·차별점·페이지·브랜드·자산·참고 사이트 등을 정리합니다.',
    kind: 'objective',
    keys: ['website'],
    recommendedRespondentRoles: ['owner', 'mixed'],
    questionIds: qids([
      'WEB-PUR-001',
      'WEB-CUS-001',
      'WEB-SVC-001',
      'WEB-DIFF-001',
      'WEB-CTA-001',
      'WEB-PAGE-001',
      'WEB-MOOD-001',
      'WEB-COLOR-001',
      'WEB-ASSET-001',
      'WEB-REF-001',
      'WEB-RESP-001',
      'WEB-MAINT-001',
    ]),
    status: 'active',
  }),
  buildModule({
    id: 'mod-fnd',
    name: '자금조달 연계 확인',
    description: '목표 기관·자금·시기·기술성·운영 증빙·KPI 계획 등 자금조달 연계 요소를 확인합니다.',
    kind: 'objective',
    keys: ['funding'],
    recommendedRespondentRoles: ['owner', 'manager'],
    questionIds: qids([
      'FND-INS-001',
      'FND-AMT-001',
      'FND-TIME-001',
      'FND-TECH-001',
      'FND-PROOF-001',
      'FND-KPI-001',
    ]),
    status: 'active',
  }),
]

/* ------------------------------------------------------------------ */
/* 템플릿 시드                                                         */
/* ------------------------------------------------------------------ */

interface SectionSpec {
  title: string
  description: string
  /** [질문코드, 필수여부] */
  items: Array<[string, boolean]>
}

function buildSections(specs: SectionSpec[]): SurveySection[] {
  return specs.map((spec, sectionIndex) => {
    const placements: TemplateQuestionPlacement[] = spec.items.map(
      ([code, required], index) => ({
        id: `pl-${sectionIndex}-${index}`,
        questionId: qid(code),
        required,
        condition: null,
        orderIndex: index,
      }),
    )
    return {
      id: `sec-${sectionIndex}`,
      title: spec.title,
      description: spec.description,
      orderIndex: sectionIndex,
      placements,
    }
  })
}

function buildTemplate(
  id: string,
  name: string,
  description: string,
  respondentRole: RespondentRole,
  purpose: SurveyTemplate['purpose'],
  sectionSpecs: SectionSpec[],
): SurveyTemplate {
  const sections = buildSections(sectionSpecs)
  const questionIds = sections.flatMap((s) =>
    s.placements.map((p) => p.questionId),
  )
  const questions = questionIds
    .map((id) => ALL_SEED_QUESTIONS.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined)
  return {
    id,
    name,
    description,
    respondentRole,
    purpose,
    sections,
    status: 'published',
    version: 1,
    estimatedMinutes: estimateFromQuestions(questions, questions.length),
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    publishedAt: SEED_TS,
    archivedAt: null,
  }
}

export const SEED_TEMPLATES: SurveyTemplate[] = [
  buildTemplate(
    'tpl-owner-basic',
    '대표자용 AX 기본진단',
    '대표자 관점에서 기업 목표, 핵심 문제, 데이터·시스템, 도입 의지, 기대효과를 진단합니다.',
    'owner',
    'ax_diagnosis',
    [
      {
        title: '기업과 프로젝트 목표',
        description: '회사 현황과 이번 프로젝트로 해결할 문제를 확인합니다.',
        items: [
          ['COM-CO-001', true],
          ['COM-CO-002', false],
          ['COM-CO-004', true],
          ['COM-CO-005', true],
        ],
      },
      {
        title: '현재 업무 문제',
        description: '대표자가 체감하는 반복 업무와 낭비를 확인합니다.',
        items: [
          ['COM-WA-009', false],
          ['COM-WA-007', false],
          ['COM-WF-007', false],
        ],
      },
      {
        title: '데이터와 시스템',
        description: '보유 데이터와 시스템 현황을 확인합니다.',
        items: [
          ['COM-DATA-001', true],
          ['COM-DATA-002', false],
          ['COM-DATA-006', false],
        ],
      },
      {
        title: '도입 의지',
        description: '변화 수용 의지와 실행 여건을 확인합니다.',
        items: [
          ['COM-AD-001', true],
          ['COM-AD-006', false],
          ['COM-AD-008', false],
        ],
      },
      {
        title: '기대효과와 자금조달',
        description: '개선 목표와 자금조달 연계 가능성을 확인합니다.',
        items: [
          ['COM-KPI-004', true],
          ['COM-KPI-005', false],
        ],
      },
    ],
  ),
  buildTemplate(
    'tpl-worker-ops',
    '현장 담당자용 업무진단',
    '현장 담당자 관점에서 실제 업무 흐름, 반복·오류·대기, 사용 데이터와 개선 여지를 진단합니다.',
    'worker',
    'ax_diagnosis',
    [
      {
        title: '담당 업무',
        description: '담당하는 핵심 업무를 파악합니다.',
        items: [
          ['COM-WF-001', true],
          ['COM-WF-006', false],
        ],
      },
      {
        title: '실제 처리 흐름',
        description: '업무의 시작·순서·산출물을 확인합니다.',
        items: [
          ['COM-WF-002', false],
          ['COM-WF-003', true],
          ['COM-WF-005', false],
        ],
      },
      {
        title: '반복·오류·대기',
        description: '시간·비용 낭비 요소를 확인합니다.',
        items: [
          ['COM-WA-001', false],
          ['COM-WA-002', false],
          ['COM-WA-004', false],
          ['COM-WA-005', false],
        ],
      },
      {
        title: '사용 데이터와 프로그램',
        description: '업무에 쓰는 데이터·시스템을 확인합니다.',
        items: [
          ['COM-DATA-001', true],
          ['COM-DATA-003', false],
          ['COM-DATA-004', false],
        ],
      },
      {
        title: '현장 적용 가능성',
        description: 'AI·자동화 적용 여지와 도입 의지를 확인합니다.',
        items: [
          ['COM-AI-003', false],
          ['COM-AD-002', true],
        ],
      },
      {
        title: '개선 목표',
        description: '현재 소요시간과 개선 여지를 확인합니다.',
        items: [
          ['COM-KPI-001', true],
          ['COM-KPI-002', false],
        ],
      },
    ],
  ),
  buildTemplate(
    'tpl-manager-ops',
    '관리자·부서장용 운영진단',
    '관리자 관점에서 부서 운영, 승인·협업, 인력·업무량, 데이터 관리, 도입 리스크, KPI를 진단합니다.',
    'manager',
    'ax_diagnosis',
    [
      {
        title: '부서 운영',
        description: '부서 구성과 핵심 업무를 확인합니다.',
        items: [
          ['COM-CO-003', false],
          ['COM-WF-006', false],
        ],
      },
      {
        title: '승인과 협업',
        description: '승인 절차와 업무 대기 요소를 확인합니다.',
        items: [
          ['COM-WF-004', false],
          ['COM-WA-005', false],
        ],
      },
      {
        title: '인력·업무량',
        description: '담당자 의존도와 교육 부담을 확인합니다.',
        items: [
          ['COM-WF-007', false],
          ['COM-WA-008', false],
        ],
      },
      {
        title: '데이터 관리',
        description: '데이터 품질과 활용 가능성을 확인합니다.',
        items: [
          ['COM-DATA-002', false],
          ['COM-DATA-004', false],
          ['COM-DATA-005', false],
          ['COM-DATA-007', false],
        ],
      },
      {
        title: '도입 리스크',
        description: '테스트 여건과 변화 저항을 확인합니다.',
        items: [
          ['COM-AD-003', false],
          ['COM-AD-004', false],
          ['COM-AD-007', false],
        ],
      },
      {
        title: 'KPI',
        description: '측정 가능한 개선 지표를 확인합니다.',
        items: [
          ['COM-KPI-005', false],
          ['COM-KPI-003', false],
        ],
      },
    ],
  ),
  buildTemplate(
    'tpl-website',
    '홈페이지 제작 사전진단',
    '회사·고객·목적·콘텐츠·디자인 방향·이미지 자산·운영 계획을 정리해 홈페이지 제작 방향을 설계합니다.',
    'mixed',
    'website_readiness',
    [
      {
        title: '회사와 고객',
        description: '회사 소개와 핵심 고객을 확인합니다.',
        items: [
          ['COM-CO-001', true],
          ['WEB-CUS-001', true],
        ],
      },
      {
        title: '홈페이지 목적',
        description: '홈페이지의 목적과 핵심 행동을 확인합니다.',
        items: [
          ['WEB-PUR-001', true],
          ['WEB-CTA-001', true],
          ['WEB-DIFF-001', false],
        ],
      },
      {
        title: '콘텐츠',
        description: '강조할 서비스와 필요한 페이지를 확인합니다.',
        items: [
          ['WEB-SVC-001', true],
          ['WEB-PAGE-001', false],
        ],
      },
      {
        title: '디자인 방향',
        description: '브랜드 분위기와 색상 방향을 확인합니다.',
        items: [
          ['WEB-MOOD-001', false],
          ['WEB-COLOR-001', false],
        ],
      },
      {
        title: '이미지·영상 자산',
        description: '보유 콘텐츠와 참고 사이트를 확인합니다.',
        items: [
          ['WEB-ASSET-001', false],
          ['WEB-REF-001', false],
        ],
      },
      {
        title: '운영과 향후 확장',
        description: '반응형 중요도와 운영 담당을 확인합니다.',
        items: [
          ['WEB-RESP-001', false],
          ['WEB-MAINT-001', false],
        ],
      },
    ],
  ),
]
