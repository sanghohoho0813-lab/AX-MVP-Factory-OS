import type { GrantCategory } from '../../services/grants/grantMatch'

/** D-168: 갈래마다 색 — 흑백 목록이 한눈에 갈린다 */
export const CATEGORY_TONE: Record<GrantCategory, { pill: string; on: string; dot: string; bar: string }> = {
  money: { pill: 'border-emerald-200 bg-emerald-50 text-emerald-800', on: 'border-emerald-600 bg-emerald-600 text-white', dot: 'bg-emerald-500', bar: 'before:bg-emerald-400' },
  hr: { pill: 'border-sky-200 bg-sky-50 text-sky-800', on: 'border-sky-600 bg-sky-600 text-white', dot: 'bg-sky-500', bar: 'before:bg-sky-400' },
  marketing: { pill: 'border-pink-200 bg-pink-50 text-pink-800', on: 'border-pink-600 bg-pink-600 text-white', dot: 'bg-pink-500', bar: 'before:bg-pink-400' },
  rnd: { pill: 'border-violet-200 bg-violet-50 text-violet-800', on: 'border-violet-600 bg-violet-600 text-white', dot: 'bg-violet-500', bar: 'before:bg-violet-400' },
  export: { pill: 'border-indigo-200 bg-indigo-50 text-indigo-800', on: 'border-indigo-600 bg-indigo-600 text-white', dot: 'bg-indigo-500', bar: 'before:bg-indigo-400' },
  startup: { pill: 'border-orange-200 bg-orange-50 text-orange-800', on: 'border-orange-600 bg-orange-600 text-white', dot: 'bg-orange-500', bar: 'before:bg-orange-400' },
  etc: { pill: 'border-slate-200 bg-slate-50 text-slate-700', on: 'border-slate-700 bg-slate-700 text-white', dot: 'bg-slate-400', bar: 'before:bg-slate-300' },
}
