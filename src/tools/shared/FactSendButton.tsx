/**
 * 모듈에서 읽은 사실을 업체 정보로 (D-128) — 한 번 읽은 자료를 다른 모듈도 쓰게.
 *
 * 예: 고용지원금에서 4대보험 명부를 읽으면 "직원 수 12명을 업체 정보로" 한 번.
 * 대표가 누른 것이 곧 확인이다 — 출처(명부)와 '확인됨' 으로 남고, 정책자금 · 연구소 등이 그대로 쓴다.
 * 이미 같은 값이면 단추 대신 '업체 정보와 같음' 만 적는다.
 */

import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import type { FactSource } from '../../types/clientOps'
import { listClients, saveClient } from '../../services/clientOpsService'
import { factDef, readFact, sameFactValue, withFactValue } from '../../services/customerFacts'
import { nowIso } from '../../lib/appClock'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { useToolClient } from './toolClientContext'

export function FactSendButton({ factKey, value, display, source, asOf = '' }: { factKey: string; value: string; display: string; source: FactSource; asOf?: string }) {
  const { clientId, clientRecord, clientName, workspaceId } = useToolClient()
  const { showToast } = useToast()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!clientId || !clientRecord || !value) return null
  const def = factDef(factKey)
  const cur = readFact(clientRecord, factKey)
  const same = sent || (cur && cur.status === 'confirmed' && sameFactValue(def, cur.value, value))
  if (same) {
    return (
      <span className="t-sub inline-flex items-center gap-1 text-success-700" data-testid={`fact-sent-${factKey}`}>
        <Check aria-hidden="true" className="size-4" /> {def?.label} {display} — 업체 정보와 같음
      </span>
    )
  }
  const send = async () => {
    setBusy(true)
    try {
      const fresh = (await listClients(workspaceId)).find((c) => c.id === clientId) ?? clientRecord
      await saveClient(withFactValue(fresh, factKey, value, { source, status: 'confirmed', asOf, now: nowIso() }))
      setSent(true)
      showToast(`${clientName} — ${def?.label} ${display}. 다른 전문 모듈도 이 값을 씁니다.`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="secondary" disabled={busy} onClick={() => void send()} data-testid={`fact-send-${factKey}`}>
      <Send aria-hidden="true" className="size-4" /> {def?.label} {display}{cur && cur.status !== 'missing' ? ` (지금 ${cur.display})` : ''} — 업체 정보로
    </Button>
  )
}
