/**
 * next/navigation 자리 (D-92) — 원본이 부르던 useRouter · useParams · useSearchParams · usePathname.
 * 원본 주소(/clients/…, /notes …)는 이 OS 의 모듈 주소(/tools/labcare/…)로 바꿔 보낸다.
 */

import { useLocation, useNavigate, useSearchParams as useRouterSearchParams } from 'react-router-dom'

const BASE = '/tools/labcare'

/** 원본 경로 → 모듈 경로 */
export function mapHref(href: string): string {
  if (/^https?:\/\//.test(href) || href.startsWith(BASE)) return href
  const [path, query = ''] = href.split('?')
  const q = new URLSearchParams(query)
  const seg = path.split('/').filter(Boolean)
  let section = seg[0] ?? 'dashboard'
  if (seg[0] === 'clients' && seg[1]) {
    q.set('cid', seg[1])
    section = seg[2] === 'check' ? 'check' : seg[2] === 'report' ? 'reports' : 'clients'
  } else if (seg[0] === 'setup-documents') section = 'setup-docs'
  else if (seg[0] === 'activity-survey') section = 'survey'
  // 원본 notes·changes 의 ?client= 은 이 OS 의 '업체 일로 열기(?client=)' 와 이름이 겹친다 — lab 으로 바꿔 둔다
  if (q.has('client')) {
    q.set('lab', q.get('client') ?? '')
    q.delete('client')
  }
  const qs = q.toString()
  return `${BASE}/${section}${qs ? `?${qs}` : ''}`
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

/** 원본 /clients/[id] 의 id — 이 OS 에서는 ?cid= 로 온다 */
export function useParams<T extends Record<string, string> = { id: string }>(): T {
  const [params] = useRouterSearchParams()
  return { id: params.get('cid') ?? '' } as unknown as T
}

/** 원본 useSearchParams — client 는 lab 으로 들어온 것을 돌려준다 */
export function useSearchParams() {
  const [params] = useRouterSearchParams()
  return {
    get: (k: string) => (k === 'client' ? params.get('lab') : params.get(k)),
    has: (k: string) => params.has(k === 'client' ? 'lab' : k),
    toString: () => params.toString(),
  }
}

export function usePathname(): string {
  return useLocation().pathname
}
