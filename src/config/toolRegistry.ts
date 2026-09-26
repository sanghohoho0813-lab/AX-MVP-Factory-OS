/**
 * 도구함 — 이 OS 안에 들어오는 '작은 OS·계산기' 목록 (D-86 · D-88).
 *
 * 세금 계산기처럼 고객 기록과 상관없이 혼자 도는 것들이 앞으로 계속 늘어난다.
 * 그때마다 사이드바를 다시 짜지 않도록 **여기 한 줄만 더한다**.
 *   - `status: 'live'`    — 지금 쓸 수 있다. 사이드바 도구함에도 올라간다.
 *   - `status: 'review'`  — 도입 검토중. 쓸 수는 있지만 사이드바에는 '도입 검토중' 한 줄로만 묶인다.
 *                            대표가 "이건 쓰겠다" 하면 'live' 로 바꾸는 것으로 끝.
 *   - `status: 'planned'` — 자리만 잡아 둔 것. 도구함 화면에 '아직 없다' 고 적어 두고, 누를 수 없다.
 *   - `status: 'moved'`   — OS 안 다른 곳으로 옮겨 간 것(D-118). 목차 · 검색에서 빠지고, 주소는 예전 기록 보기용으로 남는다.
 *                            `movedTo` 가 옮겨 간 곳 — 그 화면의 메뉴 줄이 이 주소도 맡는다.
 *
 * 없는 기능을 있는 것처럼 보이게 하지 않는다 — 자리만 잡아 둔 것은 그렇게 적는다.
 * 규칙 계산이다. 어느 도구도 외부 API·LLM 을 부르지 않는다.
 */

import type { LucideIcon } from 'lucide-react'
import type { DocumentKey } from '../types/clientOps'
import type { NavAccent } from './moduleRegistry'
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Gauge,
  Handshake,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Megaphone,
  Notebook,
  PieChart,
  Scale,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'

export type ToolStatus = 'live' | 'review' | 'planned' | 'moved'

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
  /** status 'moved' 일 때 옮겨 간 곳 */
  movedTo?: { path: string; label: string }
  /** 어디서 가져왔는가 — 원본 저장소·브랜치. 도구함 카드 아래에 작게 적는다 */
  origin?: string
  /**
   * 검색에서 이 도구를 부르는 다른 말 (D-89).
   * 대표는 "부채비율" 을 찾지 "크레탑 분석기" 를 찾지 않는다. 이름에 없는 말을 여기 적어 둔다.
   */
  keywords?: string
  /**
   * 이 도구를 제대로 돌리려면 **꼭 있어야 하는** 업체 서류 (D-90).
   * 없으면 업체 화면에서 빨갛게 이름을 적어 알려 준다. 도구 자체는 막지 않는다 —
   * 손으로 붙여넣어 쓰는 길이 늘 있기 때문이다.
   */
  requiredDocs?: DocumentKey[]
  /** 있으면 더 정확해지는 서류 — 없어도 경고하지 않고 '있으면 좋음' 으로만 적는다 */
  recommendedDocs?: DocumentKey[]
  /**
   * 모듈 안의 화면들 (D-91). 원본 OS 의 왼쪽 목차를 그대로 옮긴 것.
   * 있으면 도구 화면에 **2단 목차**가 선다 — 넓은 화면은 왼쪽 한 칸, 휴대폰은 모듈 햄버거.
   * 주소는 `/tools/<key>/<section>` 이다. 첫 화면이 기본이다.
   */
  sections?: ModuleSection[]
}

/** 모듈 안의 화면 하나 */
export interface ModuleSection {
  /** 주소 조각 — `/tools/employment/dashboard` 의 `dashboard` */
  key: string
  /** 목차에 보일 이름 */
  label: string
  icon: LucideIcon
  /** 목차에서 묶는 이름 (없으면 묶지 않는다) */
  group?: string
  /** 한 줄 설명 — 목차 툴팁·모듈 홈 카드에 쓴다 */
  hint?: string
  /**
   * 목차 아이콘 색 (D-92). 적지 않으면 묶음(group) 색을 따른다 — 같은 묶음은 같은 색.
   * 묶음 제목 없이 색만 나눌 때(화면이 몇 개 안 되는 모듈) 쓴다.
   */
  accent?: NavAccent
}

