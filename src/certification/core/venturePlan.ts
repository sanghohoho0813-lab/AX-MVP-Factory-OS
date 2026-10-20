/**
 * D-246 벤처기업확인(혁신성장유형) 사업계획서 — 신청 사이트에 들어가는 순서 그대로의 칸 · 규칙(AI 없음).
 *
 * 칸 순서는 실제로 제출한 사업계획서(2026-07 출력본)와 요구사항 정의서 v2.0 부록 A 를 맞춘 것이다.
 *   사업계획서 요약(기술명 · 기술 요약 · 업종 · 신산업 · 기술로드맵)
 *   → 핵심 요약 7칸(사이트가 주는 빈칸 문장 — 문제 · 해결책 · 시장 · 차별점 · 지식재산권 · 마케팅 · 성장 계획)
 *   → [1] 문제정의 및 해결방안(서술 5 + 연구개발 조직 · 연구개발비 · 기술개발 실적 · 지식재산권)
 *   → [2] 성장전략(서술 5 + 외부 협업 실적 · ESG)
 *
 * 저장은 기업인증 기록(cert-os · venture)의 notes 에 'vplan:' 로 시작하는 키로 한다 — 새 표 · 마이그레이션 없음.
 * 글자 수는 막지 않고 알린다: 실제 제출본에서 '시장진입 추진경과' 가 1,599자로 들어간 적이 있어 사이트 한도가 칸마다 같은지 확인하지 못했다.
 */

export type VPlanPart = 'summary' | 'core' | 'problem' | 'growth'
export type VPlanKind = 'line' | 'text' | 'rows' | 'choice'

export interface VPlanField {
  id: string
  part: VPlanPart
  /** 사이트 화면의 번호(예: '[1] 1') — 사람이 사이트에서 같은 칸을 찾게 */
  no: string
  title: string
  kind: VPlanKind
  /** 서술 칸 글자 수 기준(넘으면 알림만) */
  limit?: number
  /** 한도와 다른 실제 사례 등 — 글자 수 줄에 함께 */
  limitNote?: string
  /** 사이트의 복수 선택 체크박스 */
  checks?: readonly string[]
  /** 하나 고르기(kind 'choice') */
  options?: readonly string[]
  /** rows 칸 — 한 줄에 무엇을 적는지 */
  rowHint?: string
  /** 핵심 요약 — 사이트가 주는 문장 틀(［ ］ 가 빈칸) */
  template?: string
  /** 틀이 지켜졌는지 볼 고정 말(빈칸 밖) */
  fixed?: readonly string[]
  /** 쓰는 순서 · 담을 것(부록 A 권장 서술) */
  guide: readonly string[]
  /** 하지 말 것 */
  avoid?: readonly string[]
  /** AI 초안 묶음(같은 묶음은 한 번에 쓴다) */
  batch?: VPlanBatch
}

export type VPlanBatch = 'p1' | 'p2' | 'g1' | 'g2' | 'x' | 'sum'

export const VPLAN_PART_LABEL: Record<VPlanPart, string> = {
  summary: '사업계획서 요약',
  core: '사업계획서 핵심 요약',
  problem: '[1] 문제정의 및 해결방안',
  growth: '[2] 성장전략',
}

const NARRATIVE = 1000
const NO_FAKE = ['자료에 없는 매출 · 고객 수 · 인원 · 특허 번호를 만들지 않는다.', '계획은 "~할 계획" 으로, 이미 한 일과 섞지 않는다.']

export const PROBLEM_CHECKS = ['많은 사람들이 겪고 있는 문제임', '앞으로 더 많은 사람들이 경험할 문제임', '시급히 해결되어야 하는 문제임', '현재 많은 비용이 투입되는 문제임', '꼭 해결해야 하는 문제임', '자주 발생하는 문제임'] as const
export const DIFF_CHECKS = ['기존에 없는 제품', '기존제품 대비 고성능', '기존 제품 대비 저렴함', '기존 제품 대비 편리함', '기존제품 대비 디자인 우수', '기타'] as const
export const FUNDING_CHECKS = ['영업이익', '자본금', '투자(엔젤)', '투자(VC)', '투자(금융권)', '정부지원(창업지원)', '정부지원(R&D 지원)', '대출(정책보증)', '대출(시중은행)', '기타'] as const
export const RD_ORG_OPTIONS = ['기업부설연구소(한국산업기술진흥협회 인정)', '연구개발전담부서(한국산업기술진흥협회 인정)', '기업부설창작연구소(한국콘텐츠진흥원 인정)', '기업창작전담부서(한국콘텐츠진흥원 인정)', '자체연구부서', '없음'] as const
export const RND_BASIS_OPTIONS = ['재무자료(재무상태표 · 손익계산서 개발비)', 'R&D 세액공제 사전심사 통지서'] as const

