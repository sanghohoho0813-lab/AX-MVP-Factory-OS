/**
 * 대표 AI 작업실 — 스킬 서재(서버 전용). 화면 쪽 이름 · 설명은 src/services/ownerAi/skillCatalog.ts(같은 id · version · tier — 단위 시험이 맞춘다).
 *
 * 스킬 하나 = 메타데이터(id · name · version · description · tier · active · createdAt · updatedAt)
 *           + systemInstruction(생각하는 순서 · 지킬 것 — 줄 배열) + outputSchema(검사용) + example(모델에게 보여 줄 JSON 틀).
 * 판을 바꿀 때는 version 을 올리고 updatedAt 을 바꾼다 — 실행 기록(ai_runs)에 skill_version 이 남아 나중에 판별 품질을 비교한다.
 * ChatGPT 에서 쓰던 스킬 '이름' 이 아니라 그 사고방식을 여기에 명시적으로 다시 적었다(ChatGPT 기억은 읽을 수 없다).
 */

const D = '2026-10-14'

/** 모든 스킬에 붙는 공통 규칙 */
export const COMMON_RULES = [
  '너는 미래AI랩 김상호 대표의 컨설팅 작업을 돕는 보조자다. 한국어로, 대표가 바로 쓸 수 있게 쓴다.',
  '근거 없는 숫자(금액 · 한도 · 승인 가능성 · 시장 규모 · 매출)를 만들지 않는다. 자료에 없으면 "미확인" 이라고 쓴다.',
  '업체 사실은 아래 [업체 자료] 에 있는 것만 사실로 쓴다. 너의 추정은 문장 끝에 "(추정)" 을 붙인다.',
  '과장하지 않는다. "AI 를 넣으면 다 된다" 식의 포장은 하지 않는다.',
  '개인정보(주민등록번호 · 연락처 · 계좌 · 비밀번호)는 출력하지 않는다.',
  '출력은 반드시 아래 [출력 형식] 의 JSON 객체 하나만. 설명 문장 · 마크다운 코드블록 없이 JSON 만.',
]

const AX_ITEM = {
  type: 'object',
  required: ['title', 'why'],
  props: {
    title: { type: 'string' },
    why: { type: 'string' },
    before: { type: 'string' },
    after: { type: 'string' },
    coreFeatures: { type: 'array', items: { type: 'string' } },
    dataNeeded: { type: 'array', items: { type: 'string' } },
    difficulty: { type: 'string' },
    mvpScope: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' } },
    patentLink: { type: 'string' },
    ventureLink: { type: 'string' },
    fundingLink: { type: 'string' },
  },
}
const AX_ITEM_EXAMPLE = {
  title: 'AX 이름(한 줄)',
  why: '추천 이유',
  before: '지금 업무 방식',
  after: '바뀐 뒤 업무 방식',
  coreFeatures: ['핵심 기능'],
  dataNeeded: ['필요한 데이터'],
  difficulty: '낮음 | 중간 | 높음',
  mvpScope: 'MVP 로 만들 범위',
  risks: ['예상 리스크'],
  patentLink: '특허로 이어질 가능성(없으면 "약함")',
  ventureLink: '벤처기업확인과 이어질 점',
  fundingLink: '정책지원과 이어질 점',
}

const STRINGS = { type: 'array', items: { type: 'string' } }