/**
 * 목차 묶음 → 색 (D-92). OS 왼쪽 메뉴와 같은 색 8가지를 쓴다.
 * 모든 모듈이 같은 표를 본다 — '고객' 은 어느 모듈에서든 같은 색, '설정' 은 늘 회색.
 * 한 모듈 안에서는 묶음끼리 겹치지 않게 골랐다.
 */
export const SECTION_GROUP_ACCENT: Record<string, NavAccent> = {
  판정: 'ai',
  설립: 'ai',
  계산: 'revenue',
  성과: 'revenue',
  '계약·성과': 'revenue',
  고객: 'ops',
  '미팅·제안': 'customer',
  사후관리: 'evidence',
  자료: 'evidence',
  설정: 'system',
}

/** 목차 한 줄의 색 — 직접 적은 색 → 묶음 색 → 첫 묶음(한눈에 보기) 파랑 */
export function sectionAccent(section: ModuleSection): NavAccent {
  if (section.accent) return section.accent
  if (section.group && SECTION_GROUP_ACCENT[section.group]) return SECTION_GROUP_ACCENT[section.group]
  return 'overview'
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
    keywords: '계산기 퇴직금 퇴직소득 상속 증여 가지급금 주식 양수도 급여 세금',
    recommendedDocs: ['corporateRegistry'],
    sections: [
      { key: 'calculators', label: '계산기 9종', icon: Calculator, hint: '급여·퇴직·주식·상속·가지급금' },
    ],
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
    keywords: '창업 감면 세액감면 청년창업 과밀억제권역 조특법 창업중소기업',
    requiredDocs: ['businessRegistration'],
    recommendedDocs: ['corporateRegistry'],
    sections: [
      { key: 'judge', label: '1분 판정', icon: Target, hint: '여덟 가지로 감면 가능성 판정' },
      { key: 'report', label: '판정 결과서', icon: FileText, accent: 'customer', hint: '상담용 결과서 인쇄·저장' },
    ],
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
    keywords: '재무제표 신용평가 부채비율 유동비율 이자보상배수 기업보고서 재무분석',
    requiredDocs: ['cretopReport'],
    recommendedDocs: ['financialStatements'],
    sections: [
      { key: 'analyze', label: '보고서 분석', icon: LineChart, hint: 'PDF·붙여넣기 → 핵심 재무·미팅 포인트' },
      { key: 'core-check', label: '핵심지표 검수', icon: ClipboardCheck, accent: 'evidence', hint: '뽑아낸 숫자를 줄 단위로 검수' },
      { key: 'extractor', label: '숫자 추출기', icon: FileSpreadsheet, accent: 'evidence', hint: '표 텍스트에서 숫자만 골라내기' },
    ],
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
    keywords: '지원금 장려금 채용 청년 고용보험 명부 엑셀 4대보험 일자리도약',
    requiredDocs: ['payrollRoster'],
    recommendedDocs: ['businessRegistration'],
    sections: [
      { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, hint: '이번 달 신청 가능·지연·서류·수령 한눈에' },
      { key: 'companies', label: '업체 관리', icon: Building2, hint: '업체별 직원·회차·서류·수수료·업무 일지' },
      { key: 'board', label: '진행 보드', icon: ClipboardList, hint: '준비중 → 최종 지급까지 7단계' },
      { key: 'diagnosis', label: '채용 진단', icon: Target, group: '판정', hint: '채용 조건으로 가능한 지원금 가려내기' },
      { key: 'roster', label: '4대보험 명부 진단', icon: FileSpreadsheet, group: '판정', hint: '명부 파일로 직원별 후보 1차 검토' },
      { key: 'schedule', label: '회차 일정', icon: CalendarCheck, group: '계산', hint: '입사일로 회차별 신청일·D-day' },
      { key: 'wage', label: '급여 계산기', icon: Calculator, group: '계산', hint: '실수령액·사업주 부담·최저임금 판정' },
      { key: 'simulator', label: '수령액 시뮬레이터', icon: TrendingUp, group: '계산', hint: '인원×입사일로 월별 현금흐름' },
      { key: 'programs', label: '지원금 관리', icon: Settings2, group: '설정', hint: '지원금 15종 켜기·끄기·회차 편집' },
      { key: 'settings', label: '설정·백업', icon: Wrench, group: '설정', hint: '백업 내보내기·불러오기' },
    ],
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
    keywords: '연구소 부설연구소 기업부설연구소 연구전담 세액공제 활동조사 변경신고',
    requiredDocs: ['businessRegistration'],
    recommendedDocs: ['corporateRegistry'],
    sections: [
      { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, hint: '오늘 할 일·설립 진행·연구노트·변경 D-day' },
      { key: 'tasks', label: '오늘 할 일', icon: ListChecks, hint: '서류·노트·변경신고·리포트를 한 줄로' },
      { key: 'clients', label: '연구소 고객사', icon: Building2, hint: '연구소 관점의 업체 현황' },
      { key: 'assessment', label: '설립 가능성 체크', icon: ClipboardCheck, group: '설립', hint: '인원·자격·물적요건 판정' },
      { key: 'setup-docs', label: '설립서류 관리', icon: FileText, group: '설립', hint: '서류 26종 체크 + 요청문·프롬프트' },
      { key: 'org-diagram', label: '조직도·도면', icon: Gauge, group: '설립', hint: '조직도 SVG · 도면 편집기 · 촬영 가이드' },
      { key: 'notes', label: '연구노트', icon: Notebook, group: '사후관리', hint: '월별 활동 → 노트 초안 → 보강' },
      { key: 'changes', label: '변경사항 관리', icon: CalendarCheck, group: '사후관리', hint: '발생일+30일 신고기한·확인주기' },
      { key: 'survey', label: '활동조사 관리', icon: ClipboardList, group: '사후관리', hint: '연도별 제출 상태·이력' },
      { key: 'check', label: '월간 점검', icon: ListChecks, group: '사후관리', hint: '8문항 점검 → 위험도' },
      { key: 'inspection', label: '현장조사 대비', icon: ClipboardCheck, group: '사후관리', hint: '사람·공간·활동 12항목' },
      { key: 'tax', label: '세액공제', icon: Wallet, group: '성과', hint: '연구·인력개발비 세액공제 예상' },
      { key: 'reports', label: '고객 리포트', icon: FileText, group: '성과', hint: '월간·상세·절세·방문용 4종' },
      { key: 'resources', label: '안내문·자료실', icon: Megaphone, group: '성과', hint: '템플릿 11종' },
      { key: 'settings', label: '설정·백업', icon: Wrench, group: '설정', hint: '백업 내보내기·불러오기' },
    ],
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
    keywords: '정책자금 융자 보증 기술보증 신용보증 중진공 소진공 대출 자금',
    requiredDocs: ['businessRegistration', 'financialStatements'],
    recommendedDocs: ['smeCertificate', 'corporateRegistry', 'healthInsurance'],
    sections: [
      { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, hint: '상담 단계별 현황·오늘 할 일' },
      { key: 'diagnosis', label: '진단하기', icon: Target, accent: 'ai', hint: '8문항 빠른 진단 + 심층 진단' },
      { key: 'customers', label: '상담 고객 관리', icon: Building2, accent: 'ops', hint: '단계·다음 액션·체크리스트' },
      { key: 'report', label: '인쇄 리포트', icon: FileText, accent: 'customer', hint: '대표님 한 페이지 요약 + 11섹션' },
    ],
  },
  {
    key: 'sales-kit',
    label: '영업 도구 모음',
    desc: '기업컨설팅 OS 에서 골라 온 것 — 1·2·3차 미팅 대본, 절세전략 17종 추천, 컨설팅 상품 가격표 40종, 제안 주제 34종, 고객 플래그 17종.',
    navHint: '미팅 대본 · 전략 추천 · 상품 가격표',
    path: '/tools/sales-kit',
    icon: Briefcase,
    // D-118: 영업 관리(D-114~117)로 다 옮겼다 — 목차에서 내리고 예전 기록 보기용으로만 남긴다
    status: 'moved',
    movedTo: { path: '/sales/board', label: '영업 › 영업 관리' },
    origin: 'corp-consult-sales-os · main (법인컨설팅 세일즈 OS)',
    keywords: '영업 미팅 대본 상담 전략 가격표 제안 컨설팅 상품',
    recommendedDocs: ['cretopReport'],
    sections: [
      { key: 'briefing', label: '오늘의 브리핑', icon: LayoutDashboard, hint: '업무 흐름·할 일·KPI' },
      { key: 'prospecting', label: '신규 고객 발굴', icon: Target, group: '고객', hint: '리드 점수·공략 순서·콜드콜 대본' },
      { key: 'companies', label: '고객사 관리', icon: Building2, group: '고객', hint: '상담 개시·계약 고객사' },
      { key: 'followup', label: '다음 연락 관리', icon: CalendarCheck, group: '고객', hint: '오늘·지연·예정 연락' },
      { key: 'meeting', label: '미팅 준비', icon: Handshake, group: '미팅·제안', hint: '1·2·3차 미팅 대본' },
      { key: 'reports', label: '리포트·제안서', icon: FileText, group: '미팅·제안', hint: '방문용 리포트·견적·제안서' },
      { key: 'packages', label: '컨설팅 상품', icon: Wallet, group: '미팅·제안', hint: '상품 40종 가격표·제안' },
      { key: 'pipeline', label: '영업 진행 현황', icon: ClipboardList, group: '계약·성과', hint: '6단계 파이프라인' },
      { key: 'analytics', label: '성과 분석', icon: PieChart, group: '계약·성과', hint: '퍼널·추이·상품별·CSV' },
      { key: 'content', label: '콘텐츠 전략', icon: Megaphone, group: '자료', hint: '주제 → 채널별 문구' },
      { key: 'education', label: '교육 아카이브', icon: Notebook, group: '자료', hint: '교육 기록 → 상담 활용' },
      { key: 'strategies', label: '절세전략', icon: Sparkles, group: '자료', hint: '절세전략 라이브러리' },
      { key: 'updates', label: '법령·공고', icon: Scale, group: '자료', hint: '법령 입력 → 영향 고객' },
      { key: 'settings', label: '설정·백업', icon: Wrench, group: '설정', hint: '백업·샘플·표시 설정' },
    ],
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

/** 다른 곳으로 옮겨 간 것 (D-118) */
export function movedTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'moved')
}

