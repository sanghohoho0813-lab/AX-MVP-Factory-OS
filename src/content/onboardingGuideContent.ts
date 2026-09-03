/**
 * 처음 사용 가이드 — 중앙 콘텐츠 레지스트리 (§17).
 *
 * 여기에는 "안내 문구"만 둔다. 진행률·완료 판정 등 도메인 계산은
 * projectProgressService(단일 기준)에서만 하고 이 파일에서 복제하지 않는다.
 */

import type {
  FaqItem,
  LearningPath,
  ScreenHelp,
  ScreenTour,
  TermDefinition,
  TutorialChapter,
} from '../types/onboarding'

/** 고정 안내 문구 — 이 시스템이 만드는 것과 만들지 않는 것 (§9) */
export const SYSTEM_DISCLAIMER =
  '이 시스템은 진단·설계·보고서·개발 지시문을 만듭니다. 실제 프로그램과 홈페이지 제작·배포는 별도의 개발 과정이 필요합니다.'

/** 로컬 모드 안내 (공유·협업 챕터에 노출 §18) */
export const LOCAL_MODE_NOTICE =
  '지금은 이 브라우저에만 저장되는 로컬 데모 모드입니다. 다른 사람과 실시간으로 함께 편집하려면 클라우드 저장(supabase) 연결이 필요하며, 현재 데이터는 자동으로 지워지지 않습니다.'

/** 전체 핵심 흐름 한 줄 요약 */
export const CORE_FLOW_SUMMARY =
  '고객사·프로젝트 준비 → 기업 진단 → 만들 업무 선택 → 기능·화면 설계 → (홈페이지 설계) → 결과자료 만들기'