/** 사이트에 들어가는 순서 그대로 */
export const VPLAN_FIELDS: readonly VPlanField[] = [
  /* ---------------- 사업계획서 요약 ---------------- */
  { id: 'tech_name', part: 'summary', no: '요약', title: '신청기술(제품/서비스)명', kind: 'line', batch: 'sum', guide: ['핵심 기술과 고객 가치가 드러나는 기술명 하나.', '특허 명칭과 같은 말로 시작하면 특허 · 사업계획이 한 이야기로 읽힌다.'], avoid: ["'AI 플랫폼' 처럼 무엇인지 모를 이름"] },
  { id: 'tech_summary', part: 'summary', no: '요약', title: '신청기술(제품/서비스) 요약', kind: 'text', limit: 300, batch: 'sum', guide: ['누구의 어떤 문제를, 어떤 방식으로 해결하는지 1~2문장.'] },
  { id: 'industry', part: 'summary', no: '요약', title: '벤처확인신청 산업분야 — 평가희망업종', kind: 'line', guide: ['예: 지식서비스 · 제조 · 정보통신 — 사이트 선택지 그대로.'] },
  { id: 'new_industry', part: 'summary', no: '요약', title: '신산업분야 해당', kind: 'choice', options: ['해당', '해당 없음'], guide: ['신산업 분야 목록에 들면 해당.'] },
  { id: 'roadmap', part: 'summary', no: '요약', title: '중소기업 기술로드맵 — 해당 여부 · 전략분야', kind: 'line', guide: ['해당하면 전략분야 경로(예: 신 디지털 전환 → 서비스 플랫폼 → …), 아니면 "해당 없음".'] },

  /* ---------------- 핵심 요약 7칸(사이트 빈칸 문장) ---------------- */
  { id: 'core_problem', part: 'core', no: '핵심 요약', title: '문제', kind: 'text', batch: 'sum', template: '기존 시장에 ［무엇］ 니즈(문제)가 있는데, ［왜］ 때문에 사람들이 여전히 ［어떤 불편］을 겪고 있음', fixed: ['니즈(문제)가 있는데', '때문에', '겪고 있음'], guide: ['[1] 1 개발 배경을 한 문장으로 줄인 것.'] },
  { id: 'core_solution', part: 'core', no: '핵심 요약', title: '해결책', kind: 'text', batch: 'sum', template: '당사에서 ［해결책］을 해결책으로 찾았으며, 이는 기존시장의 기술(제품, 서비스)과 ［무엇이 다른］ 차이를 보유하고 있음', fixed: ['해결책으로 찾았으며', '차이를 보유하고 있음'], guide: ['[1] 2 경쟁력 확보 방안을 한 문장으로.'] },
  { id: 'core_market', part: 'core', no: '핵심 요약', title: '시장', kind: 'text', batch: 'sum', template: '현재 당사에서 보유 또는 개발 중인 기술(제품, 서비스)명은 「［신청기술명］」으로서, 전체 시장은 ［시장 범위］ 규모이며, ［성장 근거］를 고려할 때, 본 기술(제품·서비스)이 잠재고객의 니즈를 충족할 경우 관련 시장은 연평균 ［성장률］ 수준의 성장을 기대할 수 있음.', fixed: ['보유 또는 개발 중인', '전체 시장은', '연평균'], guide: ['기술명은 위 신청기술명과 같게.', '시장 규모 · 성장률은 출처가 있는 숫자만 — 없으면 [2] 1 에서 먼저 확인.'] },
  { id: 'core_diff', part: 'core', no: '핵심 요약', title: '차별점', kind: 'text', batch: 'sum', template: '당사 기술(제품, 서비스)은 ［특징］ 특징을 갖고 있으며, ［이유］ 이유로 기존 문제에 대한 차별화된 해결방안으로 ［기대 효과］할 것으로 기대됨', fixed: ['특징을 갖고 있으며', '차별화된 해결방안으로'], guide: ['특허 청구항 · 실제 구현에 있는 특징만.'] },
  { id: 'core_ip', part: 'core', no: '핵심 요약', title: '지식재산권', kind: 'text', template: '기술(제품, 서비스)에 대한 특허출원 등 ［n］건의 지식재산권과 ［연구조직］ 및 ［n］명의 연구개발조직을 보유하여 ［n］건의 기술개발을 지속적으로 수행하고 있는 등 끊임없는 연구개발에 노력하고 있으며, 지속발전이 가능한 기술적 역량을 보유하고 있음', fixed: ['건의 지식재산권과', '명의 연구개발조직을', '건의 기술개발을'], guide: ['숫자는 아래 지식재산권 · 연구조직 · 기술개발 실적 칸에서 그대로 — [사실로 채우기] 를 누르면 넣어 준다.'] },
  { id: 'core_marketing', part: 'core', no: '핵심 요약', title: '마케팅', kind: 'text', batch: 'sum', template: '기술(제품, 서비스)을 통한 시장진입을 위해 ［활동］ 등의 마케팅 활동을 진행 중으로 현재 ［확보한 시장 · 고객］을 확보하고 있으며, 시장 확대를 위해 향후 3년간 ［계획］ 등의 마케팅 계획을 수립하여 진행할 계획', fixed: ['마케팅 활동을 진행 중으로', '향후 3년간'], guide: ['[2] 3 시장진입 추진경과 · 향후 3년 계획을 한 문장으로.'] },
  { id: 'core_growth', part: 'core', no: '핵심 요약', title: '성장 계획', kind: 'text', batch: 'sum', template: '당사가 제시하는 이러한 성과가 가능한 이유는 당사에 ［핵심 역량］ 역량이 있기 때문이며 이를 더욱 강화하여 향후 3년간 지속가능한 성장을 실현할 계획임', fixed: ['성과가 가능한 이유는', '지속가능한 성장을 실현할 계획임'], guide: ['[1] 4 팀 구성 · 실제 경험에서 나온 역량.'] },

  /* ---------------- [1] 문제정의 및 해결방안 ---------------- */
  { id: 'development_background', part: 'problem', no: '[1] 1', title: '제품/서비스의 개발 배경 및 필요성', kind: 'text', limit: NARRATIVE, checks: PROBLEM_CHECKS, batch: 'p1', guide: ['대상 고객 · 업무와 지금 방식(엑셀 · 전화 · 수기 · 기존 솔루션).', '반복되는 빈도 · 원인 · 손실(확인된 숫자가 있으면).', '기존 해결 방식의 빈틈.', '회사가 이 문제를 실제로 겪거나 본 계기.', '그래서 이 신청기술이 왜 필요한지.'], avoid: ['근거 없이 체크박스를 고르기(많은 사람이 겪는다 → 대상 · 숫자 근거)', ...NO_FAKE] },
  { id: 'competitiveness_strategy', part: 'problem', no: '[1] 2', title: '솔루션으로서의 제품/서비스 소개(경쟁력 확보 방안)', kind: 'text', limit: NARRATIVE, checks: DIFF_CHECKS, batch: 'p1', guide: ['문제에 바로 대응하는 구조 · 핵심 기능(특허 구성요소와 연결).', '쓰기 전 → 쓴 뒤 고객 · 직원의 일이 어떻게 바뀌는지.', '기존 방식 대비 우위와 그 근거(데이터 · 노하우 · 특허 · 실증).', '누가 쓰고 어떻게 돈을 받는지.', '쉽게 따라 하지 못하게 할 개선 · 유지 전략.'], avoid: ["'더 빠르고 스마트하다 · AI 로 혁신적 · 독보적' 같은 수식만 나열", '시연 숫자를 성능 기준처럼 쓰기'] },
  { id: 'technology_progress', part: 'problem', no: '[1] 3-1', title: '제품/서비스 관련 기술개발 — 추진 경과', kind: 'text', limit: NARRATIVE, batch: 'p2', guide: ['아이디어 착수 → 문제 정의 → 설계 · 시제품(MVP) → 구현 · 시험 → 개선 → 실제 사용 · 피드백 → 지금 단계.', '기간 · 누가 · 성과를 붙인다(특허 출원 · 연구조직 설립 등 실제 한 일).'], avoid: ['외주 개발을 자체 개발처럼 쓰기', ...NO_FAKE] },
  { id: 'technology_plan_3y', part: 'problem', no: '[1] 3-2', title: '제품/서비스 관련 기술개발 — 향후 3년간 추진 계획', kind: 'text', limit: NARRATIVE, batch: 'p2', guide: ['1년 차: 고도화 · 안정화 · 핵심 지표 측정.', '2년 차: 대상 · 데이터 확대 · 자동화 검증.', '3년 차: 사업화 · 확장 · 지식재산 · 기술 내재화.', '연차마다 무엇 · 누가(내부 · 외주 · 파트너) · 검증 기준.'], avoid: ['인력 · 자금이 확보되지 않았는데 확정처럼 쓰기'] },
  { id: 'entrepreneurship_example', part: 'problem', no: '[1] 4', title: '팀 구성 — 기업가정신을 발휘했던 경험', kind: 'text', limit: NARRATIVE, batch: 'x', guide: ['사업 기회 포착 → 불확실성 · 제약 → 대표의 결정 → 자원 조달 · 조직화 → 실행 → 확인된 성과 · 교훈.', '특허 출원 · 연구조직 설립 · 시스템 구축 · 채용 · 고객 계약 같은 대표의 실행 중심.'], avoid: ['개인 미담 · 의지만 길게', '확인 안 된 성과'] },
  { id: 'rd_org', part: 'problem', no: '[1] 4', title: '팀 구성 — 연구개발 조직현황', kind: 'choice', options: RD_ORG_OPTIONS, guide: ['인정서 · 신고 상태를 확인한 것만. 사내에서 개발만 한다고 인정 연구소라고 고르지 않는다.'] },
  { id: 'rnd_expense', part: 'problem', no: '[1] 5', title: '연구개발비 — 당기 연구개발비(원)', kind: 'line', guide: ['숫자만(원). 산정 경로 하나를 골라 그 근거와 같게.', '개발 외주비 · 인건비 · 회계상 개발비를 같은 것으로 보지 않는다.'] },
  { id: 'rnd_basis', part: 'problem', no: '[1] 5', title: '연구개발비 — 산정 경로', kind: 'choice', options: RND_BASIS_OPTIONS, guide: ['재무자료 방식 또는 세액공제 사전심사 — 둘을 더하지 않는다.'] },
  { id: 'dev_records', part: 'problem', no: '[1] 6', title: '기술개발 실적', kind: 'rows', rowHint: '구분 / 실적명 / 수행기간(YYYY-MM~YYYY-MM) / 지원 · 협력기관 — 한 줄에 하나', guide: ['구분: 정부 · 지자체 공모 R&D / 해외 공동연구 / 국내 공동연구 / 정부지원금 활용 / 기업 자체 연구실적.', '단순 외주개발(회사가 기술 권리를 갖지 않음)은 실적으로 인정되지 않는다.'] },
  { id: 'ip_records', part: 'problem', no: '[1] 7', title: '지식재산권 보유 현황', kind: 'rows', rowHint: '구분 / 출원 · 등록 / 명칭 / 번호 / 일자 / 권리자 — 한 줄에 하나', guide: ['출원중과 등록을 나눈다. 출원번호를 등록번호로 쓰지 않는다.', '출원 전이면 번호 · 일자는 비워 두고 출원 뒤 넣는다.'] },

  /* ---------------- [2] 성장전략 ---------------- */
  { id: 'market_target', part: 'growth', no: '[2] 1', title: '목표시장 및 고객 정의', kind: 'text', limit: NARRATIVE, batch: 'g1', guide: ['전체시장(TAM) → 유효시장(SAM) → 3년 안 확보할 시장(SOM) 순서.', '단계마다 지역 · 업종 · 고객 수 · 돈 내는 사람 · 출처.', '목표 고객 · 가격 · 판매 방식.'], avoid: ['출처 없는 시장 규모 · 성장률'] },
  { id: 'competitor_analysis', part: 'growth', no: '[2] 2', title: '경쟁사 분석', kind: 'text', limit: NARRATIVE, batch: 'g1', guide: ['주요 비교 대상 3곳 이내 — 무엇을 제공 · 강점 · 확인된 한계 · 우리의 대응.', '뚜렷한 경쟁사가 없으면 고객이 지금 쓰는 대체 수단(엑셀 · 전화 · 다른 솔루션)과 바꾸는 이유.'], avoid: ['남의 매출 · 점유율을 확인 없이 단정'] },
  { id: 'market_entry_progress', part: 'growth', no: '[2] 3', title: '시장진입 및 확대 전략 — 추진경과', kind: 'text', limit: NARRATIVE, limitNote: '실제 제출본은 이 칸에 1,599자가 들어갔다 — 사이트 카운터로 확인', batch: 'g2', guide: ['판매 준비 · 지금 영업 · 고객 사용 현황 · 시연 · 홈페이지 · 가격 · 실제 매출 · 이용 수.', '실제로 한 것과 계획을 나눈다.'], avoid: ['제품을 만든 사실을 시장 진입 실적처럼 쓰기'] },
  { id: 'market_entry_plan_3y', part: 'growth', no: '[2] 3', title: '시장진입 및 확대 전략 — 향후 3년간 추진 계획', kind: 'text', limit: NARRATIVE, limitNote: '실제 제출본은 이 칸에 1,251자가 들어갔다 — 사이트 카운터로 확인', batch: 'g2', guide: ['연차마다 대상 고객 · 채널 → 판매 방식 → 인력 · 예산 → 목표(매출 · 도입 수) → 확인할 지표.'], avoid: ['예정 계약 · 수출을 확정 성과처럼'] },
  { id: 'collab_records', part: 'growth', no: '[2] 4', title: '외부 협업 실적', kind: 'rows', rowHint: '파트너명 / 파트너 역량 / 협업 사항 / 비고(계약 체결 등) — 한 줄에 하나, 없으면 "없음"', guide: ['신청기술과 바로 관련된 실제 계약 · 약정만. MOU 는 해외기관과 맺은 것만(사이트 안내).'] },
  { id: 'financing_plan', part: 'growth', no: '[2] 5', title: '자금운용 계획', kind: 'text', limit: NARRATIVE, checks: FUNDING_CHECKS, batch: 'x', guide: ['지금까지 들인 돈 · 조달(증빙 가능한 금액).', '3년 기술개발 · 시장진입에 필요한 연차별 자금.', '쓰는 곳(개발 · 인건비 · 실증 · 판로).', '재원별 규모 · 준비 상태 · 불확실성, 조달이 늦을 때 대안.'], avoid: ['승인 안 된 지원금 · 상담도 안 한 대출을 확정처럼'] },
  { id: 'esg', part: 'growth', no: '[2] 6', title: 'ESG 자가진단', kind: 'line', guide: ['자가진단을 했으면 결과, 안 했으면 "해당 없음".'] },
]

