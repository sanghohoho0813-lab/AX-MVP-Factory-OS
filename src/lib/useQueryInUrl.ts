/**
 * 찾기 칸의 글을 주소(?q=)에 잠깐 늦게 옮겨 적는다 (D-124)
 *
 * 목록에서 찾기 → 업체 열기 → 뒤로 오면 찾던 말이 사라져 처음부터 다시 쳐야 했다.
 * 주소에 두면 뒤로 와도 그대로다. 글자를 칠 때마다 주소를 바꾸면 한글 조합이 끊길 수 있어
 * 입력 칸은 화면 상태로 두고, 멈춘 뒤 0.3초에 방문 기록을 늘리지 않고(replace) 적는다.
 */
import { useEffect } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'

export function useQueryInUrl(query: string, params: URLSearchParams, setParams: SetURLSearchParams, name = 'q'): void {
  useEffect(() => {
    const want = query.trim()
    if ((params.get(name) ?? '') === want) return
    const t = setTimeout(() => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          if (want) n.set(name, want)
          else n.delete(name)
          return n
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
  }, [query, params, setParams, name])
}
