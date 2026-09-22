/**
 * 표시·입력 정리 함수 — 원본(SubsidyApp.jsx 33~35, 48~53 줄) 그대로.
 */

import { MAX_MONEY } from './constants'
import type { Program } from './programs'

export function fMan(n: number | null | undefined): string {
  const v = Math.abs(n || 0)
  return v >= 10000 ? Math.round((n || 0) / 10000).toLocaleString() + '만 원' : (n || 0).toLocaleString() + '원'
}

export function fManS(n: number | null | undefined): string {
  const v = Math.abs(n || 0)
  return v >= 10000 ? Math.round((n || 0) / 10000) + '만' : String(n || 0)
}

export function fProgramAmt(p: Pick<Program, 'rounds' | 'totalAmount'>): string {
  const r = p.rounds || []
  if (r.length === 1 && (r[0].label || '').indexOf('월') >= 0) {
    return '월 최대 ' + fMan(r[0].amount)
  }
  return '1인당 최대 ' + fMan(p.totalAmount || 0)
}

export function fmtBizNo(v: string | null | undefined): string {
  const d = (v || '').replace(/[^0-9]/g, '').substring(0, 10)
  if (d.length < 4) return d
  if (d.length < 6) return d.substring(0, 3) + '-' + d.substring(3)
  return d.substring(0, 3) + '-' + d.substring(3, 5) + '-' + d.substring(5)
}

export function fmtPhone(v: string | null | undefined): string {
  const d = (v || '').replace(/[^0-9]/g, '').substring(0, 11)
  if (d.length < 3) return d
  if (d.startsWith('02')) {
    if (d.length < 6) return d.substring(0, 2) + '-' + d.substring(2)
    if (d.length < 10) return d.substring(0, 2) + '-' + d.substring(2, 5) + '-' + d.substring(5)
    return d.substring(0, 2) + '-' + d.substring(2, 6) + '-' + d.substring(6, 10)
  }
  if (d.length < 8) return d.substring(0, 3) + '-' + d.substring(3)
  if (d.length < 11) return d.substring(0, 3) + '-' + d.substring(3, 6) + '-' + d.substring(6)
  return d.substring(0, 3) + '-' + d.substring(3, 7) + '-' + d.substring(7)
}

export function clampMoney(v: unknown): number {
  const n = Number(v)
  if (isNaN(n) || n < 0) return 0
  if (n > MAX_MONEY) return MAX_MONEY
  return n
}

export function clampRate(v: unknown): number {
  const n = Number(v)
  if (isNaN(n) || n < 0) return 0
  if (n > 100) return 100
  return n
}
