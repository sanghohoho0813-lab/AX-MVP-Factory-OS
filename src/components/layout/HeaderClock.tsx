/**
 * 최상단 날짜·시각 (D-87).
 *
 * 대표가 화면 어디에 있든 오늘이 며칠이고 지금 몇 시인지 보여야 한다 — 마감을 세는 일이라서다.
 * 예전에는 '오늘' 화면 머리말에만 작게 있었고 분까지만 보였다. 이제 머리띠에서 **초까지** 보인다.
 *
 * 1초마다 다시 그리는 것은 이 조각 하나뿐이다. 화면을 떠나면 시계도 멈춘다.
 */

import { useEffect, useState } from 'react'
import { nowDate } from '../../lib/appClock'

const DAY = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatClockDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]})`
}

/** 휴대폰 머리띠용 짧은 날짜 — '9월 24일 (목)' */
function formatClockDateShort(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]})`
}

export function formatClockTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function HeaderClock() {
  const [now, setNow] = useState(() => nowDate())

  useEffect(() => {
    const id = window.setInterval(() => setNow(nowDate()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const date = formatClockDate(now)
  const time = formatClockTime(now)

  return (
    <>
      {/* 휴대폰 — D-96: 오늘 날짜도 늘 보이게(대표 요청). 짧은 날짜를 시각 위에 작게 얹어 폭은 그대로 둔다 */}
      <span aria-label={`지금 ${date} ${time}`} className="flex shrink-0 flex-col items-end leading-tight lg:hidden">
        <span className="text-[0.72rem] font-semibold whitespace-nowrap text-slate-500">{formatClockDateShort(now)}</span>
        <span className="text-[0.95rem] font-bold whitespace-nowrap text-slate-700 tabular-nums">{time}</span>
      </span>
      {/* 데스크톱 — 날짜는 작게 위, 시각은 크게 아래 */}
      <span aria-label={`지금 ${date} ${time}`} className="hidden shrink-0 flex-col items-end leading-tight lg:flex">
        <span className="text-[0.8rem] font-medium whitespace-nowrap text-slate-500">{date}</span>
        <span className="text-[1.25rem] font-bold whitespace-nowrap text-slate-900 tabular-nums">{time}</span>
      </span>
    </>
  )
}
