/**
 * D-638 오늘 대화창 — '○○ 열어 줘' 처럼 화면을 여는 말은 묻지 않고 그 화면으로(대표 2026-11-19 "대화 한 번이면 원하는 걸").
 * 규칙 계산이다 — AI 가 아니다. 맞는 화면은 찾기(D-592)와 같은 표(이 계정에 보이는 화면만)에서.
 */
import type { ScreenHit } from '../../content/screenSearch'

/** '○○ 열어 줘 · ○○ 가 줘 · ○○ 화면' — 화면을 여는 말이고 맞는 화면이 하나로 분명하면 그 화면(규칙 · AI 아님) */
export function openCommandTarget(raw: string, hits: readonly ScreenHit[]): ScreenHit | null {
  const t = raw.trim()
  if (!t || t.length > 40) return null
  if (!/(열어|열기|켜\s*줘|가\s*줘|가자|이동|보여\s*줘|화면)\s*(줘|주세요|줄래|해\s*줘)?\s*[.!?]*$/.test(t)) return null
  const screens = hits.filter((h) => h.kind === 'screen')
  return screens[0] ?? null
}

