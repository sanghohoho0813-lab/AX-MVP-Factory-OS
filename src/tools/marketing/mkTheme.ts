/**
 * 마케팅 · 브랜딩 색 값 (D-226) — 부품(mkKit.tsx)과 나눠 둔다(화면 새로고침이 부품 파일만 다시 그리게).
 * 도구 색 · 글 종류 · 상황마다 색 아이콘 표. 자세한 이유는 mkKit.tsx 머리말.
 */
import {
  Award,
  BadgeCheck,
  BarChart3,
  Building2,
  GalleryHorizontalEnd,
  HelpCircle,
  History,
  LayoutGrid,
  ListOrdered,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Phone,
  Quote,
  Sparkles,
  BadgePercent,
  CalendarHeart,
  CalendarX2,
  CheckCircle2,
  FileText,
  Gift,
  Heart,
  Images,
  MapPin,
  MessageCircle,
  MonitorPlay,
  PackagePlus,
  Search,
  Smartphone,
  Star,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ContentKind, SituationKey } from '../../services/contentStudio'
import type { BlockType } from '../../services/siteBuilder'

export type MkTone = 'violet' | 'fuchsia' | 'emerald' | 'teal' | 'green' | 'red' | 'rose' | 'sky' | 'indigo' | 'amber' | 'orange' | 'slate'

interface ToneClass {
  /** 아이콘 칩(연한 바탕 + 진한 아이콘) */
  icon: string
  /** 꽉 찬 바탕(흰 글자 또는 진한 글자 — 대비 4.5 이상) */
  solid: string
  /** 연한 바탕 */
  soft: string
  /** 테두리 */
  line: string
  /** 고른 칸 */
  on: string
  /** 마우스를 올린 칸 */
  hover: string
  /** 글자 */
  text: string
  /** 진한 글자(제목) */
  deep: string
}