/* ------------------------------------------------------------------ */
/* 챕터 (§7 · §8 · §17)                                                 */
/* ------------------------------------------------------------------ */

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: 'system',
    order: 0,
    title: '시스템 이해하기',
    shortDescription: '하루가 어떻게 흐르는지(오늘 → 고객 → 일기)와 AX STUDIO 의 위치를 먼저 이해합니다.',
    detailedPurpose:
      'MIRAE AI LAB OS 는 대표가 매일 쓰는 운영 도구입니다. "오늘" 화면이 오늘 무엇부터 할지 정해 주고, "고객 운영"이 업체별 업무·서류·수금·자금을 한 표로 보여 주며, "고객 이벤트함"에는 miraeailab.com 에서 고객이 한 일(진단·주문·서류·요청)이 들어옵니다. "업무 일기"에는 통화·결정·후속조치를 남깁니다. 진단·설계·결과자료 같은 프로젝트당 한 번 쓰는 전문 기능은 AX STUDIO 에 접혀 있습니다.',
    whyNeeded:
      '전체 그림을 먼저 이해하면 지금 화면이 왜 필요한지, 다음에 무엇을 해야 하는지 헷갈리지 않습니다.',
    prerequisites: ['별도 준비물 없음 — 처음이라면 여기서 시작하세요.'],
    tasks: [
      '"오늘" 화면에서 지금 이것부터(Top 3)·빠른 기록·고객 이벤트를 살펴봅니다.',
      '"고객 운영"에서 업체별 현황표와 업체 상세(개요·업무·서류·수금·자금·고객 플랫폼·업무 일기·파일)를 확인합니다.',
      '"고객 이벤트함"과 "업무 일기"가 어디 있는지, "일정"과 "자금·지원사업"이 무엇을 보여 주는지 확인합니다.',
      'AX STUDIO 를 펼쳐 진단 → 선택 → 설계 → 결과자료 흐름과 결과물을 확인합니다.',
    ],
    inputs: ['입력 없음 — 읽고 이해하는 단계입니다.'],
    warnings: [
      '이 시스템은 실제 프로그램·홈페이지를 배포하지 않습니다. 개발 지시문까지 만들어 전달합니다.',
      '고객 플랫폼(miraeailab.com)과의 연결은 브릿지 마이그레이션이 적용된 뒤에 켜집니다(그 전에는 "준비 중" 표시).',
    ],
    completionCriteria: ['오늘 → 고객 → 이벤트 → 일기 → 일정 → 자금 → AX STUDIO → 고객 플랫폼 연결의 위치를 알았습니다.'],
    expectedOutputs: ['앞으로의 하루 순서에 대한 이해'],
    nextStepHint: '다음은 "고객사·프로젝트 준비"입니다. 매일 운영만 한다면 "고객 운영"에서 첫 업체를 등록해도 됩니다.',
    estimatedMinutes: 3,
    commonMistakes: [
      '이 시스템만으로 완성된 프로그램이 나온다고 오해하기 — 실제 개발은 별도 과정입니다.',
      '고객에게 내부 메모가 자동으로 보인다고 오해하기 — 고객에게는 "고객에게 업데이트"로 공개한 것만 보입니다.',
    ],
    routeTemplate: '/getting-started',
    availableProjectTypes: ['ax', 'website', 'ax_website'],
    advanced: false,
    progressStepKey: null,
  },
  {
    id: 'prepare',
    order: 1,
    title: '고객사·프로젝트 준비',
    shortDescription: '고객사와 프로젝트를 등록하고 유형·목표를 정합니다.',
    detailedPurpose:
      '모든 작업은 하나의 프로젝트를 중심으로 진행됩니다. 고객사와 프로젝트를 먼저 만들어야 진단·설계·결과자료를 이 프로젝트에 쌓을 수 있습니다.',
    whyNeeded: '프로젝트 유형(AX·홈페이지·둘 다)과 목표가 있어야 다음 단계 안내를 맞춰 드릴 수 있습니다.',
    prerequisites: ['고객사 기본 정보(회사명·업종 등)'],
    tasks: [
      '고객사를 등록합니다.',
      '고객사 아래 프로젝트를 만들고 유형과 목표를 정합니다.',
    ],
    inputs: ['고객사명·업종', '프로젝트 유형(AX / 홈페이지 / AX+홈페이지)', '프로젝트 목표'],
    warnings: ['유형을 잘못 고르면 이후 단계 구성이 달라집니다. 목적에 맞게 선택하세요.'],
    completionCriteria: ['고객사·프로젝트가 만들어지고, 유형과 목표가 채워져 있습니다.'],
    expectedOutputs: ['이후 모든 단계의 기준이 되는 프로젝트'],
    nextStepHint: 'AX 유형이면 "기업 진단", 홈페이지 단독이면 "홈페이지 설계"로 이어집니다.',
    estimatedMinutes: 5,
    commonMistakes: ['목표를 비워두어 다음 단계 안내가 흐릿해지는 경우'],
    routeTemplate: '/projects/:projectId',
    availableProjectTypes: ['ax', 'website', 'ax_website'],
    advanced: false,
    progressStepKey: 'prepare',
  },
  {
    id: 'diagnosis',
    order: 2,
    title: '기업 진단',
    shortDescription: '설문으로 업무·데이터 상태를 확인하고 진단 결과를 확정합니다.',
    detailedPurpose:
      '대표자와 현장 담당자에게 설문 링크를 보내 응답을 받고, 그 응답으로 AX 적합성과 핵심 문제를 계산해 진단 결과로 확정합니다. 이 결과가 "무엇을 먼저 만들지"의 근거가 됩니다.',
    whyNeeded: '실제 응답 데이터가 있어야 근거 있는 업무 선택과 설계를 할 수 있습니다.',
    prerequisites: ['준비 단계 완료(고객사·프로젝트·유형·목표)'],
    tasks: [
      '진단 설문을 구성하고 역할별 링크를 만듭니다.',
      '대표자·현장 담당자의 응답을 받습니다.',
      '제출된 응답으로 진단 결과를 만들고 검토 후 확정합니다.',
    ],
    inputs: ['설문 구성(대상 역할)', '제출된 설문 응답'],
    warnings: [
      '응답이 하나도 없으면 진단 결과를 만들 수 없습니다.',
      '진단 결과를 "확정"해야 다음 단계(업무 선택)가 열립니다.',
    ],
    completionCriteria: [
      '제출된 응답이 1건 이상 있습니다.',
      '진단 결과(Assessment)가 확정 상태이며 품질 오류가 없습니다.',
    ],
    expectedOutputs: ['AX 적합성·핵심 문제가 정리된 확정 진단 결과'],
    nextStepHint: '진단 결과를 확정하면 "먼저 만들 업무 선택"으로 이동합니다.',
    estimatedMinutes: 20,
    commonMistakes: [
      '응답이 제출되기 전에 결과를 만들려고 하는 경우',
      '결과 초안만 만들고 확정하지 않아 다음 단계가 잠겨 있는 경우',
    ],
    routeTemplate: '/diagnosis/projects/:projectId/setup',
    availableProjectTypes: ['ax', 'ax_website'],
    advanced: false,
    progressStepKey: 'diagnosis',
  },
  {
    id: 'selection',
    order: 3,
    title: '먼저 만들 업무 선택',
    shortDescription: '진단 결과에서 가장 먼저 만들 업무 하나를 확정합니다.',
    detailedPurpose:
      '1차 MVP는 여러 업무를 한 번에 만들지 않고 하나의 핵심 업무에 집중합니다. 후보 업무를 비교해 첫 번째로 만들 업무를 확정합니다.',
    whyNeeded: '집중할 업무가 정해져야 기능·화면 설계를 구체적으로 시작할 수 있습니다.',
    prerequisites: ['확정된 진단 결과'],
    tasks: ['후보 업무를 비교합니다.', '첫 번째로 만들 업무를 확정합니다.'],
    inputs: ['후보 업무 비교 기준(효과·난이도 등)', '최종 선택'],
    warnings: ['업무를 확정해야 설계 단계가 열립니다.'],
    completionCriteria: ['선택 결정(SelectionDecision)이 확정되고 인계 스냅샷이 만들어졌습니다.'],
    expectedOutputs: ['첫 번째로 만들 핵심 업무 확정'],
    nextStepHint: '확정한 업무로 "AX 기능·화면 설계"를 시작합니다.',
    estimatedMinutes: 15,
    commonMistakes: ['너무 큰 업무를 1차로 골라 범위가 커지는 경우'],
    routeTemplate: '/selection/projects/:projectId',
    availableProjectTypes: ['ax', 'ax_website'],
    advanced: false,
    progressStepKey: 'selection',
  },
  {
    id: 'ax_design',
    order: 4,
    title: 'AX 기능·화면 설계',
    shortDescription: '확정한 업무를 실제로 만들 기능·화면·데이터로 구체화합니다.',
    detailedPurpose:
      '선택한 핵심 업무를 업무 흐름·기능 범위·화면 구성·데이터·권한·업무 규칙까지 개발 가능한 수준으로 설계하고 확정합니다.',
    whyNeeded: '개발자가 바로 만들 수 있는 구체적 설계가 있어야 결과자료·개발 지시문이 정확해집니다.',
    prerequisites: ['확정된 업무 선택 결과'],
    tasks: [
      '업무 흐름과 기능 범위를 정리합니다.',
      '화면·데이터·권한·업무 규칙을 설계합니다.',
      '검토 후 설계를 확정합니다.',
    ],
    inputs: ['업무 흐름', '기능·화면·데이터 정의', '권한·규칙'],
    warnings: ['설계를 확정하지 않으면 결과자료의 개발 지시문이 미완성으로 표시됩니다.'],
    completionCriteria: ['설계(MvpDesign)가 확정되고 인계 스냅샷이 만들어졌습니다.'],
    expectedOutputs: ['개발 가능한 기능·화면·데이터 설계'],
    nextStepHint: 'AX+홈페이지라면 "홈페이지 설계"도 진행하고, 아니면 "결과자료 만들기"로 갑니다.',
    estimatedMinutes: 30,
    commonMistakes: ['화면만 그리고 데이터·권한·규칙을 비워 개발 지시문이 부실해지는 경우'],
    routeTemplate: '/mvp-design/projects/:projectId',
    availableProjectTypes: ['ax', 'ax_website'],
    advanced: false,
    progressStepKey: 'ax_design',
  },
  {
    id: 'website_design',
    order: 5,
    title: '홈페이지 설계',
    shortDescription: '홈페이지 목적·구조·콘텐츠·디자인 방향을 설계합니다.',
    detailedPurpose:
      '홈페이지의 목표와 방문자 행동을 기준으로 사이트 구조·페이지·콘텐츠·디자인 방향을 설계하고, 제작용 지시문까지 정리합니다.',
    whyNeeded: '명확한 설계가 있어야 실제 홈페이지 제작을 정확히 의뢰할 수 있습니다.',
    prerequisites: [
      '홈페이지 단독 프로젝트: 준비 단계 완료',
      'AX+홈페이지: 만들 업무 확정 후 함께 진행',
    ],
    tasks: [
      '홈페이지 목표·전략을 정합니다.',
      '사이트 구조·페이지·콘텐츠·디자인 방향을 설계합니다.',
      '검토 후 설계를 확정합니다.',
    ],
    inputs: ['홈페이지 목표', '사이트 구조·페이지', '콘텐츠·디자인 방향'],
    warnings: ['설계를 확정하지 않으면 결과자료에 홈페이지 지시문이 미완성으로 남습니다.'],
    completionCriteria: ['홈페이지 설계(WebsiteDesign)가 확정되고 인계 스냅샷이 만들어졌습니다.'],
    expectedOutputs: ['홈페이지 제작용 설계와 지시문'],
    nextStepHint: '설계를 확정하면 "결과자료 만들기"로 이동합니다.',
    estimatedMinutes: 30,
    commonMistakes: ['목표 없이 페이지부터 만들어 방향이 흔들리는 경우'],
    routeTemplate: '/website-studio/projects/:projectId',
    availableProjectTypes: ['website', 'ax_website'],
    advanced: false,
    progressStepKey: 'website_design',
  },
  {
    id: 'deliverables',
    order: 6,
    title: '결과자료 만들기',
    shortDescription: '확정 결과를 고객·개발자·기관용 자료와 개발 지시문으로 정리합니다.',
    detailedPurpose:
      '진단·선택·설계에서 확정한 내용을 전달용 자료(진단서·설계서·보고서)와 개발 지시문으로 묶어 완성합니다.',
    whyNeeded: '고객에게 전달하고 개발을 의뢰하려면 정리된 결과물이 필요합니다.',
    prerequisites: ['확정된 진단 또는 설계 결과'],
    tasks: [
      '전달할 결과자료 묶음을 만듭니다.',
      '보고서·설계서·개발 지시문을 검토하고 확정합니다.',
    ],
    inputs: ['확정된 진단·설계 결과'],
    warnings: [SYSTEM_DISCLAIMER],
    completionCriteria: ['결과자료 묶음(DeliverablePackage)이 확정되었습니다.'],
    expectedOutputs: ['고객·개발자·기관에 전달할 자료와 개발 지시문'],
    nextStepHint: '핵심 흐름을 마쳤습니다. 필요하면 고급 운영 기능을 사용할 수 있습니다.',
    estimatedMinutes: 20,
    commonMistakes: ['설계를 확정하지 않은 채 결과자료만 만들어 지시문이 비는 경우'],
    routeTemplate: '/deliverables/projects/:projectId',
    availableProjectTypes: ['ax', 'website', 'ax_website'],
    advanced: false,
    progressStepKey: 'deliverables',
  },
  {
    id: 'advanced',
    order: 7,
    title: '고급 운영 기능',
    shortDescription: '실제 사용 테스트·기관 연계·사례 관리 등 후반 운영 기능입니다.',
    detailedPurpose:
      '핵심 흐름 이후에 사용하는 기능입니다. 현장에서 직접 써보는 실제 사용 테스트, 정부·기관 지원 연계, 완료 사례 정리 등을 다룹니다.',
    whyNeeded: '핵심 결과물을 만든 뒤 운영·확장 단계에서 필요합니다. 처음에는 없어도 됩니다.',
    prerequisites: ['핵심 흐름(설계·결과자료)이 어느 정도 진행된 상태'],
    tasks: [
      '실제 사용 테스트를 계획·운영합니다.',
      '기관·지원 프로그램을 연계합니다.',
      '완료 사례를 정리합니다.',
    ],
    inputs: ['테스트 시나리오', '지원 프로그램 정보', '사례 내용'],
    warnings: ['핵심 진행률에는 포함되지 않는 고급 운영 기능입니다.'],
    completionCriteria: ['필요한 운영 작업을 개별적으로 완료합니다.'],
    expectedOutputs: ['테스트 결과·기관 연계 자료·사례'],
    nextStepHint: '설정에서 "고급 운영 기능 보기"를 켜면 메뉴에 표시됩니다.',
    estimatedMinutes: 0,
    commonMistakes: ['핵심 흐름 전에 고급 기능부터 시작해 순서가 꼬이는 경우'],
    routeTemplate: null,
    availableProjectTypes: ['ax', 'website', 'ax_website'],
    advanced: true,
    progressStepKey: null,
    showLocalModeNotice: true,
  },
]

