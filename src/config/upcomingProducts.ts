/**
 * 출시 예정 (D-169) — 상품표 가운데 '결과물이 나오는 컨설팅'(규정 · 정관 · 기금 설립 · 정리 · 실행)을
 * 전문 모듈 › 출시 예정 묶음에 가나다 순으로 걸어 둔다. 하나씩 모듈로 만들면 이 목록에서 빼고 제 분야로 옮긴다.
 *
 * 넣지 않은 것: 이미 모듈이 있는 것(정책자금 · 고용지원금 · 지원사업 · 연구소) · 기업인증으로 갈 것(벤처 · 메인비즈/이노비즈 · ISO) ·
 * 가능 여부만 보는 검토 · 점검(지원사업 · 스마트공장 · 수출 · 신용등급 · 리파이낸싱 · 주주간계약 · 세무조사 · 노무 점검 …).
 * 내용(기간 · 설명)은 상품표(`salesProposal.js` 기본 상품)를 그대로 읽는다 — 메뉴는 이름만 들고 있어 가볍다.
 */
export interface UpcomingProduct {
  /** 주소 /upcoming/{key} */
  key: string
  /** 메뉴 이름 */
  title: string
  /** 상품표 상품 이름(내용을 여기서 읽는다) */
  pkgName: string
}

const LIST: UpcomingProduct[] = [
  { key: 'gasugeum', title: '가수금 출자전환', pkgName: '가수금 출자전환 패키지' },
  { key: 'suspense', title: '가지급금 정리', pkgName: '가지급금 리스크 정리 패키지' },
  { key: 'dividend', title: '배당정책 · 차등배당', pkgName: '차등배당/배당정책 검토' },
  { key: 'corp-insure', title: '법인보험 · 대표 퇴직금 플랜', pkgName: '법인보험/대표 퇴직금 플랜 검토 패키지' },
  { key: 'incorporate', title: '법인전환(개인사업자)', pkgName: '개인사업자 법인전환 실무' },
  { key: 'retained', title: '미처분이익잉여금 정리', pkgName: '미처분이익잉여금 정리 전략' },
  { key: 'welfare-fund', title: '사내근로복지기금 설립', pkgName: '사내근로복지기금 설립 검토 패키지' },
  { key: 'stock-option', title: '성과보상 · 스톡옵션 제도', pkgName: '스톡옵션/성과보상제도 검토' },
  { key: 'profit-cancel', title: '이익소각 · 자기주식', pkgName: '이익소각 구조 검토 패키지' },
  { key: 'exec-pay', title: '임원보수 규정 정비', pkgName: '임원보수 규정 정비' },
  { key: 'exec-retire', title: '임원퇴직금 규정 정비', pkgName: '임원퇴직금 규정 정비 패키지' },
  { key: 'charter', title: '정관 정비', pkgName: '정관정비 패키지' },
  { key: 'stock-value', title: '주식가치평가', pkgName: '주식가치평가 패키지' },
  { key: 'job-invention', title: '직무발명보상제도 도입', pkgName: '직무발명보상제도 도입 검토' },
  { key: 'work-rules', title: '취업규칙 · 근로계약서 정비', pkgName: '근로계약서/취업규칙 점검' },
]

/** 가나다 순 */
export const UPCOMING_PRODUCTS: UpcomingProduct[] = [...LIST].sort((a, b) => a.title.localeCompare(b.title, 'ko'))

export const UPCOMING_PATH = '/upcoming'

export function upcomingProduct(key: string): UpcomingProduct | null {
  return UPCOMING_PRODUCTS.find((p) => p.key === key) ?? null
}