export function plannedTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.status === 'planned')
}

export function toolOf(key: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.key === key)
}

/**
 * 전역 검색(Ctrl+K)에서 도구 찾기 (D-89).
 * 쓸 수 있는 것과 검토중인 것만 — 자리만 잡아 둔 것은 눌러도 갈 곳이 없으므로 나오지 않는다.
 */
export function searchTools(query: string): ToolDefinition[] {
  const usable = TOOLS.filter((t) => t.path !== null && t.status !== 'planned' && t.status !== 'moved')
  const q = query.trim().toLowerCase()
  if (!q) return usable
  return usable.filter((t) =>
    `${t.label} ${t.desc} ${t.navHint ?? ''} ${t.keywords ?? ''} ${t.key} ${t.origin ?? ''}`.toLowerCase().includes(q),
  )
}

/** 이 서류를 쓰는 도구들 (서류함에서 "왜 필요한지" 에 함께 적는다, D-90) */
export function toolsNeeding(doc: DocumentKey): ToolDefinition[] {
  return TOOLS.filter((t) => t.status !== 'planned' && t.status !== 'moved' && (t.requiredDocs ?? []).includes(doc))
}

/** 도구가 쓰는 서류 전부 (필요 + 있으면 좋음) */
export function toolDocs(tool: ToolDefinition): DocumentKey[] {
  return [...(tool.requiredDocs ?? []), ...(tool.recommendedDocs ?? [])]
}

/** 도입 검토중 목차가 가리키는 주소 */
export const REVIEW_HUB_PATH = '/tools/review'
