/**
 * D-282 기능별 아이콘 색 — "어디인가" 갈래(화면 규칙 §8-1)를 메뉴 아이콘에서 바로가기 타일 · 화면 머리 칩 · KPI 칩까지 넓힌다.
 *
 * 대표 지시(UI/UX 마스터): 고객 파랑 · AI 전략실 보라 · 특허·벤처 호박 · 정책자금 초록 · 영업 주황 · 마케팅 산호 · 일정 청록.
 *  - 색은 **아이콘 칸(타일)에만** 쓴다. 카드 바탕 · 글자 · 단추는 칠하지 않는다(§2 · D-57 그대로 — 급한 것은 빨강 · 주황 선으로만).
 *  - 테마와 무관하게 고정한다(메뉴 아이콘 색처럼). 테마를 바꿔도 "보라 = AI 전략실" 은 흔들리지 않는다.
 *  - 클래스 이름은 통째로 적는다 — 이어 붙이면 Tailwind 가 만들지 않는다(D-26).
 */
export type FeatureTone = 'indigo' | 'teal' | 'blue' | 'purple' | 'amber' | 'orange' | 'coral' | 'green' | 'cyan' | 'rose' | 'slate'

interface ToneClass {
  /** 밝은 바탕 위 아이콘 칸 — 옅은 바탕 + 진한 아이콘 */
  tile: string
  /** 밝은 바탕 위 아이콘 색만(휴대폰 아래 메뉴) */
  icon: string
  /** 옅은 바탕만(휴대폰 아래 메뉴 고른 칸) */
  soft: string
  /** 어두운 메뉴 위 아이콘 칸 바탕 */
  darkTile: string
  /** 어두운 메뉴 위 아이콘 색 */
  darkIcon: string
  /** 손을 올렸을 때 테두리(바로가기 타일) */
  hoverRing: string
  /** 어두운 메뉴 묶음 머리의 작은 띠 */
  bar: string
}

const TONE: Record<FeatureTone, ToneClass> = {
  indigo: { tile: 'bg-indigo-50 text-indigo-600', icon: 'text-indigo-600', soft: 'bg-indigo-50', darkTile: 'bg-indigo-400/15', darkIcon: 'text-indigo-300', hoverRing: 'hover:border-indigo-300', bar: 'bg-indigo-400' },
  teal: { tile: 'bg-teal-50 text-teal-600', icon: 'text-teal-600', soft: 'bg-teal-50', darkTile: 'bg-teal-400/15', darkIcon: 'text-teal-300', hoverRing: 'hover:border-teal-300', bar: 'bg-teal-400' },
  blue: { tile: 'bg-blue-50 text-blue-600', icon: 'text-blue-600', soft: 'bg-blue-50', darkTile: 'bg-blue-400/15', darkIcon: 'text-blue-300', hoverRing: 'hover:border-blue-300', bar: 'bg-blue-400' },
  purple: { tile: 'bg-violet-50 text-violet-600', icon: 'text-violet-600', soft: 'bg-violet-50', darkTile: 'bg-violet-400/15', darkIcon: 'text-violet-300', hoverRing: 'hover:border-violet-300', bar: 'bg-violet-400' },
  amber: { tile: 'bg-amber-50 text-amber-600', icon: 'text-amber-600', soft: 'bg-amber-50', darkTile: 'bg-amber-400/15', darkIcon: 'text-amber-300', hoverRing: 'hover:border-amber-300', bar: 'bg-amber-400' },
  orange: { tile: 'bg-orange-50 text-orange-600', icon: 'text-orange-600', soft: 'bg-orange-50', darkTile: 'bg-orange-400/15', darkIcon: 'text-orange-300', hoverRing: 'hover:border-orange-300', bar: 'bg-orange-400' },
  coral: { tile: 'bg-coral-50 text-coral-600', icon: 'text-coral-600', soft: 'bg-coral-50', darkTile: 'bg-coral-400/15', darkIcon: 'text-coral-300', hoverRing: 'hover:border-coral-300', bar: 'bg-coral-400' },
  green: { tile: 'bg-emerald-50 text-emerald-600', icon: 'text-emerald-600', soft: 'bg-emerald-50', darkTile: 'bg-emerald-400/15', darkIcon: 'text-emerald-300', hoverRing: 'hover:border-emerald-300', bar: 'bg-emerald-400' },
  cyan: { tile: 'bg-cyan-50 text-cyan-700', icon: 'text-cyan-700', soft: 'bg-cyan-50', darkTile: 'bg-cyan-400/15', darkIcon: 'text-cyan-300', hoverRing: 'hover:border-cyan-300', bar: 'bg-cyan-400' },
  rose: { tile: 'bg-rose-50 text-rose-600', icon: 'text-rose-600', soft: 'bg-rose-50', darkTile: 'bg-rose-400/15', darkIcon: 'text-rose-300', hoverRing: 'hover:border-rose-300', bar: 'bg-rose-400' },
  slate: { tile: 'bg-slate-100 text-slate-600', icon: 'text-slate-600', soft: 'bg-slate-100', darkTile: 'bg-white/5', darkIcon: 'text-navy-300', hoverRing: 'hover:border-slate-300', bar: 'bg-navy-400' },
}

