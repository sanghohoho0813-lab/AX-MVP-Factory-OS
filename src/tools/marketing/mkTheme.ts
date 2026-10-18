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
export const TONE: Record<MkTone, ToneClass> = {
  violet: { icon: 'bg-violet-100 text-violet-700', solid: 'bg-violet-600 text-white', soft: 'bg-violet-50', line: 'border-violet-200', on: 'border-violet-500 bg-violet-50 ring-2 ring-violet-200', hover: 'hover:border-violet-400', text: 'text-violet-700', deep: 'text-violet-900' },
  fuchsia: { icon: 'bg-fuchsia-100 text-fuchsia-700', solid: 'bg-fuchsia-700 text-white', soft: 'bg-fuchsia-50', line: 'border-fuchsia-200', on: 'border-fuchsia-500 bg-fuchsia-50 ring-2 ring-fuchsia-200', hover: 'hover:border-fuchsia-400', text: 'text-fuchsia-700', deep: 'text-fuchsia-900' },
  emerald: { icon: 'bg-emerald-100 text-emerald-700', solid: 'bg-emerald-700 text-white', soft: 'bg-emerald-50', line: 'border-emerald-200', on: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200', hover: 'hover:border-emerald-400', text: 'text-emerald-700', deep: 'text-emerald-900' },
  teal: { icon: 'bg-teal-100 text-teal-700', solid: 'bg-teal-700 text-white', soft: 'bg-teal-50', line: 'border-teal-200', on: 'border-teal-500 bg-teal-50 ring-2 ring-teal-200', hover: 'hover:border-teal-400', text: 'text-teal-700', deep: 'text-teal-900' },
  green: { icon: 'bg-green-100 text-green-700', solid: 'bg-green-700 text-white', soft: 'bg-green-50', line: 'border-green-200', on: 'border-green-500 bg-green-50 ring-2 ring-green-200', hover: 'hover:border-green-400', text: 'text-green-700', deep: 'text-green-900' },
  red: { icon: 'bg-red-100 text-red-600', solid: 'bg-red-600 text-white', soft: 'bg-red-50', line: 'border-red-200', on: 'border-red-500 bg-red-50 ring-2 ring-red-200', hover: 'hover:border-red-400', text: 'text-red-700', deep: 'text-red-900' },
  rose: { icon: 'bg-rose-100 text-rose-600', solid: 'bg-rose-600 text-white', soft: 'bg-rose-50', line: 'border-rose-200', on: 'border-rose-500 bg-rose-50 ring-2 ring-rose-200', hover: 'hover:border-rose-400', text: 'text-rose-700', deep: 'text-rose-900' },
  sky: { icon: 'bg-sky-100 text-sky-700', solid: 'bg-sky-700 text-white', soft: 'bg-sky-50', line: 'border-sky-200', on: 'border-sky-500 bg-sky-50 ring-2 ring-sky-200', hover: 'hover:border-sky-400', text: 'text-sky-700', deep: 'text-sky-900' },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', solid: 'bg-indigo-600 text-white', soft: 'bg-indigo-50', line: 'border-indigo-200', on: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200', hover: 'hover:border-indigo-400', text: 'text-indigo-700', deep: 'text-indigo-900' },
  amber: { icon: 'bg-amber-100 text-amber-700', solid: 'bg-amber-400 text-amber-950', soft: 'bg-amber-50', line: 'border-amber-200', on: 'border-amber-500 bg-amber-50 ring-2 ring-amber-200', hover: 'hover:border-amber-400', text: 'text-amber-700', deep: 'text-amber-900' },
  orange: { icon: 'bg-orange-100 text-orange-700', solid: 'bg-orange-700 text-white', soft: 'bg-orange-50', line: 'border-orange-200', on: 'border-orange-500 bg-orange-50 ring-2 ring-orange-200', hover: 'hover:border-orange-400', text: 'text-orange-700', deep: 'text-orange-900' },
  slate: { icon: 'bg-slate-100 text-slate-600', solid: 'bg-slate-700 text-white', soft: 'bg-slate-50', line: 'border-slate-200', on: 'border-slate-500 bg-slate-50 ring-2 ring-slate-200', hover: 'hover:border-slate-400', text: 'text-slate-700', deep: 'text-slate-900' },
}

/** 도구 머리 띠 — 흰 글자가 읽히는 진한 단계만 */
export const HERO: Record<'violet' | 'emerald' | 'red' | 'hub', string> = {
  violet: 'from-violet-700 via-violet-600 to-fuchsia-700',
  emerald: 'from-emerald-700 via-emerald-700 to-teal-700',
  red: 'from-red-600 via-red-600 to-rose-700',
  hub: 'from-indigo-700 via-violet-700 to-fuchsia-700',
}

/** 머리 띠 안 흰 단추 */
export const HERO_BTN = 'tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-control) bg-white px-3 font-semibold text-slate-900 shadow-sm hover:bg-white/90'

/** 도구마다 큰 단추 — 테마 색 대신 도구 색 */
export const MK_PRIMARY: Record<'violet' | 'emerald' | 'sky', string> = {
  violet: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) bg-gradient-to-r from-violet-600 to-fuchsia-700 px-4 font-semibold text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-800 disabled:cursor-not-allowed disabled:opacity-50',
  emerald: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) bg-gradient-to-r from-emerald-700 to-teal-700 px-4 font-semibold text-white shadow-sm hover:from-emerald-800 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-50',
  // D-228 다른 AI 도구에 맡기기(요청문 · 받은 글 점검)
  sky: 'tap t-body inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) bg-gradient-to-r from-sky-700 to-blue-700 px-4 font-semibold text-white shadow-sm hover:from-sky-800 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-50',
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
