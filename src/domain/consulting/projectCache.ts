/**
 * 마지막으로 읽은 컨설팅 프로젝트 목록 — 전역 검색이 동기적으로 들여다보는 화면용 캐시.
 * 저장소가 아니다. 무거운 모듈을 끌어오지 않도록 이 파일은 타입만 import 한다(첫 번들 크기 보호).
 */

import type { ConsultingProject } from '../../types/consulting'

let cache: ConsultingProject[] = []

export function peekProjectCache(): ConsultingProject[] {
  return cache
}

export function setProjectCache(list: ConsultingProject[]): void {
  cache = list
}