export function toneClass(tone: FeatureTone): ToneClass {
  return TONE[tone]
}

/**
 * 메뉴 줄(moduleRegistry key) → 기능 색. 여기 없는 줄은 회색(slate) — 자주 안 여는 것 · 설정 · 이 시스템.
 * 분야 줄(cat-*)은 제품 카탈로그 모듈 key 로 정한다(기업성장 = 정책자금 초록).
 */
const MODULE_TONE: Record<string, FeatureTone> = {
  today: 'indigo',
  decide: 'indigo',
  calendar: 'teal',
  'client-ops': 'blue',
  'ai-workspace': 'purple',
  'patent-venture': 'amber',
  inbox: 'rose',
  sales: 'orange',
  agents: 'orange',
  money: 'orange',
  'first-meeting': 'orange',
  marketing: 'coral',
  'cat-growth': 'green',
  'cat-gov-support': 'green',
  'cat-tax-finance': 'cyan',
  // 잘 안 쓰는 기능 묶음 — 같은 갈래 색(특허·MVP 호박 · AX 보라 · 웹 · 홍보 산호)
  'cat-tech-biz': 'amber',
  'cat-ax-studio': 'purple',
  'cat-web-studio': 'coral',
}

export function moduleTone(key: string): FeatureTone {
  return MODULE_TONE[key] ?? 'slate'
}

/** 메뉴 묶음 머리 띠 — 묶음 안 첫 기능과 같은 색(오늘 · 고객 · 영업). 나머지는 회색 */
const GROUP_TONE: Record<string, FeatureTone> = { today: 'indigo', clients: 'blue', sales: 'orange' }

export function groupTone(key: string): FeatureTone {
  return GROUP_TONE[key] ?? 'slate'
}

/**
 * 오늘 화면 · 휴대폰 '전체 기능' 의 바로가기 — 메뉴 표(moduleRegistry)의 줄을 가리킨다.
 * 보이는지 · 잠겼는지는 메뉴와 같은 규칙으로 판정한다(Pilot · 기능 권한 · 요금제) — 바로가기만 따로 열어 주는 길은 없다.
 * 위에서부터 7개 + 맨 끝 '전체 도구'. Pilot 처럼 대표 전용 줄이 빠지면 아래 예비 줄이 그 자리를 채운다.
 */
export interface LauncherEntry {
  /** moduleRegistry MODULES 의 key */
  module: string
  label: string
  /** 휴대폰 큰 아이콘 칸에 쓰는 짧은 이름(칸이 70~80px — 긴 이름은 '지원사/업' 처럼 낱말이 쪼개진다). 읽는 기계에는 label 그대로 */
  short: string
  sub: string
}

export const LAUNCHER_ENTRIES: LauncherEntry[] = [
  { module: 'client-ops', label: '고객 관리', short: '고객 관리', sub: '업체 기록 · 서류 · 수금' },
  { module: 'ai-workspace', label: 'AI 전략실', short: 'AI 전략실', sub: '업체별 분석 · 제안' },
  { module: 'patent-venture', label: '특허 · 벤처', short: '특허·벤처', sub: '명세서 · 사업계획서' },
  { module: 'cat-growth', label: '자금 · 지원사업', short: '자금·지원', sub: '정책자금 · 고용 · 공고' },
  { module: 'sales', label: '영업 관리', short: '영업', sub: '잠재고객 → 계약' },
  { module: 'marketing', label: '마케팅 · 브랜딩', short: '마케팅', sub: '이번 주 콘텐츠' },
  { module: 'calendar', label: '일정', short: '일정', sub: '달력 · 오늘 기록' },
  // 예비 — 위 줄이 권한으로 빠졌을 때 채운다
  { module: 'money', label: '매출 · 비용', short: '매출·비용', sub: '들어온 돈 · 결제일' },
  { module: 'decide', label: '확인할 것', short: '확인할 것', sub: '맞다 · 아니다만' },
  { module: 'cat-tax-finance', label: '절세 · 재무', short: '절세·재무', sub: '세금 · 창업감면' },
]

/** 맨 끝 칸 — 전문 모듈 전체(모든 사람에게 있다) */
export const LAUNCHER_ALL: LauncherEntry = { module: 'tools', label: '전체 도구', short: '전체 도구', sub: '모듈 · 기능 전부' }

export const LAUNCHER_SLOTS = 7
