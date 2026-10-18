/**
 * 일 순서 (D-235) — 대표 "딱딱 순서대로 쭉 앞으로 가기 · 각 단계마다 무엇을 위한 단계인지 설명".
 *
 * 업체 화면의 탭 · 모듈 안 화면을 '하는 순서' 로 줄 세우고, 단계마다 무엇을 하는지 한 문장을 단다.
 * 탭 · 목차 순서는 그대로 둔다(매일 쓰는 순서) — 여기는 처음 쓰는 사람이 따라갈 순서만.
 * 순서 밖 화면(업무 일기 · 설정 같은 것)은 aside 로 '언제 여는지' 만 적는다.
 * 말은 50~60대가 바로 읽는 해요체 한 문장. 규칙 계산을 'AI' 라고 부르지 않는다.
 */

export interface FlowStep {
  /** 탭 키 · 모듈 화면 키 */
  key: string
  /** 단계 이름(짧게) */
  label: string
  /** 이 단계는 무엇을 위한 것인지 — 한 문장 */
  why: string
}

export interface FlowDef {
  /** 안내 줄 맨 앞 이름 — '업체 일 순서' */
  name: string
  steps: FlowStep[]
  /** 순서 밖 화면 — 언제 여는지 */
  aside?: Record<string, { label: string; why: string }>
}

/** 업체 화면 — 서류 → 회사 정보 → 맞춤 추천 → 업무 → 고객에게 보내기 → 수금 */
export const CLIENT_FLOW: FlowDef = {
  name: '업체 일 순서',
  steps: [
    {
      key: 'docs',
      label: '서류 올리기',
      why: '받은 서류를 대충 올리면 알아서 칸을 나누고 회사 정보까지 채워요. 다음 단계 추천의 재료예요.',
    },
    {
      key: 'overview',
      label: '회사 정보 확인',
      why: '서류에서 채운 회사 정보 · 연락처 · 다음 약속이 맞는지 보고, 빈 칸만 채워요.',
    },
    {
      key: 'smart',
      label: '맞춤 추천',
      why: '이 업체에 맞는 모듈(정책자금 · 고용지원금 · 연구소 · 절세 …)과 먼저 제안할 것을 골라 드려요.',
    },
    {
      key: 'work',
      label: '업무 진행',
      why: '고른 모듈을 열어 진단 · 계산하고, 결과를 기록에 붙여 할 일과 기한을 걸어요.',
    },
    {
      key: 'portal',
      label: '고객에게 보내기',
      why: '결과 · 필요한 서류 요청을 고객 화면으로 보내요. 고객이 직접 보고 서류를 올려요.',
    },
    {
      key: 'fees',
      label: '수금',
      why: '계약 금액 · 받은 돈 · 남은 돈을 확인하고 입금을 체크해요.',
    },
  ],
  aside: {
    journal: {
      label: '업무 일기',
      why: '순서와 상관없이 통화 · 미팅 내용을 그때그때 적어 두는 곳이에요. 고객에게는 보이지 않아요.',
    },
    consulting: {
      label: '컨설팅',
      why: '특허 · MVP 같은 컨설팅 프로젝트를 따로 보는 곳이에요.',
    },
    funding: {
      label: '지원사업 신청',
      why: '공고에서 신청 준비를 건 지원사업의 서류 · 마감 · 결과를 챙기는 곳이에요.',
    },
    ai: {
      label: 'AI 작업실',
      why: '대표만 쓰는 곳 — 이 업체 자료로 AI 에게 글 · 제안서를 맡겨요.',
    },
  },
}

/**
 * 전문 모듈 첫 화면 '이렇게 쓰세요' (D-235) — 모듈 하나를 처음 여는 사람이 따라 할 세 걸음.
 * to 가 있으면 그 걸음의 첫 화면으로 간다(업체를 들고 왔으면 그 업체로).
 */
export interface GuideStep {
  title: string
  why: string
  to?: string
}

