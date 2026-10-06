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

export function loadStartupTaxForm(clientId: string | null | undefined): FormData | null {
  try {
    const raw = localStorage.getItem(startupTaxKey(clientId))
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<FormData>
    return {
      ...EMPTY_FORM,
      ...saved,
      checkItems: { ...EMPTY_FORM.checkItems, ...(saved.checkItems ?? {}) },
      advanced: { ...EMPTY_ADVANCED, ...(saved.advanced ?? {}) },
    }
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

export function isStartupTaxJudged(clientId: string | null | undefined, form: FormData | null): boolean {
  try {
    if (localStorage.getItem(judgedKey(clientId))) return true
  } catch {
    /* 읽지 못하면 아래 규칙으로 */
  }
  return !!form && Object.values(form.checkItems ?? {}).some(Boolean)
}
