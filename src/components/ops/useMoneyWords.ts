/**
 * 돈 말 (D-171 대표) — 대표 화면은 '못 받은 내 돈', 팀장(Pilot) · 앞으로 가입하는 사람 화면은 '미수금'.
 * 대표가 팀장 화면으로 바꿔 보면 팀장과 같은 말이 보인다(useIsPilot).
 */
import { useIsPilot } from '../../auth/osAccess'

export function useMoneyWords(): { unpaid: string; unpaidFilter: string } {
  const pilot = useIsPilot()
  return pilot ? { unpaid: '미수금', unpaidFilter: '미수금 있음' } : { unpaid: '못 받은 내 돈', unpaidFilter: '못 받은 돈 있음' }
}
