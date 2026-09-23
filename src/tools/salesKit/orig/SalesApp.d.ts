/** [D-93] 원본 영업 OS(JSX) 를 TS 화면에서 부를 때의 모양 */
import type { ReactNode } from 'react'

export interface SalesAppProps {
  /** 원본 화면 키 (briefing · prospecting · companies · followup · meetings · reports · packages · pipeline · analytics · content · education · strategies · updates · settings) */
  tab?: string
  onTab?: (tab: string) => void
  /** 처음 열 때 고를 업체 id (?client=) */
  focus?: string | null
}
export default function App(props: SalesAppProps): ReactNode
export function emptyData(): Record<string, unknown>