export const VPLAN_FIELD: Record<string, VPlanField> = Object.fromEntries(VPLAN_FIELDS.map((f) => [f.id, f]))

/** 서술 10칸(사이트의 1,000자 서술란) */
export const NARRATIVE_IDS = VPLAN_FIELDS.filter((f) => f.limit === NARRATIVE).map((f) => f.id)

/* ------------------------------------------------------------------ */
/* 저장 키(기업인증 notes)                                               */
/* ------------------------------------------------------------------ */

export const VK = {
  text: (id: string) => `vplan:f:${id}`,
  checks: (id: string) => `vplan:c:${id}`,
  /** AI 가 마지막으로 쓴 글 — 지금 글과 같으면 사람이 고치지 않은 것 */
  ai: (id: string) => `vplan:ai:${id}`,
  /** 사람이 고친 칸에 온 AI 새 안(덮지 않고 따로) */
  suggestion: (id: string) => `vplan:sug:${id}`,
  /** '' · 'checked'(확인함) · 'entered'(사이트에 입력함) */
  status: (id: string) => `vplan:s:${id}`,
  patent: 'vplan:mat:patent',
  patentFile: 'vplan:mat:patentFile',
  ax: 'vplan:mat:ax',
  memo: 'vplan:mat:memo',
} as const

