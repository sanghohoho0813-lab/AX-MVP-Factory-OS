/**
 * D-683 고객 화면 보기를 열 수 있는가 — 대표(full)만.
 * 팀장 · 대표가 팀장 화면을 보는 중 · 구독 고객은 아니다. 연습 모드는 한 사람(대표)이라 열린다.
 * (머리줄 '보는 화면' 이 화면 전체를 끌어오지 않게 따로 둔다)
 */
import { useContext } from 'react'
import { AuthContext } from '../auth/authContext'
import { useIsPilot } from '../auth/osAccess'
import { useCustomerAudience } from '../config/customerAudience'
import { getDataModeConfig } from '../data/dataMode'

export function useCustomerViewAllowed(): boolean {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  const customer = useCustomerAudience()
  const local = getDataModeConfig().mode === 'local'
  return (local || auth?.access === 'full') && !pilot && !customer
}