export const SKILLS = {
  AX_PENGUIN: {
    id: 'AX_PENGUIN',
    name: 'AX 전략 분석',
    version: 1,
    tier: 'deep',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '회사가 돈 버는 방식부터 12단계로 생각해 가장 추천하는 AX 1개와 차선을 고른다.',
    systemInstruction: [
      '이 업체에 맞는 AX(업무에 AI 를 넣는 전략)를 고른다. "AI 를 넣어 보자" 가 아니라 반드시 아래 순서로 생각한다.',
      '1. 회사가 실제로 돈을 벌고 있는 방식',
      '2. 사람이 반복해서 하는 업무',
      '3. 현재 데이터가 존재하는 위치',
      '4. 비효율 · 병목',
      '5. AI 가 실제로 개입할 수 있는 지점',
      '6. 도입 난이도',
      '7. MVP 가능 범위',
      '8. 사업성',
      '9. 고객 또는 내부 직원이 실제 사용할 가능성',
      '10. 정책기관에서 설명하기 좋은 기술 · 사업성',
      '11. 벤처 · 특허 · 정책자금으로 이어질 연결 가능성',
      '12. 과도한 AI 포장 여부(포장이 심하면 솔직히 낮춘다)',
      'thinking 에 12단계 각각의 판단을 한두 문장으로 남긴다(자료가 없으면 "미확인 — 무엇을 물어볼지").',
      '가장 추천하는 AX 는 1개, 차선은 2~4개. 이미 [지금까지의 기억] 에 채택된 방향이 있으면 그것과 비교해 말한다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['oneLine', 'thinking', 'recommended', 'alternatives'],
      props: {
        oneLine: { type: 'string' },
        thinking: { type: 'array', items: { type: 'object', required: ['step', 'finding'], props: { step: { type: 'number' }, title: { type: 'string' }, finding: { type: 'string' } } } },
        recommended: AX_ITEM,
        alternatives: { type: 'array', items: AX_ITEM },
        cautions: STRINGS,
        unknowns: STRINGS,
      },
    },
    example: {
      oneLine: '이 회사 AX 한 줄 결론',
      thinking: [{ step: 1, title: '돈 버는 방식', finding: '판단' }],
      recommended: AX_ITEM_EXAMPLE,
      alternatives: [AX_ITEM_EXAMPLE],
      cautions: ['주의할 점'],
      unknowns: ['대표 · 업체에 확인할 것'],
    },
  },

  AX_IDEA: {
    id: 'AX_IDEA',
    name: 'AX 아이템 발굴',
    version: 1,
    tier: 'standard',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '이 업체에서 해 볼 만한 AX 아이템 후보를 넓게 뽑는다(빨리 되는 것 표시).',
    systemInstruction: [
      '이 업체에서 해 볼 만한 AX 아이템 후보 3~6개를 뽑는다.',
      '각 후보는 실제 반복 업무 · 데이터가 있는 곳에서 출발한다. 데이터가 없으면 그 사실을 적는다.',
      '빨리(한두 달 안) 효과가 보이는 것은 quickWin 을 true 로.',
      '이미 채택된 AX 방향과 겹치면 겹친다고 적는다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['oneLine', 'items'],
      props: {
        oneLine: { type: 'string' },
        items: { type: 'array', items: { type: 'object', required: ['title', 'idea'], props: { title: { type: 'string' }, problem: { type: 'string' }, idea: { type: 'string' }, users: { type: 'string' }, dataNeeded: STRINGS, difficulty: { type: 'string' }, value: { type: 'string' }, quickWin: { type: 'boolean' } } } },
        unknowns: STRINGS,
      },
    },
    example: {
      oneLine: '한 줄 요약',
      items: [{ title: '아이템', problem: '풀 문제', idea: '어떻게', users: '누가 쓰나', dataNeeded: ['데이터'], difficulty: '낮음 | 중간 | 높음', value: '얻는 것', quickWin: true }],
      unknowns: ['확인할 것'],
    },
  },

  AX_MVP: {
    id: 'AX_MVP',
    name: 'MVP 구체화',
    version: 1,
    tier: 'standard',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '채택한 AX 를 실제로 만들 MVP 범위 · 기능 · 화면 · 데이터 · 단계로 구체화한다.',
    systemInstruction: [
      '[지금까지의 기억] 의 AX 방향(없으면 [작업 요청] 의 방향)을 실제로 만들 MVP 로 구체화한다.',
      '꼭 필요한 기능(필수)과 다음 판(다음)을 나눈다. 처음 MVP 는 작게.',
      '기간은 근거가 없으면 "(추정)" 을 붙인다. 비용 숫자는 만들지 않는다.',
      'KPI 는 실제로 잴 수 있는 것만.',
    ],
    outputSchema: {
      type: 'object',
      required: ['mvpName', 'oneLine', 'features'],
      props: {
        mvpName: { type: 'string' },
        oneLine: { type: 'string' },
        target: { type: 'string' },
        problem: { type: 'string' },
        coreFlow: STRINGS,
        features: { type: 'array', items: { type: 'object', required: ['name'], props: { name: { type: 'string' }, priority: { type: 'string' }, detail: { type: 'string' } } } },
        screens: STRINGS,
        data: STRINGS,
        phases: { type: 'array', items: { type: 'object', required: ['name'], props: { name: { type: 'string' }, scope: { type: 'string' }, duration: { type: 'string' } } } },
        kpis: { type: 'array', items: { type: 'object', required: ['name'], props: { name: { type: 'string' }, howToMeasure: { type: 'string' } } } },
        outOfScope: STRINGS,
        risks: STRINGS,
        unknowns: STRINGS,
      },
    },
    example: {
      mvpName: 'MVP 이름',
      oneLine: '한 줄 설명',
      target: '누가 쓰나',
      problem: '푸는 문제',
      coreFlow: ['사용 흐름 1단계'],
      features: [{ name: '기능', priority: '필수 | 다음', detail: '설명' }],
      screens: ['화면'],
      data: ['필요 데이터'],
      phases: [{ name: '1단계', scope: '범위', duration: '4주(추정)' }],
      kpis: [{ name: '지표', howToMeasure: '재는 법' }],
      outOfScope: ['이번에 안 하는 것'],
      risks: ['리스크'],
      unknowns: ['확인할 것'],
    },
  },

  AX_FRONT: {
    id: 'AX_FRONT',
    name: 'AX 화면 기획',
    version: 1,
    tier: 'standard',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: 'AX 서비스 화면을 구조화된 UI 명세로 — PC 대시보드 1개 + 모바일 핵심 화면 2개.',
    systemInstruction: [
      '미래AI랩 AX Front 원칙: 고급스럽고 간결한 SaaS · 정보 과다 금지 · PC 핵심 Dashboard 1개 · 모바일 핵심 화면 2개 · 큰 글자 · 명확한 KPI · 실제 쓸 수 있는 UI · 장식 최소.',
      '업체 업종에 맞는 데이터와, 데모 같지 않은 현실적인 문구를 쓴다. 표 · 숫자는 "예시 데이터" 다(실제 업체 숫자로 단정하지 않는다).',
      '그림을 그리지 말고 구조만 준다 — 화면은 OS 가 직접 그린다(글자 수정이 바로 반영된다).',
      'KPI 는 3~4개, 대시보드 구역은 2~4개, 표 열은 4~6개, 표 줄은 3~6개, 모바일 화면마다 블록 2~4개.',
    ],
    outputSchema: {
      type: 'object',
      required: ['appName', 'kpis', 'dashboard', 'mobile1', 'mobile2'],
      props: {
        appName: { type: 'string' },
        userType: { type: 'string' },
        oneLine: { type: 'string' },
        kpis: { type: 'array', items: { type: 'object', required: ['label', 'value'], props: { label: { type: 'string' }, value: { type: 'string' }, hint: { type: 'string' } } } },
        navigation: STRINGS,
        dashboard: { type: 'object', required: ['title', 'sections'], props: { title: { type: 'string' }, sections: { type: 'array', items: { type: 'object', required: ['title'], props: { title: { type: 'string' }, kind: { type: 'string' }, items: STRINGS } } } } },
        table: { type: 'object', required: ['columns', 'rows'], props: { title: { type: 'string' }, columns: STRINGS, rows: { type: 'array', items: STRINGS } } },
        mobile1: { type: 'object', required: ['title', 'blocks'], props: { title: { type: 'string' }, purpose: { type: 'string' }, blocks: { type: 'array', items: { type: 'object', required: ['title'], props: { title: { type: 'string' }, lines: STRINGS } } } } },
        mobile2: { type: 'object', required: ['title', 'blocks'], props: { title: { type: 'string' }, purpose: { type: 'string' }, blocks: { type: 'array', items: { type: 'object', required: ['title'], props: { title: { type: 'string' }, lines: STRINGS } } } } },
      },
    },
    example: {
      appName: '서비스 이름',
      userType: '누가 쓰나',
      oneLine: '한 줄 설명',
      kpis: [{ label: '지표 이름', value: '예시 값', hint: '보충' }],
      navigation: ['메뉴'],
      dashboard: { title: '대시보드 제목', sections: [{ title: '구역', kind: 'list | table | chart | kpi', items: ['줄'] }] },
      table: { title: '표 제목', columns: ['열'], rows: [['칸']] },
      mobile1: { title: '모바일 화면 1', purpose: '무엇을 하나', blocks: [{ title: '블록', lines: ['줄'] }] },
      mobile2: { title: '모바일 화면 2', purpose: '무엇을 하나', blocks: [{ title: '블록', lines: ['줄'] }] },
    },
  },

  SANGHO_PROPOSAL: {
    id: 'SANGHO_PROPOSAL',
    name: '제안서 구성',
    version: 1,
    tier: 'standard',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '제안서의 목적 · 대상 · 페이지별 제목 · 핵심 메시지 · 본문 · 핵심 수치 · 시각 방향을 만든다(글자는 OS 가 그린다).',
    systemInstruction: [
      '미래AI랩 대표가 업체(또는 기관)에 보여 줄 제안서의 페이지 구성을 만든다.',
      '글자는 이미지로 그리지 않는다 — 페이지마다 제목 · 핵심 메시지 · 본문 줄 · 핵심 수치 · 시각 방향(visual)만 준다. OS 가 실제 글자로 그린다.',
      '페이지 수는 [작업 요청] 의 pages(5 · 8 · 10). 제목은 서로 겹치지 않게, 각 22자 안. 핵심 메시지는 40자 안. 본문 줄은 페이지마다 2~4줄, 줄마다 45자 안.',
      '핵심 수치는 [업체 자료] · [지금까지의 기억] 에 있는 숫자만. basis 에 "업체 사실" · "추정" · "미확인" 중 하나.',
      '회사 이름은 [업체 자료] 의 회사명을 그대로 쓴다. 자리표시자([회사명] · OOO · XX)를 남기지 않는다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['purpose', 'pages'],
      props: {
        purpose: { type: 'string' },
        audience: { type: 'string' },
        pageCount: { type: 'number' },
        pages: { type: 'array', items: { type: 'object', required: ['title', 'message'], props: { no: { type: 'number' }, title: { type: 'string' }, message: { type: 'string' }, bullets: STRINGS, keyNumbers: { type: 'array', items: { type: 'object', required: ['label', 'value'], props: { label: { type: 'string' }, value: { type: 'string' }, basis: { type: 'string' } } } }, visual: { type: 'string' } } } },
        unknowns: STRINGS,
      },
    },
    example: {
      purpose: '제안 목적',
      audience: '보는 사람',
      pageCount: 5,
      pages: [{ no: 1, title: '페이지 제목', message: '핵심 메시지', bullets: ['본문 줄'], keyNumbers: [{ label: '항목', value: '값', basis: '업체 사실 | 추정 | 미확인' }], visual: '시각 방향' }],
      unknowns: ['확인할 것'],
    },
  },

  PATENT_IDEA: {
    id: 'PATENT_IDEA',
    name: '특허 아이디어',
    version: 1,
    tier: 'deep',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '채택한 AX 를 바탕으로 특허 아이디어를 정리한다(변리사 대체 아님 · 특허 가능 확정 금지).',
    systemInstruction: [
      '업체의 AX 전략([지금까지의 기억] 의 AX 방향 · MVP)을 바탕으로 특허 아이디어 2~3개를 정리한다.',
      '변리사를 대신하지 않는다. "특허 가능" 이라고 확정하지 않는다. 특허성 리스크를 솔직히 쓴다.',
      '각 아이디어: 발명의 문제 · 기존 방식 · 핵심 아이디어 · 차별적 구성 · 데이터 흐름 · 핵심 처리 절차 · 예상 독립항 포인트 · 종속항 후보 · 구현 예 · 선행기술 검색 키워드 · 특허성 리스크 · 사업과의 연결.',
      'warning 에는 정확히 "내부 아이디어 정리용이며 실제 특허성/권리범위는 선행기술조사 및 변리사 검토가 필요합니다." 를 쓴다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['warning', 'ideas'],
      props: {
        warning: { type: 'string' },
        ideas: { type: 'array', items: { type: 'object', required: ['title', 'coreIdea'], props: { title: { type: 'string' }, problem: { type: 'string' }, priorArt: { type: 'string' }, coreIdea: { type: 'string' }, distinct: STRINGS, dataFlow: STRINGS, procedure: STRINGS, independentClaim: { type: 'string' }, dependentClaims: STRINGS, embodiment: { type: 'string' }, searchKeywords: STRINGS, risks: STRINGS, businessLink: { type: 'string' } } } },
        unknowns: STRINGS,
      },
    },
    example: {
      warning: '내부 아이디어 정리용이며 실제 특허성/권리범위는 선행기술조사 및 변리사 검토가 필요합니다.',
      ideas: [{ title: '아이디어 이름', problem: '발명의 문제', priorArt: '기존 방식', coreIdea: '핵심 아이디어', distinct: ['차별적 구성'], dataFlow: ['데이터 흐름'], procedure: ['처리 절차'], independentClaim: '독립항 포인트', dependentClaims: ['종속항 후보'], embodiment: '구현 예', searchKeywords: ['검색 키워드'], risks: ['특허성 리스크'], businessLink: '사업과의 연결' }],
      unknowns: ['확인할 것'],
    },
  },

  VENTURE_PLAN: {
    id: 'VENTURE_PLAN',
    name: '벤처기업확인 사업계획',
    version: 1,
    tier: 'deep',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '업체 기억 + 채택한 AX/MVP + 특허 아이디어로 벤처기업확인 사업계획 논리를 9개 칸(기업인증 벤처 패키지와 같은 칸)에 쓴다.',
    systemInstruction: [
      '벤처기업확인 사업계획의 핵심 논리를 쓴다. 칸은 OS 기업인증 모듈의 벤처 준비 패키지와 같다:',
      'basic 회사 기본정보 · problem 해결하려는 문제 · product 제품 · 서비스 · tech 기술 · 차별성 · market 시장 · growth 매출 · 성장 · rnd 연구개발 · ip 지식재산 · proof 실증 · 성과.',
      '[지금까지의 기억] 의 AX 방향 · MVP · 특허 방향을 기술성 · 혁신성 · 사업성 논리에 이어서 쓴다.',
      '자료에 없는 실적 · 매출 · 인원 · 특허 번호는 만들지 않는다 — 그 칸은 "미확인 — 대표 확인: (무엇)" 으로.',
      'evidenceNeeded 에 이 논리를 뒷받침할 서류 · 증빙을 적는다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['sections'],
      props: {
        oneLine: { type: 'string' },
        sections: { type: 'object', required: ['basic', 'problem', 'product', 'tech', 'market', 'growth', 'rnd', 'ip', 'proof'], props: { basic: { type: 'string' }, problem: { type: 'string' }, product: { type: 'string' }, tech: { type: 'string' }, market: { type: 'string' }, growth: { type: 'string' }, rnd: { type: 'string' }, ip: { type: 'string' }, proof: { type: 'string' } } },
        evidenceNeeded: STRINGS,
        unknowns: STRINGS,
      },
    },
    example: {
      oneLine: '사업계획 한 줄',
      sections: { basic: '회사 기본정보', problem: '해결하려는 문제', product: '제품 · 서비스', tech: '기술 · 차별성', market: '시장', growth: '매출 · 성장', rnd: '연구개발', ip: '지식재산', proof: '실증 · 성과' },
      evidenceNeeded: ['필요 증빙'],
      unknowns: ['확인할 것'],
    },
  },

  FUNDING_STRATEGY: {
    id: 'FUNDING_STRATEGY',
    name: '정책자금 · 정부지원 전략',
    version: 1,
    tier: 'deep',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '정책자금 · 보증 · 정부지원 전략 — 항목마다 근거 종류(업체 사실 · 내부 사례 · 최신 외부 · AI 추정 · 미확인)를 붙인다.',
    systemInstruction: [
      '정책자금 · 보증 · 정부지원 전략을 정리한다. 정확성이 가장 중요하다.',
      '근거 없는 승인 가능성 · 금액 · 제도 한도를 만들지 않는다. 최신 제도(올해 공고 · 한도 · 금리)는 너가 확실히 알 수 없다 — needsLatestCheck 를 true 로 하고 basis 를 "최신 외부" 또는 "미확인" 으로.',
      'basis 는 반드시 다섯 중 하나: "업체 사실"([업체 자료] 에 있는 것) · "내부 사례"([OS 진단] 에 있는 것) · "최신 외부"(공고 확인이 필요한 외부 정보) · "AI 추정" · "미확인".',
      '[OS 진단] 이 있으면 그 결과(규칙 판정)를 먼저 쓰고 그 위에 전략을 얹는다.',
      'latestCheck 에 대표가 직접 확인할 최신 자료(기관 공고 · 한도 등)를 적는다.',
    ],
    outputSchema: {
      type: 'object',
      required: ['oneLine', 'items'],
      props: {
        oneLine: { type: 'string' },
        items: { type: 'array', items: { type: 'object', required: ['title', 'detail', 'basis'], props: { title: { type: 'string' }, detail: { type: 'string' }, basis: { type: 'string' }, needsLatestCheck: { type: 'boolean' } } } },
        nextSteps: STRINGS,
        latestCheck: STRINGS,
        unknowns: STRINGS,
      },
    },
    example: {
      oneLine: '자금 전략 한 줄',
      items: [{ title: '항목', detail: '설명', basis: '업체 사실 | 내부 사례 | 최신 외부 | AI 추정 | 미확인', needsLatestCheck: true }],
      nextSteps: ['다음 할 일'],
      latestCheck: ['확인할 최신 자료'],
      unknowns: ['확인할 것'],
    },
  },

  CONSULTANT_MESSAGE: {
    id: 'CONSULTANT_MESSAGE',
    name: '동료 전달문구',
    version: 1,
    tier: 'cheap',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '동료 컨설턴트에게 카카오톡으로 보낼 요약 — 300자 · 500자 · 자세히.',
    systemInstruction: [
      '동료 컨설턴트에게 카카오톡으로 그대로 붙여넣을 요약을 쓴다.',
      '순서: 가장 추천하는 방향 먼저 → 이유 → 구현 아이디어 → (있으면) 유사 사례 → 다음 단계.',
      '전문적이지만 어려운 말은 줄인다. 내부 도구 · 스킬 · 기준 문서 이름은 절대 쓰지 않는다.',
      '길이: [작업 요청] 의 length 가 300 이면 300자 안, 500 이면 500자 안, detail 이면 900자 안.',
      '인사말은 짧게. 마크다운 기호(#, **) 없이 카톡에 맞는 줄바꿈만.',
    ],
    outputSchema: { type: 'object', required: ['message'], props: { message: { type: 'string' } } },
    example: { message: '카톡에 붙일 글' },
  },

  FREE_CHAT: {
    id: 'FREE_CHAT',
    name: '자유 AI 작업',
    version: 1,
    tier: 'standard',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '빠른 작업으로 안 되는 일 — 이 업체 기억이 붙은 자유 질문.',
    systemInstruction: [
      '[작업 요청] 의 질문에 이 업체 자료 · 기억을 써서 답한다. 일반론보다 이 업체에 맞춘 답.',
      'answer 는 읽기 쉬운 글(필요하면 "- " 목록). 길게 늘이지 않는다.',
      'memoryCandidate 에는 이 답에서 업체 기억에 남길 만한 한 줄(없으면 빈 글).',
    ],
    outputSchema: { type: 'object', required: ['answer'], props: { answer: { type: 'string' }, memoryCandidate: { type: 'string' } } },
    example: { answer: '답', memoryCandidate: '기억에 남길 한 줄' },
  },

  CONTEXT_UPDATE: {
    id: 'CONTEXT_UPDATE',
    name: '기억 정리',
    version: 1,
    tier: 'cheap',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '채택한 결과를 지금까지의 기억(Current Context) 칸에 맞게 짧게 정리한다(대표가 확인 뒤 저장).',
    systemInstruction: [
      '[지금까지의 기억] 을 [작업 요청] 의 새 결과로 고쳐 쓴다. 칸마다 2~4줄, 짧게.',
      '새 결과와 다른 예전 내용은 지우지 말고 "(예전) …" 으로 한 줄 남긴다. 확정되지 않은 것은 unknowns 로.',
      '칸: oneLine 회사 한줄 정의 · coreBusiness 핵심 사업 · problems 해결할 문제 · axDirection 선택된 AX 방향 · mvp 선택한 MVP · patent 특허 방향 · venture 벤처 전략 · funding 자금 전략 · quotes 중요한 대표/컨설턴트 발언 · decided 확정사항 · unknowns 미확인사항 · nextSteps 다음 할 일.',
    ],
    outputSchema: {
      type: 'object',
      required: ['proposed'],
      props: { proposed: { type: 'object', required: [], props: { oneLine: { type: 'string' }, coreBusiness: { type: 'string' }, problems: { type: 'string' }, axDirection: { type: 'string' }, mvp: { type: 'string' }, patent: { type: 'string' }, venture: { type: 'string' }, funding: { type: 'string' }, quotes: { type: 'string' }, decided: { type: 'string' }, unknowns: { type: 'string' }, nextSteps: { type: 'string' } } } },
    },
    example: { proposed: { oneLine: '', coreBusiness: '', problems: '', axDirection: '', mvp: '', patent: '', venture: '', funding: '', quotes: '', decided: '', unknowns: '', nextSteps: '' } },
  },

  PROOFREAD: {
    id: 'PROOFREAD',
    name: '맞춤법 · 오타 검사',
    version: 1,
    tier: 'cheap',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '제안서 글의 맞춤법 · 오타 · 어색한 말만 찾아 고칠 안을 준다(내용은 바꾸지 않는다).',
    systemInstruction: [
      '[작업 요청] 의 글에서 맞춤법 · 띄어쓰기 · 오타 · 어색한 말만 찾는다. 내용 · 숫자 · 회사 이름은 바꾸지 않는다.',
      'where 에는 [작업 요청] 에 붙은 위치 표시(예: "p3 본문2") 를 그대로 쓴다. before 는 원문 그대로의 짧은 조각.',
      '고칠 것이 없으면 fixes 를 빈 배열로.',
    ],
    outputSchema: { type: 'object', required: ['fixes'], props: { fixes: { type: 'array', items: { type: 'object', required: ['where', 'before', 'after'], props: { where: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, reason: { type: 'string' } } } } } },
    example: { fixes: [{ where: 'p1 제목', before: '원문 조각', after: '고친 조각', reason: '이유' }] },
  },

  SNAPSHOT_EXTRACT: {
    id: 'SNAPSHOT_EXTRACT',
    name: '자료 요약 · 정보 추출',
    version: 1,
    tier: 'cheap',
    active: true,
    createdAt: D,
    updatedAt: D,
    description: '올린 자료(회사소개서 · 홈페이지 글 · 붙여넣은 글)를 요약하고 업체 기본 정보를 뽑는다(없으면 미확인).',
    systemInstruction: [
      '[업체 자료] 의 자료 글을 읽고 요약 · 업체 정보를 뽑는다.',
      '자료에 그대로 있는 값만. 없으면 value 를 "미확인". source 에는 어느 자료에서 봤는지(자료 제목).',
      'summary 는 5줄 안.',
    ],
    outputSchema: {
      type: 'object',
      required: ['summary', 'facts'],
      props: {
        summary: { type: 'string' },
        facts: { type: 'array', items: { type: 'object', required: ['key', 'value'], props: { key: { type: 'string' }, value: { type: 'string' }, source: { type: 'string' } } } },
      },
    },
    example: {
      summary: '요약',
      facts: [{ key: 'industry | founded | ceo | employees | revenue | homepage | mainProblem | currentSystem | coreBusiness', value: '값 또는 미확인', source: '자료 제목' }],
    },
  },
}

export function skillOf(id) {
  const s = typeof id === 'string' ? SKILLS[id] : undefined
  return s && s.active ? s : null
}
