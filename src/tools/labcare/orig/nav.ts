/**
 * next/navigation 자리 (D-92) — 원본이 부르던 useRouter · useParams · useSearchParams · usePathname.
 * 원본 주소(/clients/…, /notes …)는 이 OS 의 모듈 주소(/tools/labcare/…)로 바꿔 보낸다.
 */

import { useMemo } from 'react'
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
  // D-168: 그릴 때마다 새 값을 주지 않는다(지켜보는 화면이 끝없이 다시 그리지 않게)
  return useMemo(
    () => ({
      push: (href: string) => navigate(mapHref(href)),
      replace: (href: string) => navigate(mapHref(href), { replace: true }),
      back: () => navigate(-1),
      refresh: () => undefined,
    }),
    [navigate],
  )
}

/** 원본 /clients/[id] 의 id — 이 OS 에서는 ?cid= 로 온다 */
export function useParams<T extends Record<string, string> = { id: string }>(): T {
  const [params] = useRouterSearchParams()
  return { id: params.get('cid') ?? '' } as unknown as T
}

/**
 * 원본 useSearchParams — client 는 lab 으로 들어온 것을 돌려준다.
 *
 * D-168: 주소가 바뀔 때만 새 값을 준다. 예전에는 그릴 때마다 새 값을 돌려줘, 이 값을 지켜보는 화면(연구노트 —
 * useEffect(…, [search]) 에서 업체 목록을 다시 넣음)이 '그림 → 새 값 → 다시 넣기 → 또 그림' 을 끝없이 되풀이했다.
 * 그동안 다음 화면으로 넘어가는 그리기가 계속 밀려, 주소만 바뀌고 화면은 멈춘 채가 됐다(새로 고침해야 풀림).
 */
export function useSearchParams() {
  const [params] = useRouterSearchParams()
  const key = params.toString()
  return useMemo(() => {
    const p = new URLSearchParams(key)
    return {
      get: (k: string) => (k === 'client' ? p.get('lab') : p.get(k)),
      has: (k: string) => p.has(k === 'client' ? 'lab' : k),
      toString: () => p.toString(),
    }
  }, [key])
}

export function usePathname(): string {
  return useLocation().pathname
}
