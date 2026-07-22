/**
 * UI 환경설정(글자 크기) 서버 동기화.
 *
 * 우선순위: 서버(ui_preferences) > 로컬 캐시(uiPreferencesRepository) > 기본값(1.5).
 * - local 모드: 서버 접근 없이 로컬 저장소만 사용(기존 동작 유지).
 * - supabase 모드: 로그인 후 서버 값을 읽어 반영하고, 변경 시 서버+로컬에 함께 저장.
 * 기존 글자 크기 설정(1.5/1.8/2.1)을 보존한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UiTextScale } from '../../types/ui'
import { TEXT_SCALE_VALUE, isTextScale } from '../../lib/uiTextScale'
import { uiPreferencesRepository } from '../../repositories/uiPreferencesRepository'

/** enum → 숫자 배율 */
export function textScaleToNumber(scale: UiTextScale): number {
  return TEXT_SCALE_VALUE[scale]
}

/** 숫자 배율 → enum (가장 가까운 값으로 매핑) */
export function numberToTextScale(value: number): UiTextScale {
  let best: UiTextScale = 'default'
  let bestDiff = Number.POSITIVE_INFINITY
  for (const key of Object.keys(TEXT_SCALE_VALUE) as UiTextScale[]) {
    const diff = Math.abs(TEXT_SCALE_VALUE[key] - value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = key
    }
  }
  return best
}

interface UiPrefRow {
  text_scale: number
  payload: Record<string, unknown> | null
}

/** 서버에서 사용자 글자 크기를 읽는다. 값이 없으면 null. */
export async function loadServerTextScale(
  client: SupabaseClient,
  userId: string,
  workspaceId: string | null,
): Promise<UiTextScale | null> {
  const query = client
    .from('ui_preferences')
    .select('text_scale, payload')
    .eq('user_id', userId)
  const { data, error } = workspaceId
    ? await query.eq('workspace_id', workspaceId).maybeSingle()
    : await query.is('workspace_id', null).maybeSingle()
  if (error || !data) return null
  const row = data as UiPrefRow
  const fromPayload = row.payload?.textScale
  if (isTextScale(fromPayload)) return fromPayload
  if (typeof row.text_scale === 'number') return numberToTextScale(row.text_scale)
  return null
}

/** 서버에 사용자 글자 크기를 저장(upsert)한다. */
export async function saveServerTextScale(
  client: SupabaseClient,
  userId: string,
  workspaceId: string | null,
  scale: UiTextScale,
): Promise<void> {
  const { error } = await client.from('ui_preferences').upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      text_scale: textScaleToNumber(scale),
      payload: { textScale: scale },
    },
    { onConflict: 'user_id,workspace_id' },
  )
  if (error) throw new Error('환경설정을 저장하지 못했습니다.')
}

/**
 * 초기 글자 크기 결정.
 * 서버 값이 있으면 서버 우선, 없으면 로컬 저장값, 그것도 없으면 기본(1.5).
 * 서버 값을 채택하면 로컬 캐시도 갱신해 다음 로딩(익명 렌더 포함)을 빠르게 한다.
 */
export function resolveInitialTextScale(serverScale: UiTextScale | null): UiTextScale {
  if (serverScale) {
    // 로컬 캐시 동기화(다음 부팅 시 anti-flash 스크립트가 즉시 반영)
    uiPreferencesRepository.update(serverScale)
    return serverScale
  }
  return uiPreferencesRepository.get().textScale
}
