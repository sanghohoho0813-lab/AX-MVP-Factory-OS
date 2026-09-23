/**
 * next/navigation 자리 (D-92) — 원본 정책자금 OS 의 주소를 이 OS 의 모듈 주소로 바꾼다.
 *   /dashboard → 상담 고객 관리 · /customers/{id} → 고객 상세(?cid=) · /customers/{id}/report → 인쇄 리포트(?cid=)
 *   /diagnosis → 진단하기 · / → 대시보드
 */

import { useNavigate } from 'react-router-dom'

const BASE = '/tools/policy-funding'

export function mapHref(href: string): string {
  if (/^https?:\/\//.test(href) || href.startsWith(BASE)) return href
  const [pathHash, query = ''] = href.split('?')
  const [path, hash = ''] = pathHash.split('#')
  const q = new URLSearchParams(query)
  const seg = path.split('/').filter(Boolean)
  let section = 'dashboard'
  if (seg[0] === 'dashboard') section = 'customers'
  else if (seg[0] === 'diagnosis') section = 'diagnosis'
  else if (seg[0] === 'customers' && seg[1]) {
    q.set('cid', seg[1])
    // D-94: 고객 id = 고객 운영 업체 id — 업체 띠('업체로 돌아가기')와 한 번에 붙이기가 따라오게 client 도 단다
    q.set('client', seg[1])
    section = seg[2] === 'report' ? 'report' : 'customers'
  }
  const qs = q.toString()
  return `${BASE}/${section}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`
}

export function useRouter() {
  const navigate = useNavigate()
  return {
    push: (href: string) => navigate(mapHref(href)),
    replace: (href: string) => navigate(mapHref(href), { replace: true }),
    back: () => navigate(-1),
    refresh: () => undefined,
  }
}