export type VPlanStatus = '' | 'checked' | 'entered'

export interface VPlanState {
  text: Record<string, string>
  checks: Record<string, string[]>
  ai: Record<string, string>
  suggestion: Record<string, string>
  status: Record<string, VPlanStatus>
  materials: { patent: string; patentFile: string; ax: string; memo: string }
}

export function readPlan(notes: Record<string, string>): VPlanState {
  const s: VPlanState = { text: {}, checks: {}, ai: {}, suggestion: {}, status: {}, materials: { patent: notes[VK.patent] ?? '', patentFile: notes[VK.patentFile] ?? '', ax: notes[VK.ax] ?? '', memo: notes[VK.memo] ?? '' } }
  for (const f of VPLAN_FIELDS) {
    s.text[f.id] = notes[VK.text(f.id)] ?? ''
    s.checks[f.id] = (notes[VK.checks(f.id)] ?? '').split('|').filter((x) => !!x && (!f.checks || f.checks.includes(x)))
    s.ai[f.id] = notes[VK.ai(f.id)] ?? ''
    s.suggestion[f.id] = notes[VK.suggestion(f.id)] ?? ''
    const st = notes[VK.status(f.id)] ?? ''
    s.status[f.id] = st === 'checked' || st === 'entered' ? st : ''
  }
  return s
}

