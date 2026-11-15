/**
 * SYNC-6 업체 기록 저장이 끝나면(합쳐 저장 · 같은 칸을 골라 저장 포함 — SYNC-2 · D-547) 업체 상세 밖 화면도 그 판으로 바로 바꿔 끼운다.
 * 고객 관리 · 업체 상세 왼쪽 업체 목록 · 영업 보드 · 미팅 준비 · 오늘 · 확인할 것.
 *
 *  - 예전: 업체 상세만 바로 맞췄다. 다른 화면은 합친 판을 모른 채 예전 판을 보여 주다가, 다시 열거나 돌아와야 맞았다
 *    (같은 칸을 골라 [내가 고친 것으로] 저장해도 보드에는 먼저 저장된 값이 그대로 · 오른쪽 상세에서 회사 이름을 고쳐도 왼쪽 목록은 옛 이름).
 *  - 그 업체 저장이 아직 줄 서 있으면 소식이 오지 않는다 — 그 사이 화면에서 더 고친 것을 덮지 않게(D-125).
 *  - 화면 목록에 없는 업체(거른 목록 · 다른 작업공간)는 건드리지 않는다. 같은 판이면 그대로(다시 그리지 않음).
 */
import { useEffect, useRef } from 'react'
import type { ClientOpsRecord } from '../types/clientOps'
import { onClientSaveNews } from './clientOpsService'
import { replaceClientInList } from './clientMerge'

export { replaceClientInList }

/** 저장 끝 소식을 받아 화면 목록을 고친다 — setList 는 useState 의 바꾸기 함수(목록이 아직 없으면 그대로 두면 된다) */
export function useClientSaveNews(setList: (fn: (list: ClientOpsRecord[]) => ClientOpsRecord[]) => void): void {
  const ref = useRef(setList)
  ref.current = setList
  useEffect(
    () =>
      onClientSaveNews((n) => {
        if (n.kind !== 'saved') return
        ref.current((list) => replaceClientInList(list, n.record))
      }),
    [],
  )
}
