/**
 * 앱 부트스트랩 상태 머신.
 * 데이터 모드·설정·인증·워크스페이스 상태를 하나의 판별 가능한 상태로 정리한다.
 * 조용한 fallback 없이, 각 상태를 명시적으로 화면에 표시하기 위한 근거를 제공한다.
 */

import type { DataMode } from '../data/dataMode'

export type BootstrapStatus =
  | 'initializing' // 세션·설정 확인 중
  | 'configuration_error' // 환경변수 누락/오류 (예: anon 자리에 service_role)
  | 'connection_error' // Supabase 연결/네트워크 실패
  | 'unauthenticated' // supabase 모드: 로그인 필요
  | 'authenticated_no_workspace' // 로그인됨, 워크스페이스 없음/미선택
  | 'ready' // 사용 준비 완료 (local 모드는 항상 여기)

export interface BootstrapState {
  status: BootstrapStatus
  mode: DataMode
  /** 사용자에게 보여줄 사유(오류 상태일 때) */
  detail?: string
  /** 누락 환경변수 키 이름(값 아님) */
  missingKeys?: string[]
}

export function initializingState(mode: DataMode): BootstrapState {
  return { status: 'initializing', mode }
}

export function configurationErrorState(mode: DataMode, detail: string, missingKeys: string[]): BootstrapState {
  return { status: 'configuration_error', mode, detail, missingKeys }
}

export function connectionErrorState(mode: DataMode, detail: string): BootstrapState {
  return { status: 'connection_error', mode, detail }
}

export function unauthenticatedState(mode: DataMode): BootstrapState {
  return { status: 'unauthenticated', mode }
}

export function noWorkspaceState(mode: DataMode): BootstrapState {
  return { status: 'authenticated_no_workspace', mode }
}

export function readyState(mode: DataMode): BootstrapState {
  return { status: 'ready', mode }
}

/** local 모드는 로그인·워크스페이스 없이 항상 준비 완료 상태다. */
export function localReadyState(): BootstrapState {
  return { status: 'ready', mode: 'local' }
}