/** 글자 수 — 이모지 · 한글 모두 한 글자(사이트 카운터와 다를 수 있다: 줄바꿈 포함) */
export function charCount(text: string): number {
  return [...(text ?? '')].length
}

/** 사람이 고친 칸인가 — AI 가 쓴 적이 있고 지금 글이 그것과 다르면 */
export function isEdited(s: VPlanState, id: string): boolean {
  const ai = s.ai[id] ?? ''
  const t = s.text[id] ?? ''
  return !!ai.trim() && !!t.trim() && t.trim() !== ai.trim()
}

/* ------------------------------------------------------------------ */
/* AI 결과 합치기 — 사람이 고친 칸은 덮지 않는다                           */
/* ------------------------------------------------------------------ */

export interface DraftItem {
  id: string
  text: string
  checks?: string[]
}

/**
 * AI 초안 → 저장할 notes 조각.
 *   빈 칸 · AI 가 쓴 그대로인 칸 → 바꾼다(AI 글도 기억)
 *   사람이 고친 칸 → 그대로 두고 새 안은 'suggestion' 에(화면에서 [이 안으로 바꾸기])
 *   체크는 사람이 하나도 안 고른 칸에만 넣는다
 */
export function mergeDraft(s: VPlanState, items: readonly DraftItem[]): { patch: Record<string, string>; replaced: string[]; kept: string[] } {
  const patch: Record<string, string> = {}
  const replaced: string[] = []
  const kept: string[] = []
  for (const it of items) {
    const f = VPLAN_FIELD[it.id]
    if (!f) continue
    const text = clean(it.text)
    if (!text) continue
    const cur = (s.text[f.id] ?? '').trim()
    const human = !!cur && cur !== (s.ai[f.id] ?? '').trim()
    if (human) {
      patch[VK.suggestion(f.id)] = text
      kept.push(f.id)
    } else {
      patch[VK.text(f.id)] = text
      patch[VK.ai(f.id)] = text
      patch[VK.suggestion(f.id)] = ''
      if (s.status[f.id] === 'entered' || s.status[f.id] === 'checked') patch[VK.status(f.id)] = ''
      replaced.push(f.id)
    }
    if (f.checks && it.checks?.length && (s.checks[f.id] ?? []).length === 0) {
      const ok = it.checks.map((c) => matchCheck(f.checks!, c)).filter((c): c is string => !!c)
      if (ok.length) patch[VK.checks(f.id)] = [...new Set(ok)].join('|')
    }
  }
  return { patch, replaced, kept }
}