/** 유형별 챕터 순서 (§7). Core 모드에서 고급 챕터는 서비스에서 마지막에 접는다. */
export function chaptersForPath(path: LearningPath): TutorialChapter[] {
  return TUTORIAL_CHAPTERS.filter((c) => c.availableProjectTypes.includes(path)).sort(
    (a, b) => a.order - b.order,
  )
}

export function getChapter(id: string): TutorialChapter | undefined {
  return TUTORIAL_CHAPTERS.find((c) => c.id === id)
}

/* ------------------------------------------------------------------ */
/* 용어 쉬운 정의 (§9)                                                  */
/* ------------------------------------------------------------------ */

export const TERM_DEFINITIONS: TermDefinition[] = [
  { term: 'AX(에이엑스)', plain: 'AI 전환. 회사의 일하는 방식에 AI·자동화를 적용해 바꾸는 것.' },
  { term: 'MVP', plain: '가장 먼저 만들어 검증할 최소 기능. 한 번에 다 만들지 않고 핵심부터 만듭니다.' },
  { term: '기업 진단', plain: '설문으로 회사의 업무·데이터 상태를 파악하는 단계.' },
  { term: '설문 응답', plain: '대표자·현장 담당자가 진단 설문에 제출한 답변.' },
  { term: '진단 결과(Assessment)', plain: '응답을 분석해 AX 적합성과 핵심 문제를 정리한 확정 결과.' },
  { term: '업무 선택', plain: '진단 결과에서 가장 먼저 만들 업무 하나를 고르는 것.' },
  { term: '설계', plain: '고른 업무를 실제로 만들 기능·화면·데이터로 구체화하는 것.' },
  { term: '홈페이지 설계', plain: '홈페이지의 목적·구조·콘텐츠·디자인 방향을 정하는 것.' },
  { term: '결과자료', plain: '고객·개발자·기관에 전달할 진단서·설계서·보고서 묶음.' },
  { term: '개발 지시문', plain: '개발자가 그대로 만들 수 있도록 정리한 지침. 실제 개발은 별도로 진행합니다.' },
  { term: '확정', plain: '초안을 최종 상태로 고정하는 것. 확정해야 다음 단계가 열립니다.' },
  { term: '인계 스냅샷', plain: '한 단계의 확정 결과를 다음 단계로 넘기기 위해 저장한 사본.' },
  { term: '로컬 데모 모드', plain: '이 브라우저에만 데이터를 저장하는 모드. 실시간 협업은 클라우드 연결이 필요합니다.' },
  { term: '샘플(Guided Demo)', plain: '연습용 예시 데이터로 전체 흐름을 미리 체험하는 것. 실제 고객 데이터와 섞이지 않습니다.' },
]

