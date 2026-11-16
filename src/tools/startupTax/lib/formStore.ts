/**
 * 창업감면 판정 입력값 저장 (D-94) — 업체마다 따로.
 *
 * 전에는 브라우저에 한 칸(`axmvp.tools.startupTax`)만 있어서, 한솔을 판정한 뒤 다른 업체로 열면
 * 한솔의 답(법인·대표 생년월일…)이 그대로 남아 있었다. 업체에서 연 판정은 그 업체 칸에 따로 둔다.
 * 업체 없이 쓰는 판정은 예전 칸 그대로(옛 기록이 이어진다). 백업은 `axmvp.tools.*` 를 통째로 담는다.
 */

import type { FormData } from '../types'
import { EMPTY_ADVANCED, EMPTY_FORM } from './formDefaults'
import { sharedToolKey } from '../../shared/toolStorage'

export const STARTUP_TAX_STORAGE_KEY = 'axmvp.tools.startupTax'

export function startupTaxKey(clientId: string | null | undefined): string {
  return clientId ? `${STARTUP_TAX_STORAGE_KEY}.client.${clientId}` : sharedToolKey(STARTUP_TAX_STORAGE_KEY)
}

/** 남긴 답(이 브라우저 · 업체 기록에 붙인 것)을 지금 폼 모양으로 — 없는 칸은 빈 값 */
export function normalizeStartupTaxForm(saved: Partial<FormData>): FormData {
  return {
    ...EMPTY_FORM,
    ...saved,
    checkItems: { ...EMPTY_FORM.checkItems, ...(saved.checkItems ?? {}) },
    advanced: { ...EMPTY_ADVANCED, ...(saved.advanced ?? {}) },
  }
}

export function loadStartupTaxForm(clientId: string | null | undefined): FormData | null {
  try {
    const raw = localStorage.getItem(startupTaxKey(clientId))
    if (!raw) return null
    return normalizeStartupTaxForm(JSON.parse(raw) as Partial<FormData>)
  } catch {
    return null
  }
}

export function saveStartupTaxForm(clientId: string | null | undefined, form: FormData): void {
  try {
    localStorage.setItem(startupTaxKey(clientId), JSON.stringify(form))
  } catch {
    /* 저장 못 해도 판정은 된다 */
  }
}

/**
 * D-165: '판정' 을 누른 적이 있는가 — 판정 화면을 열기만 해도 폼이 저장되므로, 결과서는 이 표시가 있을 때만 만든다
 * (전에는 한 번도 판정하지 않은 빈 폼으로 결과서가 나와 업체에 붙일 수 있었다).
 * 이 표시가 생기기 전에 판정해 둔 기록은 체크 항목을 하나라도 고른 폼이면 판정한 것으로 본다.
 */
const judgedKey = (clientId: string | null | undefined) => `${startupTaxKey(clientId)}.judged`

export function markStartupTaxJudged(clientId: string | null | undefined, judged: boolean): void {
  try {
    if (judged) localStorage.setItem(judgedKey(clientId), new Date().toISOString())
    else localStorage.removeItem(judgedKey(clientId))
  } catch {
    /* 표시를 못 남겨도 판정은 된다 */
  }
}

/** D-620 마지막으로 [판정] 을 누른 때(이 브라우저) — 모르면 빈 글자(표시가 생기기 전 기록 · 브라우저 밖) */
export function startupTaxJudgedAt(clientId: string | null | undefined): string {
  try {
    const v = localStorage.getItem(judgedKey(clientId)) ?? ''
    return Number.isNaN(Date.parse(v)) ? '' : v
  } catch {
    return ''
  }
}

/**
 * D-620 사람이 답을 고친 때(이 브라우저) — 판정을 누르지 않고 고치기만 한 답도 '업체 기록에 붙인 답' 보다 새것일 수 있다.
 * 화면을 열기만 했거나 업체 기록으로 빈 칸이 채워진 것은 적지 않는다.
 */
const editedKey = (clientId: string | null | undefined) => `${startupTaxKey(clientId)}.edited`

export function markStartupTaxEdited(clientId: string | null | undefined): void {
  try {
    localStorage.setItem(editedKey(clientId), new Date().toISOString())
  } catch {
    /* 못 적어도 판정은 된다 */
  }
}

export function startupTaxEditedAt(clientId: string | null | undefined): string {
  try {
    const v = localStorage.getItem(editedKey(clientId)) ?? ''
    return Number.isNaN(Date.parse(v)) ? '' : v
  } catch {
    return ''
  }
}

export function isStartupTaxJudged(clientId: string | null | undefined, form: FormData | null): boolean {
  try {
    if (localStorage.getItem(judgedKey(clientId))) return true
  } catch {
    /* 읽지 못하면 아래 규칙으로 */
  }
  return !!form && Object.values(form.checkItems ?? {}).some(Boolean)
}