function matchCheck(options: readonly string[], raw: string): string | null {
  const t = raw.replace(/\s+/g, '').trim()
  if (!t) return null
  return options.find((o) => o.replace(/\s+/g, '') === t) ?? options.find((o) => o.replace(/\s+/g, '').includes(t) || t.includes(o.replace(/\s+/g, ''))) ?? null
}

function clean(t: string): string {
  return String(t ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ------------------------------------------------------------------ */
/* 사실로 채우기 — 업체 기록 · 올린 명세서에서 아는 것만                     */
/* ------------------------------------------------------------------ */

export interface VPlanFacts {
  companyName: string
  /** 사실 창고의 특허 수(모르면 null) */
  patents: number | null
  researchUnit: 'lab' | 'dept' | 'none' | null
  researchers: number | null
  rndExpense: number | null
  /** 올린 명세서의 발명의 명칭(없으면 '') */
  patentTitle: string
  industryText: string
}

/** 줄 칸을 줄 배열로 */
export function rowsOf(text: string): string[] {
  return (text ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => !!x && x !== '없음')
}

/** 지식재산권 · 연구조직 · 기술개발 실적에서 핵심 요약 '지식재산권' 칸 문장 */
export function coreIpSentence(s: VPlanState, facts: VPlanFacts): { text: string; missing: string[] } {
  const ip = rowsOf(s.text.ip_records).length || (facts.patents ?? 0)
  const org = (s.text.rd_org || '').replace(/\(.*\)/, '').trim() || (facts.researchUnit === 'lab' ? '기업부설연구소' : facts.researchUnit === 'dept' ? '연구개발전담부서' : '')
  const staff = facts.researchers
  const dev = rowsOf(s.text.dev_records).length
  const missing: string[] = []
  if (!ip) missing.push('지식재산권(아래 [1] 7 칸)')
  if (!org || org === '없음') missing.push('연구개발 조직(아래 [1] 4 칸)')
  if (staff == null) missing.push('연구개발 인원(회사 정보 · 연구소 관리)')
  if (!dev) missing.push('기술개발 실적(아래 [1] 6 칸)')
  const n = (v: number | null | undefined) => (v == null || v === 0 ? '［n］' : String(v))
  const text = `기술(제품, 서비스)에 대한 특허출원 등 ${n(ip)}건의 지식재산권과 ${org && org !== '없음' ? org : '［연구조직］'} 및 ${n(staff)}명의 연구개발조직을 보유하여 ${n(dev)}건의 기술개발을 지속적으로 수행하고 있는 등 끊임없는 연구개발에 노력하고 있으며, 지속발전이 가능한 기술적 역량을 보유하고 있음`
  return { text, missing }
}

/** [사실로 채우기] — 비어 있는 정형 칸만 채운다(이미 적은 것은 그대로) */
export function factFill(s: VPlanState, facts: VPlanFacts): { patch: Record<string, string>; filled: string[] } {
  const patch: Record<string, string> = {}
  const filled: string[] = []
  const put = (id: string, v: string) => {
    if (!v || (s.text[id] ?? '').trim()) return
    patch[VK.text(id)] = v
    filled.push(id)
  }
  if (facts.researchUnit) put('rd_org', facts.researchUnit === 'lab' ? RD_ORG_OPTIONS[0] : facts.researchUnit === 'dept' ? RD_ORG_OPTIONS[1] : RD_ORG_OPTIONS[5])
  if (facts.rndExpense != null && facts.rndExpense > 0) put('rnd_expense', String(Math.round(facts.rndExpense)))
  if (facts.patentTitle) put('ip_records', `특허(국내) / 출원중 / ${facts.patentTitle} / (출원 뒤 입력) / (출원 뒤 입력) / ${facts.companyName || '(권리자)'}`)
  if (facts.patentTitle) put('tech_name', facts.patentTitle)
  // 핵심 요약 '지식재산권' 은 위 칸들을 반영한 뒤 계산 — 이번에 채운 값도 쓴다
  const after: VPlanState = { ...s, text: { ...s.text, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.replace('vplan:f:', ''), v])) } }
  const ip = coreIpSentence(after, facts)
  if (ip.missing.length < 4) put('core_ip', ip.text)
  return { patch, filled }
}