/* ------------------------------------------------------------------ */
/* FAQ (§11 F)                                                          */
/* ------------------------------------------------------------------ */

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: '이 시스템으로 완성된 프로그램이나 홈페이지가 바로 나오나요?',
    answer:
      '아니요. 이 시스템은 진단·설계·보고서·개발 지시문을 만듭니다. 실제 프로그램과 홈페이지 제작·배포는 별도의 개발 과정이 필요합니다.',
  },
  {
    question: '무엇부터 시작해야 하나요?',
    answer:
      '고객사와 프로젝트를 먼저 만들고, AX 유형이면 기업 진단부터 시작하세요. 처음이라면 상단 "처음 사용 가이드"에서 오늘 할 일을 안내받을 수 있습니다.',
  },
  {
    question: '다음 단계가 잠겨 있어요. 왜 그런가요?',
    answer:
      '각 단계는 앞 단계의 확정 결과가 있어야 열립니다. 예를 들어 진단 결과를 확정해야 업무 선택이, 업무를 확정해야 설계가 열립니다. 가이드의 "현재 막힌 이유"에서 확인하세요.',
  },
  {
    question: '진행률은 어떻게 계산되나요?',
    answer:
      '실제로 저장·확정된 데이터를 기준으로 "완료 단계 ÷ 전체 단계"로만 계산합니다. 임의의 퍼센트를 넣지 않습니다.',
  },
  {
    question: '"완료"를 눌렀는데 왜 완료로 안 보이나요?',
    answer:
      '안내를 읽은 것과 실제 업무 완료는 다릅니다. 완료는 해당 단계의 결과가 실제로 저장·확정되었을 때만 표시됩니다.',
  },
  {
    question: '샘플로 체험해도 실제 고객 데이터가 바뀌나요?',
    answer:
      '아니요. 샘플(Guided Demo)은 연습용 예시 프로젝트로만 진행되며 항상 "샘플" 표시가 붙습니다. 실제 고객 프로젝트와 섞이지 않습니다.',
  },
  {
    question: '홈페이지만 하는 프로젝트도 진단을 해야 하나요?',
    answer:
      '아니요. 홈페이지 단독 프로젝트는 진단·업무 선택 없이 준비 → 홈페이지 설계 → 결과자료 순서로 진행합니다.',
  },
  {
    question: '가이드를 매일 보고 싶지 않아요.',
    answer:
      '모달에서 "오늘 하루 보지 않기"를 누르면 오늘은 다시 뜨지 않습니다. 완전히 끄려면 설정 > 처음 사용 가이드에서 자동 노출을 꺼 주세요.',
  },
  {
    question: '가이드 진행 상태를 초기화하면 내 프로젝트 데이터도 지워지나요?',
    answer:
      '아니요. "가이드 진행 초기화"는 안내를 읽은 표시만 지웁니다. 고객사·프로젝트·진단·설계 등 도메인 데이터는 절대 삭제되지 않습니다.',
  },
  {
    question: '다른 팀원과 실시간으로 함께 쓸 수 있나요?',
    answer:
      '지금은 이 브라우저에만 저장되는 로컬 데모 모드입니다. 실시간 협업은 클라우드 저장(supabase) 연결이 필요합니다.',
  },
]

