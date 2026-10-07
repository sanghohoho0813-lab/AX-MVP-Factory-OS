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
  const renew = list.filter((a) => a.renewal && a.renewal.daysLeft <= 120)
  if (renew.length) return { tone: 'good', headline: `${renew.map((a) => a.label).join(' · ')} 갱신 준비 — ${renew[0].renewal!.validUntil} 만료`, detail: renew[0].renewal!.note, missing: [] }
  if (now.length) return { tone: 'good', headline: `지금 추천: ${now.map((a) => a.label).join(' · ')}`, detail: now[0].oneLine, missing: [] }
  if (possible.length) return { tone: 'maybe', headline: `진행 가능: ${possible.map((a) => a.label).join(' · ')}`, detail: possible[0].oneLine, missing: [] }
  const held = list.filter((a) => a.recommendation === 'held')
  if (held.length === list.filter((a) => !a.key.startsWith('iso')).length) return { tone: 'done', headline: `${held.map((a) => a.label).join(' · ')} 보유`, detail: '갱신 · 사후관리만 챙기면 돼요', missing: [] }
  const need = list.find((a) => a.recommendation === 'need_info')
  return { tone: 'need', headline: need ? `${need.label} — ${RECOMMENDATION_LABEL.need_info}` : '지금 진행할 인증은 없어요', detail: need?.oneLine ?? '', missing: [...new Set(list.flatMap((a) => a.missingFacts))].slice(0, 3) }
}