/* ------------------------------------------------------------------ */
/* 점검(규칙) — 내기 전에 걸러 줄 것                                      */
/* ------------------------------------------------------------------ */

export interface VPlanIssue {
  id: string
  field: string
  level: 'warn' | 'info'
  text: string
}

const PLACEHOLDER = /［|\[\s*\]|○○|OO|XX|\(미확인|확인 필요|TODO|\(추정\)/
const REGISTERED = /특허\s*(을|를)?\s*(등록|보유)|등록\s*특허|특허권\s*(을|를)?\s*(보유|취득)/

/** 핵심 요약 '시장' 칸의 「기술명」 */
export function quotedName(text: string): string {
  return /「([^」]+)」/.exec(text ?? '')?.[1]?.trim() ?? ''
}

export function checkPlan(s: VPlanState): VPlanIssue[] {
  const out: VPlanIssue[] = []
  const add = (field: string, level: VPlanIssue['level'], id: string, text: string) => out.push({ id, field, level, text })
  for (const f of VPLAN_FIELDS) {
    const t = (s.text[f.id] ?? '').trim()
    if (!t) continue
    if (f.limit && charCount(t) > f.limit) add(f.id, 'warn', 'OVER', `${charCount(t).toLocaleString('ko-KR')}자 — ${f.limit.toLocaleString('ko-KR')}자 넘음${f.limitNote ? ` (${f.limitNote})` : ''}`)
    if (PLACEHOLDER.test(t)) add(f.id, 'warn', 'PLACEHOLDER', '빈칸 · 확인 필요 · 추정 표시가 남아 있습니다 — 내기 전에 채우거나 지우세요')
    if (f.fixed && f.fixed.some((x) => !t.includes(x))) add(f.id, 'info', 'TEMPLATE', '사이트 문장 틀과 다릅니다 — 사이트 칸이 빈칸 문장이면 틀에 맞춰 넣으세요')
    if (f.checks && (s.checks[f.id] ?? []).length === 0) add(f.id, 'info', 'CHECKS', '체크박스를 아직 고르지 않았습니다(근거가 있는 것만)')
  }
  // 특허 — 출원 중인데 등록 · 보유로 읽히는 말
  const ipRows = rowsOf(s.text.ip_records)
  const onlyFiled = ipRows.length > 0 && ipRows.every((r) => /출원/.test(r) && !/등록\s*\/|\/\s*등록/.test(r))
  if (onlyFiled) {
    for (const f of VPLAN_FIELDS) {
      if (f.kind !== 'text') continue
      if (REGISTERED.test(s.text[f.id] ?? '')) add(f.id, 'warn', 'IP_WORDING', '지식재산권은 출원중인데 "특허 등록 · 보유" 로 읽히는 말이 있습니다 — "특허 출원" 으로')
    }
  }
  // 기술명 — 요약 · 핵심 요약이 같은 이름인가
  const name = (s.text.tech_name ?? '').trim()
  const quoted = quotedName(s.text.core_market ?? '')
  if (name && quoted && quoted !== name) add('core_market', 'warn', 'NAME', `핵심 요약의 기술명 「${quoted}」 이 신청기술명과 다릅니다`)
  return out
}

/* ------------------------------------------------------------------ */
/* 진행 · 내보내기                                                        */
/* ------------------------------------------------------------------ */

export interface VPlanProgress {
  total: number
  filled: number
  narrativeFilled: number
  narrativeTotal: number
  entered: number
  /** 서술 10칸 · 기술명 · 핵심 요약 7칸이 모두 찼다 */
  complete: boolean
}

export function planProgress(s: VPlanState): VPlanProgress {
  const filledOf = (id: string) => !!(s.text[id] ?? '').trim()
  const filled = VPLAN_FIELDS.filter((f) => filledOf(f.id)).length
  const narrativeFilled = NARRATIVE_IDS.filter(filledOf).length
  const core = VPLAN_FIELDS.filter((f) => f.part === 'core').every((f) => filledOf(f.id))
  return {
    total: VPLAN_FIELDS.length,
    filled,
    narrativeFilled,
    narrativeTotal: NARRATIVE_IDS.length,
    entered: VPLAN_FIELDS.filter((f) => s.status[f.id] === 'entered').length,
    complete: narrativeFilled === NARRATIVE_IDS.length && core && filledOf('tech_name'),
  }
}

/** 사이트에 붙일 칸 하나 — 체크박스 줄 + 본문(내부 메모 · 점검 말은 넣지 않는다) */
export function copyText(s: VPlanState, id: string): string {
  return (s.text[id] ?? '').trim()
}

/** 검토용 한 장(MD) — 사이트 순서대로 제목 · 체크 · 본문 · 글자 수 */
export function planMarkdown(s: VPlanState, companyName: string): string {
  const lines: string[] = [`# ${companyName || '업체'} — 벤처기업확인(혁신성장유형) 사업계획서`, '']
  let part: VPlanPart | null = null
  for (const f of VPLAN_FIELDS) {
    if (f.part !== part) {
      part = f.part
      lines.push(`## ${VPLAN_PART_LABEL[part]}`, '')
    }
    const t = (s.text[f.id] ?? '').trim()
    lines.push(`### ${f.no} ${f.title}`)
    const checks = s.checks[f.id] ?? []
    if (f.checks) lines.push(`체크: ${checks.length ? checks.join(' · ') : '(고르지 않음)'}`)
    lines.push(t || '(비어 있음)')
    if (f.limit && t) lines.push(`_(${charCount(t).toLocaleString('ko-KR')}자)_`)
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}