export const MODULE_GUIDES: Record<string, GuideStep[]> = {
  growth: [
    { title: '업체를 먼저 여세요', why: '고객 관리에서 업체를 열고 서류를 올리면, 맞춤 추천이 이 모듈 가운데 맞는 기능을 골라 줘요.', to: '/ops/clients' },
    { title: '맞는 기능을 여세요', why: '정책자금 · 고용지원금 · 연구소 · 기업인증 — 업체로 열면 회사 숫자가 미리 채워져 바로 진단 · 계산해요.' },
    { title: '결과를 기록에 붙이세요', why: '[기록에 붙이기] 를 누르면 업체 화면 업무 탭에 결과와 다음 할 일 · 기한이 남아요.' },
  ],
  'tax-finance': [
    { title: '크레탑 보고서부터', why: '재무 숫자를 먼저 뽑아 두면 절세 · 감면 계산이 그 숫자로 채워져요.', to: '/tools/cretop' },
    { title: '감면 판정 · 세금 계산', why: '창업감면은 1분 판정, 급여 · 퇴직금 · 가지급금 · 주식은 세금 계산기 9종으로 숫자를 봐요.' },
    { title: '결과를 기록에 붙이세요', why: '[기록에 붙이기] 를 누르면 업체 화면 업무 탭에 결과가 남고, 대표님께 드릴 결과서로 이어져요.' },
  ],
}

/** 영업 관리 — 보드 → 미팅 준비 → 상품 · 제안(키는 주소). 계약을 마치면 업체 화면 순서로 이어진다 */
export const SALES_FLOW: FlowDef = {
  name: '영업 순서',
  steps: [
    {
      key: '/sales/board',
      label: '영업 보드',
      why: '잠재고객이 첫 연락 · 미팅 · 제안 · 계약 중 어디쯤인지 보고, 오늘 연락할 곳을 골라요.',
    },
    {
      key: '/sales/meeting',
      label: '미팅 준비',
      why: '크레탑 분석과 1 · 2 · 3차 미팅 대본으로 만나기 전에 할 말 · 물어볼 것을 준비해요.',
    },
    {
      key: '/sales/proposal',
      label: '상품 · 제안',
      why: '맞는 상품을 골라 제안서 · 견적을 만들어요. 계약하면 업체 화면에서 이어서 챙겨요.',
    },
  ],
  aside: {
    '/sales/strategy': {
      label: '전략',
      why: '영업 전략 · 절세 전략 자료실이에요. 미팅 전에 이 업체에 쓸 이야기만 찾아봐요.',
    },
    '/sales/new': {
      label: '새 잠재고객',
      why: '크레탑 보고서를 넣거나 직접 적어 잠재고객을 등록해요. 등록하면 영업 보드에 올라가요.',
    },
  },
}

/**
 * 모듈 안 화면 순서 — 도구 키(toolRegistry) → 순서.
 * 목차의 모든 화면을 넣지 않는다: 처음 쓰는 사람이 따라갈 줄기만. 나머지는 aside(언제 여는지).
 */