/* ------------------------------------------------------------------ */
/* 화면별 "이 화면 사용법" (§12)                                        */
/* ------------------------------------------------------------------ */

export const SCREEN_HELP: ScreenHelp[] = [
  {
    key: 'home',
    screenTitle: '오늘',
    purpose: '앱을 켠 뒤 5초 안에 오늘 무엇부터 할지 알기 위한 화면입니다.',
    checkFirst: ['"지금 이것부터" 3개 — 규칙(마감 지남 → 결제 주문 → 지난 후속조치 → 고객 서류·요청 → 임박)으로 고른 순서입니다.', '새 고객 이벤트가 있으면 먼저 고객사에 연결합니다.'],
    howToInput: ['"무슨 일이 있었나요?"에 통화·결정·후속조치를 바로 적습니다(Ctrl+Enter).', '하루가 끝나면 "오늘 정리하기"로 처리·남음·넘김·결정·이슈를 정리합니다.'],
    completionCriteria: ['Top 3 가 비고 새 이벤트가 0 이면 오늘 급한 일은 끝난 것입니다.'],
    nextStep: '이번 주 마감과 고객 대기 건을 "고객 운영"에서 미리 챙깁니다.',
    relatedChapterId: 'system',
  },
  {
    key: 'inbox',
    screenTitle: '고객 이벤트함',
    purpose: 'miraeailab.com 에서 고객이 한 일(진단 완료·주문·서류 업로드·요청)을 놓치지 않고 처리합니다.',
    checkFirst: ['연결되지 않은 이벤트는 "고객사와 연결" 또는 "새 고객사로 만들기"부터 합니다.', '같은 회사명·연락처의 후보가 위에 뜨지만 자동으로 합치지 않습니다 — 확인 후 고르세요.'],
    howToInput: ['연결 후 "확인·처리 중" → "처리 완료"로 상태를 남깁니다.', '나중에 볼 것은 "보류"로 두면 목록 아래로 내려갑니다.'],
    completionCriteria: ['"열린 것" 필터가 0 건입니다.'],
    nextStep: '연결된 업체 상세 > 고객 플랫폼 탭에서 고객에게 업데이트를 공개합니다.',
    relatedChapterId: 'system',
  },
  {
    key: 'journal',
    screenTitle: '업무 일기',
    purpose: '왜 그렇게 판단했는지, 누구와 무엇을 이야기했는지, 다음에 무엇을 해야 하는지를 시간순으로 남깁니다. 고객에게는 보이지 않습니다.',
    checkFirst: ['후속조치는 기한을 넣어야 "오늘" 화면의 Top 3 에 올라옵니다.'],
    howToInput: ['종류(메모·통화·결정·후속조치·막힘·성과·아이디어)를 고르고 한 줄 적습니다.', '고객사를 연결하면 업체 상세 > 업무 일기 탭에서도 보입니다.'],
    completionCriteria: ['"안 끝난 후속조치만"이 비어 있습니다.'],
    nextStep: '주간 돌아보기에서 결정과 성과를 다시 읽습니다.',
    relatedChapterId: 'system',
  },
  {
    key: 'client_detail',
    screenTitle: '업체 상세',
    purpose: '한 업체의 지금·업무·서류·수금·자금·고객 플랫폼·업무 일기·파일을 탭으로 나누어 봅니다.',
    checkFirst: ['개요의 "지금" — 다음 행동, 진행 중 업무, 없는 서류, 못 받은 돈.'],
    howToInput: ['업무 탭에서 단계를 바꾸면 활동 기록에 자동으로 남습니다.', '고객 플랫폼 탭에서 계정을 연결하고 "고객에게 업데이트"로 공개합니다. 내부 메모는 자동으로 나가지 않습니다.'],
    completionCriteria: ['개요 탭의 급한 경고가 0 건입니다.'],
    nextStep: '고객에게 공개할 진행 상황이 있으면 고객 플랫폼 탭에서 발행합니다.',
    relatedChapterId: 'system',
  },
  {
    key: 'clients',
    screenTitle: '고객사 목록',
    purpose: '고객사를 등록·관리하고, 고객사 아래 프로젝트를 시작합니다.',
    checkFirst: ['등록하려는 고객사가 이미 있는지 확인하세요.'],
    howToInput: ['"고객사 등록"으로 회사 정보를 입력합니다.', '고객사 상세에서 프로젝트를 만듭니다.'],
    completionCriteria: ['고객사와 프로젝트가 만들어졌습니다.'],
    nextStep: '프로젝트를 선택해 컨트롤 센터에서 다음 할 일을 확인하세요.',
    relatedChapterId: 'prepare',
  },
  {
    key: 'project_detail',
    screenTitle: '프로젝트 컨트롤 센터',
    purpose: '현재 프로젝트의 진행상태와 오늘 가장 먼저 할 일을 확인합니다.',
    checkFirst: ['현재 단계와 완료 단계 수를 확인하세요.'],
    howToInput: ['"지금 해야 할 일" 버튼으로 다음 단계로 이동합니다.'],
    completionCriteria: ['안내된 다음 단계 작업을 진행합니다.'],
    nextStep: '표시된 다음 단계(진단·선택·설계 등)로 이동하세요.',
    relatedChapterId: 'prepare',
  },
  {
    key: 'diagnosis',
    screenTitle: '기업 진단',
    purpose: '설문을 구성하고 응답을 받아 진단 결과를 만들고 확정합니다.',
    checkFirst: ['프로젝트 준비(유형·목표)가 끝났는지 확인하세요.'],
    howToInput: ['설문을 구성하고 역할별 링크를 만듭니다.', '응답이 모이면 결과를 만들고 확정합니다.'],
    completionCriteria: ['제출 응답 존재 + 진단 결과 확정 + 품질 오류 없음.'],
    nextStep: '결과를 확정하면 만들 업무 선택으로 이동합니다.',
    relatedChapterId: 'diagnosis',
  },
  {
    key: 'responses',
    screenTitle: '응답 관리',
    purpose: '발급한 설문의 응답 제출 상태를 확인하고 관리합니다.',
    checkFirst: ['역할별 링크가 발급되었는지 확인하세요.'],
    howToInput: ['응답 현황을 확인하고, 필요한 역할에 추가 안내를 보냅니다.'],
    completionCriteria: ['필요한 역할의 응답이 제출되었습니다.'],
    nextStep: '응답이 모이면 진단 결과를 만드세요.',
    relatedChapterId: 'diagnosis',
  },
  {
    key: 'assessment_result',
    screenTitle: '진단 결과',
    purpose: 'AX 적합성·핵심 문제를 확인하고 결과를 확정합니다.',
    checkFirst: ['응답이 충분히 모였는지, 품질 경고가 없는지 확인하세요.'],
    howToInput: ['결과를 검토하고 "확정"합니다.'],
    completionCriteria: ['진단 결과가 확정 상태입니다.'],
    nextStep: '확정 후 만들 업무 선택으로 이동합니다.',
    relatedChapterId: 'diagnosis',
  },
  {
    key: 'selection_compare',
    screenTitle: '후보 업무 비교',
    purpose: '후보 업무를 비교해 먼저 만들 업무를 판단합니다.',
    checkFirst: ['확정된 진단 결과가 있는지 확인하세요.'],
    howToInput: ['효과·난이도 등 기준으로 후보를 비교합니다.'],
    completionCriteria: ['비교를 마치고 후보를 좁혔습니다.'],
    nextStep: '업무 확정 화면에서 첫 번째 업무를 확정하세요.',
    relatedChapterId: 'selection',
  },
  {
    key: 'selection_decision',
    screenTitle: '업무 확정',
    purpose: '첫 번째로 만들 핵심 업무를 확정합니다.',
    checkFirst: ['1차 MVP는 하나의 업무에 집중한다는 점을 기억하세요.'],
    howToInput: ['최종 업무를 선택하고 확정합니다.'],
    completionCriteria: ['선택 결정이 확정되고 인계 스냅샷이 만들어졌습니다.'],
    nextStep: '확정한 업무로 AX 기능·화면 설계를 시작하세요.',
    relatedChapterId: 'selection',
  },
  {
    key: 'ax_design',
    screenTitle: 'AX 기능·화면 설계',
    purpose: '확정 업무를 기능·화면·데이터·권한·규칙으로 설계합니다.',
    checkFirst: ['만들 업무가 확정되었는지 확인하세요.'],
    howToInput: ['업무 흐름부터 화면·데이터·권한·규칙 순으로 채웁니다.', '검토 후 확정합니다.'],
    completionCriteria: ['설계가 확정되고 인계 스냅샷이 만들어졌습니다.'],
    nextStep: 'AX+홈페이지면 홈페이지 설계, 아니면 결과자료로 이동합니다.',
    relatedChapterId: 'ax_design',
  },
  {
    key: 'website_design',
    screenTitle: '홈페이지 설계',
    purpose: '홈페이지 목표·구조·콘텐츠·디자인 방향을 설계합니다.',
    checkFirst: ['프로젝트 준비(홈페이지 목표)가 끝났는지 확인하세요.'],
    howToInput: ['목표·전략부터 구조·페이지·콘텐츠·디자인 순으로 채웁니다.', '검토 후 확정합니다.'],
    completionCriteria: ['홈페이지 설계가 확정되고 인계 스냅샷이 만들어졌습니다.'],
    nextStep: '설계를 확정하면 결과자료로 이동합니다.',
    relatedChapterId: 'website_design',
  },
  {
    key: 'deliverables',
    screenTitle: '결과자료',
    purpose: '확정 결과를 전달용 자료와 개발 지시문으로 정리합니다.',
    checkFirst: ['담을 확정 결과(진단·설계)가 있는지 확인하세요.'],
    howToInput: ['결과자료 묶음을 만들고 보고서·지시문을 검토·확정합니다.'],
    completionCriteria: ['결과자료 묶음이 확정되었습니다.'],
    nextStep: '고객·개발자·기관에 전달하세요. 실제 개발은 별도 과정입니다.',
    relatedChapterId: 'deliverables',
  },
]

