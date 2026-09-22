import type { Verdict } from '../types'

// 판정 상태별 화면 스타일 토큰 (결과 카드 공용)
export interface VerdictStyle {
  bg: string
  border: string
  text: string
  chipBg: string
  emoji: string
}

export const VERDICT_STYLE: Record<Verdict, VerdictStyle> = {
  good: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    chipBg: 'bg-green-600',
    emoji: '🟢',
  },
  caution: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    chipBg: 'bg-amber-500',
    emoji: '🟡',
  },
  conditional: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    chipBg: 'bg-orange-500',
    emoji: '🟠',
  },
  bad: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    chipBg: 'bg-red-600',
    emoji: '🔴',
  },
}

// 등록면허세 등 "참고" 영역용 중립(회색) 스타일
export const REFERENCE_STYLE = {
  bg: 'bg-gray-50',
  border: 'border-gray-200',
  text: 'text-gray-600',
  chipBg: 'bg-gray-500',
  emoji: '⚪',
}

// 인쇄(PDF)용 판정 색상
export const VERDICT_PRINT_COLOR: Record<Verdict, string> = {
  good: '#16a34a',
  caution: '#d97706',
  conditional: '#ea580c',
  bad: '#dc2626',
}