export const TOOL_FLOWS: Record<string, FlowDef> = {
  'startup-tax': {
    name: '창업감면 순서',
    steps: [
      {
        key: 'judge',
        label: '1분 판정',
        why: '여덟 가지를 고르면 창업중소기업 세액감면을 받을 수 있는지 네 단계로 알려 줘요.',
      },
      {
        key: 'report',
        label: '결과서',
        why: '판정 결과를 대표님께 드릴 한 장으로 인쇄하거나 저장해요.',
      },
    ],
  },
  cretop: {
    name: '크레탑 분석 순서',
    steps: [
      {
        key: 'analyze',
        label: '보고서 분석',
        why: '크레탑 보고서(PDF · 붙여넣기)를 넣으면 핵심 재무 · 추이 · 미팅 포인트를 뽑아요.',
      },
      {
        key: 'core-check',
        label: '핵심지표 검수',
        why: '뽑아낸 숫자가 보고서와 같은지 줄마다 확인해요. 틀린 숫자로 상담하지 않게요.',
      },
    ],
    aside: {
      extractor: {
        label: '숫자 추출기',
        why: '표를 복사해 붙이면 숫자만 골라 줘요. 보고서 분석이 잘 안 읽힐 때 써요.',
      },
    },
  },
  employment: {
    name: '고용지원금 순서',
    steps: [
      {
        key: 'diagnosis',
        label: '채용 진단',
        why: '채용 상황을 고르면 받을 수 있는 지원금을 가려내요.',
      },
      {
        key: 'roster',
        label: '명부 진단',
        why: '4대보험 명부 파일을 넣으면 직원마다 받을 수 있는 지원금 후보를 찾아요.',
      },
      {
        key: 'schedule',
        label: '회차 일정',
        why: '입사일로 회차별 신청일과 D-day 를 계산해 놓치지 않게 해요.',
      },
      {
        key: 'simulator',
        label: '수령액 계산',
        why: '몇 명을 언제 뽑으면 달마다 얼마가 들어오는지 미리 보여 줘요. 제안할 때 써요.',
      },
      {
        key: 'board',
        label: '진행 보드',
        why: '신청한 지원금이 준비 → 접수 → 지급까지 어디쯤인지 챙겨요.',
      },
    ],
    aside: {
      dashboard: {
        label: '한눈에 보기',
        why: '이번 달 신청할 것 · 늦은 것 · 받은 돈을 한눈에 봐요. 매일 처음 여는 곳이에요.',
      },
      companies: {
        label: '업체 목록',
        why: '업체마다 직원 · 회차 · 서류 · 수수료를 따로 봐요.',
      },
      wage: {
        label: '급여 계산기',
        why: '실수령액 · 사업주 부담 · 최저임금을 바로 계산해요. 상담 중 물어볼 때 써요.',
      },
      programs: {
        label: '지원금 관리',
        why: '지원금 15종을 켜고 끄거나 회차를 고쳐요. 제도가 바뀌었을 때만 열어요.',
      },
      settings: {
        label: '설정 · 백업',
        why: '기록을 파일로 내보내거나 불러와요.',
      },
    },
  },
  labcare: {
    name: '연구소 순서',
    steps: [
      {
        key: 'assessment',
        label: '설립 가능성',
        why: '인원 · 자격 · 공간 요건으로 연구소를 세울 수 있는지 먼저 판정해요.',
      },
      {
        key: 'setup-docs',
        label: '설립 서류',
        why: '설립 신고에 필요한 서류 26종을 체크하고, 고객에게 보낼 요청 문구를 만들어요.',
      },
      {
        key: 'org-diagram',
        label: '조직도 · 도면',
        why: '신고에 들어가는 조직도와 연구 공간 도면을 그려요.',
      },
      {
        key: 'notes',
        label: '연구노트',
        why: '세운 뒤에는 달마다 연구 활동을 노트로 남겨요. 현장조사 때 꼭 필요해요.',
      },
      {
        key: 'check',
        label: '월간 점검',
        why: '8문항으로 이번 달 사후관리 위험도를 확인해요.',
      },
      {
        key: 'tax',
        label: '세액공제',
        why: '연구 · 인력개발비로 받을 세액공제를 미리 계산해요. 대표님께 드릴 숫자예요.',
      },
      {
        key: 'reports',
        label: '결과서',
        why: '월간 · 절세 · 방문용 결과서를 뽑아 대표님께 드려요.',
      },
    ],
    aside: {
      dashboard: {
        label: '한눈에 보기',
        why: '오늘 할 일 · 설립 진행 · 변경신고 D-day 를 한눈에 봐요.',
      },
      tasks: {
        label: '오늘 할 일',
        why: '서류 · 노트 · 변경신고 할 일을 한 줄로 모아 봐요.',
      },
      clients: {
        label: '업체 목록',
        why: '연구소가 있거나 준비 중인 업체를 모아 봐요.',
      },
      changes: {
        label: '변경사항',
        why: '연구원 · 주소가 바뀌면 30일 안에 신고해야 해요. 그 기한을 챙겨요.',
      },
      survey: {
        label: '활동조사',
        why: '해마다 내는 연구개발 활동조사를 냈는지 챙겨요.',
      },
      inspection: {
        label: '현장조사 대비',
        why: '현장조사 전에 사람 · 공간 · 활동 12가지를 점검해요.',
      },
      resources: {
        label: '안내문 · 자료실',
        why: '고객에게 보낼 안내문 11종을 골라 써요.',
      },
      settings: {
        label: '설정 · 백업',
        why: '기록을 파일로 내보내거나 불러와요.',
      },
    },
  },
  'policy-funding': {
    name: '정책자금 순서',
    steps: [
      {
        key: 'diagnosis',
        label: '진단하기',
        why: '8문항에 답하면 맞는 기관 3곳 · 필요 서류 · 위험 요소를 뽑아요.',
      },
      {
        key: 'report',
        label: '결과서',
        why: '진단 결과를 대표님께 드릴 한 장 요약과 로드맵으로 만들어요.',
      },
      {
        key: 'customers',
        label: '업체 목록',
        why: '진단한 업체마다 지금 단계 · 다음 할 일 · 서류 체크를 이어서 챙겨요.',
      },
    ],
    aside: {
      dashboard: {
        label: '한눈에 보기',
        why: '상담 단계별 업체 수와 오늘 할 일을 한눈에 봐요.',
      },
    },
  },
  'cert-os': {
    name: '기업인증 순서',
    steps: [
      {
        key: 'overview',
        label: '인증 한눈에',
        why: '이 업체에 맞는 인증(벤처 · 이노비즈 · 메인비즈 …)과 준비 정도 · 진행 순서를 먼저 봐요.',
      },
    ],
    aside: {
      innobiz: {
        label: '이노비즈',
        why: '자격 확인 → 사전진단 → 증빙 → 실사 대비까지 이노비즈 하나만 깊게 봐요.',
      },
      mainbiz: {
        label: '메인비즈',
        why: '자격 확인 → 사전진단 → 증빙 → 실사 대비까지 메인비즈 하나만 깊게 봐요.',
      },
      venture: {
        label: '벤처기업',
        why: '어떤 유형으로 받을지 정하고 준비 → 신청 → 완료까지 챙겨요.',
      },
      lab: {
        label: '기업부설연구소',
        why: '인력 기준을 확인하고 연구소 관리 화면으로 이어가요.',
      },
      iso: {
        label: 'ISO',
        why: '어떤 ISO 를 검토할지 정하고 상담을 요청해요.',
      },
    },
  },
}

export interface FlowPosition {
  flow: FlowDef
  /** 순서 안이면 0부터, 순서 밖이면 -1 */
  index: number
  prev: FlowStep | null
  next: FlowStep | null
  /** 지금 화면 이름 · 무엇을 위한 것인지 */
  here: { label: string; why: string } | null
}

/** 지금 화면이 순서의 몇 번째인지 · 앞뒤 단계. visible 로 이 사람에게 없는 단계(팀장 화면의 고객 플랫폼 등)를 뺀다 */
export function flowPosition(flow: FlowDef, current: string, visible?: (key: string) => boolean): FlowPosition {
  const steps = visible ? flow.steps.filter((s) => visible(s.key)) : flow.steps
  const f = steps === flow.steps ? flow : { ...flow, steps }
  const index = steps.findIndex((s) => s.key === current)
  if (index < 0) {
    const a = flow.aside?.[current] ?? null
    return { flow: f, index: -1, prev: null, next: null, here: a }
  }
  return {
    flow: f,
    index,
    prev: steps[index - 1] ?? null,
    next: steps[index + 1] ?? null,
    here: steps[index],
  }
}