export function getScreenHelp(key: string): ScreenHelp | undefined {
  return SCREEN_HELP.find((s) => s.key === key)
}

/* ------------------------------------------------------------------ */
/* 화면 따라 해보기 투어 (§13)                                          */
/* ------------------------------------------------------------------ */

export const SCREEN_TOURS: ScreenTour[] = [
  {
    key: 'home',
    screenTitle: '오늘',
    steps: [
      { target: '[data-tour="home-today"]', title: '오늘', body: '실제 날짜·시각과 함께 오늘 반드시·이번 주 마감·고객 대기·받을 돈·새 이벤트 다섯 가지를 봅니다. 숫자를 누르면 해당 목록으로 갑니다.' },
      { target: '[data-tour="home-top3"]', title: '지금 이것부터', body: '경고·고객 이벤트·후속조치·자금 마감을 규칙으로 합쳐 최대 3개만 보여 줍니다. 각 항목 아래 "이유"가 순서의 근거입니다.' },
      { target: '[data-tour="home-capture"]', title: '무슨 일이 있었나요?', body: '통화·결정·후속조치를 바로 적습니다. 후속조치에 기한을 넣으면 그날 Top 3 에 올라옵니다.' },
      { target: '[data-tour="home-events"]', title: '고객 이벤트', body: 'miraeailab.com 에서 고객이 한 일이 들어옵니다. 고객사에 연결하고 처리 상태를 남기세요.' },
      { target: '[data-tour="guide-button"]', title: '처음 사용 가이드', body: '언제든 이 버튼으로 전체 안내를 다시 볼 수 있습니다.' },
    ],
  },
  {
    key: 'inbox',
    screenTitle: '고객 이벤트함',
    steps: [
      { target: null, title: '고객 이벤트함', body: '진단 완료·주문·서류 업로드·요청이 우선순위(지금 / 오늘 중 / 참고)와 함께 쌓입니다. 연결 → 처리 중 → 처리 완료 순서로 남깁니다.' },
    ],
  },
  {
    key: 'journal',
    screenTitle: '업무 일기',
    steps: [
      { target: null, title: '업무 일기', body: '오늘 / 이번 주 / 전체로 보고, 고객사·종류로 좁힙니다. 고정·수정·삭제·후속조치 완료가 됩니다. 고객에게는 보이지 않습니다.' },
    ],
  },
  {
    key: 'client_detail',
    screenTitle: '업체 상세',
    steps: [
      { target: null, title: '업체 상세', body: '개요(지금·진행 업무·막힘·돈·고객) → 업무 → 서류 → 수금 → 자금 → 고객 플랫폼 → 업무 일기 → 파일 순서의 탭입니다. 고객 플랫폼 탭에서만 고객에게 공개됩니다.' },
    ],
  },
  {
    key: 'project_detail',
    screenTitle: '프로젝트 컨트롤 센터',
    steps: [
      { target: '[data-tour="control-progress"]', title: '진행상태', body: '현재 단계와 완료한 단계 수를 실제 데이터 기준으로 보여줍니다.' },
      { target: '[data-tour="control-next"]', title: '지금 해야 할 일', body: '다음 단계로 바로 이동하는 버튼입니다.' },
    ],
  },
  {
    key: 'diagnosis',
    screenTitle: '기업 진단',
    steps: [
      { target: null, title: '기업 진단', body: '설문을 만들고 응답을 받아 진단 결과를 확정하는 화면입니다.' },
    ],
  },
  {
    key: 'ax_design',
    screenTitle: 'AX 기능·화면 설계 개요',
    steps: [
      { target: null, title: 'AX 설계 개요', body: '업무 흐름·기능·화면·데이터·권한·규칙을 차례로 설계하고 마지막에 확정합니다.' },
    ],
  },
  {
    key: 'website_design',
    screenTitle: '홈페이지 설계 개요',
    steps: [
      { target: null, title: '홈페이지 설계 개요', body: '목표·구조·페이지·콘텐츠·디자인 방향을 차례로 설계하고 확정합니다.' },
    ],
  },
  {
    key: 'deliverables',
    screenTitle: '결과자료',
    steps: [
      { target: null, title: '결과자료', body: '확정 결과를 전달용 자료와 개발 지시문으로 정리합니다. 실제 개발·배포는 별도 과정입니다.' },
    ],
  },
]

export function getScreenTour(key: string): ScreenTour | undefined {
  return SCREEN_TOURS.find((t) => t.key === key)
}
