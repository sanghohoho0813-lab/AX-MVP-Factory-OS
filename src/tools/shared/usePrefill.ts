/**
 * 업체 기록으로 도구 폼 채우기 — 한 번만, 빈 칸만 (D-90).
 *
 * 도구마다 폼 모양이 달라서 '무엇을 어디에 넣을지' 는 도구가 정하고,
 * '언제 채울지'(업체를 물고 왔고, 아직 안 채웠을 때 한 번) 만 여기서 정한다.
 *
 * 대표가 고쳐 둔 값은 절대 덮지 않는다 — 채우기는 편의지 규칙이 아니다.
 */

import { useEffect, useRef, useState } from 'react'
import { clientFacts, prefilledText, type ClientFacts } from './clientPrefill'
import { useToolClient } from './toolClientContext'

export interface PrefillResult {
  /** 업체에서 채운 칸 이름들 → 화면에 한 줄로 */
  note: string
  /** 업체를 물고 왔는가 */
  hasClient: boolean
}

/**
 * @param apply 업체에서 아는 것을 받아, 실제로 채운 칸 이름들을 돌려준다.
 *              (빈 칸만 채우는 판단은 도구가 한다 — 폼 모양을 아는 것은 도구뿐이다)
 */
export function usePrefillFromClient(apply: (facts: ClientFacts) => string[]): PrefillResult {
  const { clientRecord } = useToolClient()
  const done = useRef<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!clientRecord) return
    if (done.current === clientRecord.id) return
    done.current = clientRecord.id
    const filled = apply(clientFacts(clientRecord, new Date()))
    setNote(prefilledText(filled))
    // apply 는 매 렌더 새로 만들어지므로 의존성에서 뺀다 — 업체가 바뀔 때만 다시 채운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRecord])

  return { note, hasClient: Boolean(clientRecord) }
}
