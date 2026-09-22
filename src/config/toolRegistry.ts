/**
 * 도구함 — 이 OS 안에 들어오는 '작은 OS·계산기' 목록 (D-86 · D-88).
 *
 * 세금 계산기처럼 고객 기록과 상관없이 혼자 도는 것들이 앞으로 계속 늘어난다.
 * 그때마다 사이드바를 다시 짜지 않도록 **여기 한 줄만 더한다**.
 *   - `status: 'live'`    — 지금 쓸 수 있다. 사이드바 도구함에도 올라간다.
 *   - `status: 'review'`  — 도입 검토중. 쓸 수는 있지만 사이드바에는 '도입 검토중' 한 줄로만 묶인다.
 *                            대표가 "이건 쓰겠다" 하면 'live' 로 바꾸는 것으로 끝.
 *   - `status: 'planned'` — 자리만 잡아 둔 것. 도구함 화면에 '아직 없다' 고 적어 두고, 누를 수 없다.
 *
 * 없는 기능을 있는 것처럼 보이게 하지 않는다 — 자리만 잡아 둔 것은 그렇게 적는다.
 * 규칙 계산이다. 어느 도구도 외부 API·LLM 을 부르지 않는다.
 */

import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, Briefcase, Calculator, FlaskConical, Landmark, LineChart, Sparkles, Users } from 'lucide-react'

export type ToolStatus = 'live' | 'review' | 'planned'

export interface ToolDefinition {
  key: string
  label: string
  /** 한 줄 설명 — 도구함 카드에 그대로 보인다 */
  desc: string
  /** 사이드바에 걸릴 때의 짧은 설명(툴팁). 없으면 설명 없이 걸린다 */
  navHint?: string
  /** 들어갈 주소. 아직 없는 것은 null */
  path: string | null
  icon: LucideIcon
  status: ToolStatus
  /** 어디서 가져왔는가 — 원본 저장소·브랜치. 도구함 카드 아래에 작게 적는다 */
  origin?: string
}

export const TOOLS: ToolDefinition[] = [
  {
    key: 'tax',
    label: '세금 계산기',
    desc: '대표이사 급여·퇴직급여·주식양수도·상속·가지급금 등 9종. 기업지원단 배포본과 같은 숫자입니다.',
    navHint: '급여·퇴직·주식·상속·가지급금 9종',
    path: '/tools/tax',
    icon: Calculator,
    status: 'live',
    origin: '기업지원단 배포 HTML',
  },
  {
    key: 'startup-tax',
    label: '창업감면 판정기',
    desc: '여덟 가지만 고르면 창업중소기업 세액감면 가능성을 네 단계로. 조특법·창업지원법·지방세 기준별 판정과 상담 질문까지.',
    navHint: '창업중소기업 세액감면 1분 판정',
    path: '/tools/startup-tax',
    icon: Sparkles,
    status: 'live',
    origin: 'startup-tax-checker',
  },
  {
    key: 'cretop',
    label: '크레탑 분석기',
    desc: '크레탑 기업종합보고서(PDF·붙여넣기)를 읽어 핵심 재무 15개·3개년 추이·재무비율 5영역·1차 미팅 포인트를 뽑습니다.',
    navHint: '크레탑 보고서 → 재무 진단·미팅 포인트',
    path: '/tools/cretop',
    icon: LineChart,
    status: 'live',
    origin: 'corp-consult-sales-os · cretop-engine',
  },
  {
    key: 'employment',
    label: '고용지원금 매니저',
    desc: '2026년 고용지원금 15종 — 채용 상황을 고르면 받을 수 있는 지원금을 가려내고, 입사일로 회차별 신청일과 급여·4대보험 부담을 계산합니다.',
    navHint: '지원금 15종 판정 · 회차 일정 · 급여 계산',
    path: '/tools/employment',
    icon: Users,
    status: 'live',
    origin: 'git-test · kind-cori (고용지원금 매니저 Pro)',
  },
  {
    key: 'labcare',
    label: '기업부설연구소 OS',
    desc: '설립 가능성 판정(인원·자격·물적요건) · 설립서류 체크리스트 · 월간 사후관리 위험도 · 세액공제 예상 · 안내문 11종.',
    navHint: '연구소 설립 판정 · 사후관리 · 세액공제',
    path: '/tools/labcare',
    icon: FlaskConical,
    status: 'live',
    origin: 'corp-consult-sales-os · LabCare 브랜치',
  },
  {
    key: 'policy-funding',
    label: '정책자금 진단',
    desc: '8문항 빠른 진단으로 추천 기관 TOP3·세부 트랙·리스크·필요 서류·90일 로드맵·상담 대본을 뽑습니다. 64건 사례 지식 기반.',
    navHint: '기관 추천 · 서류 · 로드맵 · 상담 대본',
    path: '/tools/policy-funding',
    icon: Landmark,
    status: 'live',
    origin: 'policy-funding-os',
  },
  {
    key: 'sales-kit',
    label: '영업 도구 모음',
    desc: '기업컨설팅 OS 에서 골라 온 것 — 1·2·3차 미팅 대본, 절세전략 17종 추천, 컨설팅 상품 가격표 40종, 제안 주제 34종, 고객 플래그 17종.',
    navHint: '미팅 대본 · 전략 추천 · 상품 가격표',
    path: '/tools/sales-kit',
    icon: Briefcase,
    status: 'review',
    origin: 'corp-consult-sales-os · main (법인컨설팅 세일즈 OS)',
  },
  {
    key: 'cert-os',
    label: '기업인증 OS',
    desc: '대표가 따로 만들어 둔 것입니다. 여기로 옮기면 이 자리에 붙습니다 — 아직 없습니다.',
    path: null,
    icon: BadgeCheck,
    status: 'planned',
  },
]

/** 지금 쓸 수 있는 것만 (사이드바 도구함이 이것으로 만들어진다) */
export function liveTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'live')
}

/** 도입 검토중 — 화면은 있지만 사이드바에는 '도입 검토중' 한 줄로만 */
export function reviewTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'review')
}

export function plannedTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'planned')
}

export function toolOf(key: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.key === key)
}

/** 도입 검토중 목차가 가리키는 주소 */
export const REVIEW_HUB_PATH = '/tools/review'
