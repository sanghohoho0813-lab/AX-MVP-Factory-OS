/**
 * 맞춤 추천(업체 상세)에 기업인증 한 줄 (D-170) — Core 판정을 그대로 쓴다(화면과 답이 다르지 않게).
 * 지금 추천 · 진행 가능한 인증을 앞에, 없으면 갱신 임박 · 확인 필요.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { assessAll } from '../core/assess'
import { RECOMMENDATION_LABEL } from '../core/types'
import { certContextOf } from './clientContext'

export interface CertInsightLine {
  tone: 'good' | 'maybe' | 'done' | 'need'
  headline: string
  detail: string
  missing: string[]
}

export function certInsightOf(record: ClientOpsRecord, today: string): CertInsightLine {
  const list = assessAll(certContextOf(record, today))
  const now = list.filter((a) => a.recommendation === 'now')
  const possible = list.filter((a) => a.recommendation === 'possible')
  // D-214: 이미 만료된 인증은 '갱신 준비' 가 아니다(새로 신청 — 아래 지금 추천 · 진행 가능에서 다룬다). 연장 기간 안이면 '연장 신청' 으로.
  //   예전: 2025년에 끝난 벤처도 남은 날이 음수라 '벤처기업 갱신 준비 — 2025-01-01 만료' 가 맨 위에 초록으로 떴다.
  const grace = list.filter((a) => !a.expired && a.renewal?.phase === 'grace' && a.renewal.graceUntil)
  if (grace.length) return { tone: 'good', headline: `${grace.map((a) => a.label).join(' · ')} 연장 신청 — ${grace[0].renewal!.graceUntil}까지`, detail: grace[0].renewal!.note, missing: [] }
  const renew = list.filter((a) => !a.expired && a.renewal && a.renewal.daysLeft >= 0 && a.renewal.daysLeft <= 120)
  if (renew.length) return { tone: 'good', headline: `${renew.map((a) => a.label).join(' · ')} 갱신 준비 — ${renew[0].renewal!.validUntil} 만료`, detail: renew[0].renewal!.note, missing: [] }
  if (now.length) return { tone: 'good', headline: `지금 추천: ${now.map((a) => a.label).join(' · ')}`, detail: now[0].oneLine, missing: [] }
  if (possible.length) return { tone: 'maybe', headline: `진행 가능: ${possible.map((a) => a.label).join(' · ')}`, detail: possible[0].oneLine, missing: [] }
  const held = list.filter((a) => a.recommendation === 'held')
  // D-214: ISO 보유는 세지 않고 맞춘다 — ISO 둘을 가진 업체가 연구소 · 벤처만 있어도 '모두 보유' 로 보여 확인할 것이 숨었다
  if (held.length > 0 && held.filter((a) => !a.key.startsWith('iso')).length === list.filter((a) => !a.key.startsWith('iso')).length) return { tone: 'done', headline: `${held.map((a) => a.label).join(' · ')} 보유`, detail: '갱신 · 사후관리만 챙기면 돼요', missing: [] }
  const need = list.find((a) => a.recommendation === 'need_info')
  return { tone: 'need', headline: need ? `${need.label} — ${RECOMMENDATION_LABEL.need_info}` : '지금 진행할 인증은 없어요', detail: need?.oneLine ?? '', missing: [...new Set(list.flatMap((a) => a.missingFacts))].slice(0, 3) }
}
