/**
 * D-239 업체 상세 머리줄의 AI 도우미 — 어느 탭에 있든 이 업체 한 장 요약 · 다음 할 일 · 미팅 질문 · 제안 순서.
 * (맞춤 추천 탭 위에도 같은 질문 띠가 있다 — 지난 답은 같은 자리에 모인다)
 */
import { useCallback } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { buildClientSchedule } from '../../services/clientOpsSchedule'
import { clientBundle } from '../../services/aiAssist/builders'
import { useEntitlements } from '../../lib/entitlementsStore'
import { AiAssist } from './AiAssist'

export function ClientAssistButton({ record, today }: { record: ClientOpsRecord; today: string }) {
  const { ent } = useEntitlements()
  // D-479 판정 엔진(가장 큰 파일)은 AI 도우미 판을 열 때 받는다 — 업체 상세 첫 화면이 이것 때문에 무거웠다(판을 열어야 build 가 불린다)
  const build = useCallback(async () => {
    const { buildInsights } = await import('../../services/clientInsights')
    return clientBundle(record, today, buildInsights(record, today, [], (k) => k === 'grants' || ent.feature(k).usable), buildClientSchedule(record, today))
  }, [record, today, ent])
  return <AiAssist variant="button" page="client" scope={`client:${record.id}`} title={record.companyName} presets={['client.brief', 'client.next', 'client.meeting', 'client.pitch']} build={build} defaultClientId={record.id} />
}
