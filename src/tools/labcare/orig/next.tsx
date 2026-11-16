/**
 * next/link 자리 (D-92) — 원본 화면 코드를 덜 고치려고 같은 이름의 Link 를 준다.
 * 주소 바꾸기는 `nav.ts` 의 mapHref 가 한다.
 */

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { mapHref, withOsClient } from './nav'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children?: ReactNode; prefetch?: boolean; scroll?: boolean }

export default function Link({ href, children, prefetch, scroll, ...rest }: LinkProps) {
  void prefetch
  void scroll
  // D-618 모듈 안 링크도 '어느 업체 일로 열었나' 를 들고 간다
  const { search } = useLocation()
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <RouterLink to={withOsClient(mapHref(href), search)} {...rest}>
      {children}
    </RouterLink>
  )
}
