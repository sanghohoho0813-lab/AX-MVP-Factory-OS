import { createContext } from 'react'

/** UXS-1 요약 줄(SummaryStrip) 안이면 true — KpiCard 가 제 테두리를 빼고 한 판 안의 칸이 된다 */
export const KpiGroupContext = createContext(false)