// Tailwind 는 글자 그대로의 class 만 만든다 — 조합하지 않고 다 적어 둔다
// D-370 대표 '박스 색은 하나로' — 칸 · 테두리 · 고른 칸 · 글자는 뜻과 상관없이 같은 차분한 모양, 작은 아이콘 칸(icon)만 글 종류 색을 둔다
export const TONE: Record<MkTone, ToneClass> = {
  violet: { icon: 'bg-violet-100 text-violet-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  fuchsia: { icon: 'bg-fuchsia-100 text-fuchsia-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  emerald: { icon: 'bg-emerald-100 text-emerald-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  teal: { icon: 'bg-teal-100 text-teal-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  green: { icon: 'bg-green-100 text-green-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  red: { icon: 'bg-red-100 text-red-600', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  rose: { icon: 'bg-rose-100 text-rose-600', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  sky: { icon: 'bg-sky-100 text-sky-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  amber: { icon: 'bg-amber-100 text-amber-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  orange: { icon: 'bg-orange-100 text-orange-700', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
  slate: { icon: 'bg-slate-100 text-slate-600', solid: 'bg-brand-600 text-white', soft: 'bg-white', line: 'border-slate-200', on: 'border-brand-500 bg-white ring-2 ring-brand-200', hover: 'hover:border-brand-500', text: 'text-slate-700', deep: 'text-slate-900' },
}

/** 도구 머리 띠 — 흰 글자가 읽히는 진한 단계만 */
export const HERO: Record<'violet' | 'emerald' | 'red' | 'hub', string> = {
  violet: 'from-violet-700 via-violet-600 to-fuchsia-700',
  emerald: 'from-emerald-700 via-emerald-700 to-teal-700',
  red: 'from-red-600 via-red-600 to-rose-700',
  hub: 'from-indigo-700 via-violet-700 to-fuchsia-700',
}

/** 머리 띠 안 흰 단추 */
export const HERO_BTN = 'tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50'

/** 도구마다 큰 단추 — 테마 색 대신 도구 색 */
export const MK_PRIMARY: Record<'violet' | 'emerald' | 'sky', string> = {
  // D-370 큰 단추도 OS 기본 단추(테마 강조색)로 — 보라는 AI(LLM) 단추만. 이름(violet · emerald · sky)은 그대로 둔다
  violet: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) border border-brand-600 bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50',
  emerald: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) border border-brand-600 bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50',
  // D-228 다른 AI 도구에 맡기기(요청문 · 받은 글 점검) — 우리 AI 를 부르지 않으니 흰 단추
  sky: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
}

/** 고르는 칩(켜짐/꺼짐) */
export function mkChip(on: boolean, tone: MkTone = 'violet'): string {
  return `tap t-body min-h-11 rounded-full border px-4 font-semibold ${on ? `${TONE[tone].solid} border-transparent shadow-sm` : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`
}

/* ------------------------------------------------------------------ */
/* 글 종류 · 상황마다 색 아이콘                                            */
/* ------------------------------------------------------------------ */

export const KIND_STYLE: Record<ContentKind, { icon: LucideIcon; tone: MkTone }> = {
  keywords: { icon: Search, tone: 'sky' },
  blog: { icon: FileText, tone: 'green' },
  shorts: { icon: Smartphone, tone: 'rose' },
  video: { icon: MonitorPlay, tone: 'red' },
  cards: { icon: Images, tone: 'fuchsia' },
  kakao: { icon: MessageCircle, tone: 'amber' },
  place: { icon: MapPin, tone: 'teal' },
}

/** 글 칸 왼쪽 색 줄 */
export const KIND_ACCENT: Record<ContentKind, string> = {
  keywords: 'border-l-sky-400',
  blog: 'border-l-green-500',
  shorts: 'border-l-rose-400',
  video: 'border-l-red-500',
  cards: 'border-l-fuchsia-400',
  kakao: 'border-l-amber-400',
  place: 'border-l-teal-500',
}

export const SITUATION_STYLE: Record<SituationKey, { icon: LucideIcon; tone: MkTone }> = {
  open: { icon: Store, tone: 'emerald' },
  newItem: { icon: PackagePlus, tone: 'violet' },
  event: { icon: BadgePercent, tone: 'rose' },
  holiday: { icon: CalendarX2, tone: 'sky' },
  price: { icon: Gift, tone: 'amber' },
  move: { icon: Truck, tone: 'teal' },
  award: { icon: Award, tone: 'orange' },
  hiring: { icon: Users, tone: 'indigo' },
  review: { icon: Star, tone: 'amber' },
  season: { icon: CalendarHeart, tone: 'fuchsia' },
  caseDone: { icon: CheckCircle2, tone: 'green' },
  thanks: { icon: Heart, tone: 'rose' },
}

/** 묶음 탭 이름('카톡 · 블로그 · 카드뉴스' …)의 색 — 글 종류 색을 따른다 */
export function tabTone(tab: string): MkTone {
  if (tab.includes('카톡')) return 'amber'
  if (tab.includes('블로그')) return 'green'
  if (tab.includes('카드')) return 'fuchsia'
  if (tab.includes('짧은') || tab.includes('쇼츠')) return 'rose'
  if (tab.includes('영상')) return 'red'
  if (tab.includes('플레이스')) return 'teal'
  if (tab.includes('채용')) return 'indigo'
  return 'slate'
}


/** 홈페이지 블록마다 색 아이콘(블록 목록 · 더하기 창) */
export const BLOCK_STYLE: Record<BlockType, { icon: LucideIcon; tone: MkTone }> = {
  header: { icon: PanelTop, tone: 'slate' },
  hero: { icon: Sparkles, tone: 'violet' },
  about: { icon: Building2, tone: 'indigo' },
  services: { icon: LayoutGrid, tone: 'sky' },
  numbers: { icon: BarChart3, tone: 'orange' },
  certs: { icon: BadgeCheck, tone: 'emerald' },
  history: { icon: History, tone: 'amber' },
  process: { icon: ListOrdered, tone: 'teal' },
  faq: { icon: HelpCircle, tone: 'fuchsia' },
  cta: { icon: MousePointerClick, tone: 'rose' },
  contact: { icon: Phone, tone: 'green' },
  footer: { icon: PanelBottom, tone: 'slate' },
  gallery: { icon: GalleryHorizontalEnd, tone: 'sky' },
  reviews: { icon: Quote, tone: 'amber' },
  logos: { icon: Award, tone: 'indigo' },
}
