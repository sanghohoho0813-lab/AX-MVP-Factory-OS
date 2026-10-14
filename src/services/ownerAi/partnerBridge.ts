/**
 * Partner OS(별도 저장소 miraeailab-ax-sales-os) → 운영 OS 최소 다리.
 *
 * 동료 컨설턴트가 Partner OS 에서 넘긴 'ax_proposal_requested' 를 받는 두 길(Partner OS 는 고치지 않는다):
 *   1) 주소: /ai/new?event=ax_proposal_requested&company=…&url=…&bizNo=…&requester=…&memo=…
 *   2) 붙여넣기: Partner OS 가 만든 JSON 한 덩어리 { event|type: 'ax_proposal_requested', company: { name, url|homepage, bizNo|businessNumber }, requester|consultant: { name } | '이름', memo|message }
 * 둘 다 '빠른 등록' 칸을 채우기만 한다 — 같은 업체가 있으면 새로 만들기 전에 잇기를 먼저 권한다(중복 업체 금지).
 */
export const PARTNER_EVENT = 'ax_proposal_requested'

export interface PartnerHandoff {
  event: typeof PARTNER_EVENT
  companyName: string
  homepageUrl: string
  bizNo: string
  requester: string
  memo: string
}

type O = Record<string, unknown>
const s = (v: unknown, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '')

function fromObject(o: O): PartnerHandoff | null {
  const ev = s(o.event) || s(o.type)
  if (ev !== PARTNER_EVENT) return null
  const company = (o.company && typeof o.company === 'object' ? o.company : {}) as O
  const consultant = o.requester ?? o.consultant ?? o.from
  const requester = typeof consultant === 'object' && consultant ? s((consultant as O).name) : s(consultant)
  const companyName = s(company.name) || s(o.companyName) || s(o.company_name)
  if (!companyName) return null
  return {
    event: PARTNER_EVENT,
    companyName,
    homepageUrl: s(company.url) || s(company.homepage) || s(o.url) || s(o.homepage),
    bizNo: (s(company.bizNo) || s(company.businessNumber) || s(o.bizNo)).replace(/\D/g, '').slice(0, 10),
    requester,
    memo: s(o.memo, 2000) || s(o.message, 2000) || s(o.note, 2000),
  }
}

/** 붙여넣은 글(JSON) 또는 주소 검색값 → 빠른 등록 칸. 모양이 아니면 null */
export function parsePartnerHandoff(input: string | URLSearchParams): PartnerHandoff | null {
  if (typeof input !== 'string') {
    const o: O = {}
    for (const k of ['event', 'type', 'company', 'companyName', 'url', 'homepage', 'bizNo', 'requester', 'memo']) {
      const v = input.get(k)
      if (v != null) o[k] = v
    }
    if (typeof o.company === 'string') {
      o.companyName = o.company
      delete o.company
    }
    return fromObject(o)
  }
  const t = input.trim()
  if (!t.startsWith('{')) return null
  try {
    const v = JSON.parse(t)
    return v && typeof v === 'object' ? fromObject(v as O) : null
  } catch {
    return null
  }
}
