/**
 * D-282 오늘 화면 맨 위 KPI — 화면이 이미 센 숫자만 쓴다(지어낸 숫자 0).
 *   진행 중 고객사   = 보관하지 않은 업체(계약 · 잠재)
 *   확인 필요 항목   = '확인할 것' 과 같은 판정(buildAllDecisions)
 *   최근 AI 작업     = AI 전략실 지난 7일 실행 — 기능 권한이 있는 사람만(팀장 화면에는 칸이 없다)
 *   상담 · 후속      = 새 상담신청(대표) + 업체 약속(지난 것 · 오늘 · 내일)
 * 누르면 그 목록으로. 0 이면 색 없음(화면 규칙 §2).
 * U2(2026-11-05 대표 승인): 큰 칸 다섯 개 → 목록 위 한 줄 요약(칩) — 숫자 · 셈 · 누르면 가는 곳은 그대로, 설명은 칩에 마우스를 올리면(title).
 * D-541(2026-11-05 대표 지시): '오늘 처리할 업무' 칩은 뺐다 — 제목 '오늘 할 일 n건' 과 같은 숫자가 두 번 보였다.
 *   밀린 것 · 놓치면 끝나는 기한은 바로 아래 할 일 목록이 빨간 글자로 말한다(D-541 로 목록이 숫자 줄 바로 아래).
 */
import { useContext, useEffect, useState } from 'react'
import { CalendarClock, CheckCheck, MessagesSquare, Sparkles, Users } from 'lucide-react'
import { SummaryChip, type SummaryChipProps as ChipProps } from '../ui/SummaryChip'
import { ScrollHintRow } from '../ui/ScrollHintRow'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { AuthContext } from '../../auth/authContext'
import { nowDate } from '../../lib/appClock'

interface Props {
  clients: { contract: number; prospect: number }
  /** null = 아직 모으는 중('–') */
  decisions: number | null
  follow: { events: number; appointments: number; lateAppointments: number }
  pilot: boolean
  phone: boolean
  onFollow: () => void
  /** D-482 업체 · 할 일을 읽는 동안 — 칸 자리를 미리 잡아(숫자 대신 '–') 다 읽은 뒤 아래 칸이 밀려 내려가지 않게 */
  loading?: boolean
}

interface RecentAi {
  count: number
  latest: { caseId: string; task: string; company: string } | null
}

/**
 * 지난 7일 AI 전략실 실행 — AI 전략실 문지기(useOwnerAiAccess)가 'yes' 인 사람만. 아니면 null(칸 없음) · 못 읽어도 null.
 * AI 전략실 저장소 · 이름표는 그때 불러온다(오늘 화면 첫 파일에 넣지 않는다). 데이터는 DB 정책이 따로 막는다.
 */
function useRecentAiRuns(enabled: boolean): RecentAi | null {
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const userId = auth?.session?.user.id ?? null
  const [state, setState] = useState<RecentAi | null>(null)
  useEffect(() => {
    if (!enabled) {
      setState(null)
      return
    }
    let alive = true
    void (async () => {
      try {
        const [{ ownerAiRepo }, { SKILL_META }] = await Promise.all([import('../../services/ownerAi/repo'), import('../../services/ownerAi/skillCatalog')])
        const repo = ownerAiRepo({ workspaceId, userId })
        const since = new Date(nowDate().getTime() - 7 * 86_400_000).toISOString()
        const [runs, cases] = await Promise.all([repo.listRunsSince(since), repo.listCases()])
        if (!alive) return
        const last = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        const company = last ? (cases.find((c) => c.id === last.caseId)?.companyName ?? '') : ''
        setState({ count: runs.length, latest: last ? { caseId: last.caseId, task: SKILL_META[last.skillId]?.name ?? 'AI 작업', company } : null })
      } catch {
        if (alive) setState(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled, workspaceId, userId])
  return state
}

export function TodayKpis({ clients, decisions, follow, pilot, phone, onFollow, loading = false }: Props) {
  // 읽는 중에는 숫자 · 설명 대신 자리만(지어낸 0 을 잠깐이라도 보이지 않게)
  const val = (text: string) => (loading ? '–' : text)
  const tip = (text: string) => (loading ? '불러오는 중…' : text)
  const aiOpen = useOwnerAiAccess() === 'yes'
  const ai = useRecentAiRuns(!pilot && aiOpen)
  const latest = ai?.latest ?? null
  const followCount = (pilot ? 0 : follow.events) + follow.appointments
  const chips: ChipProps[] = [
    {
      testId: 'kpi-clients',
      icon: Users,
      label: '진행 중 고객사',
      value: val(`${clients.contract + clients.prospect}곳`),
      hint: tip(`계약 ${clients.contract}곳 · 잠재 ${clients.prospect}곳`),
      to: '/ops/clients',
    },
    {
      testId: 'kpi-decide',
      icon: CheckCheck,
      label: '확인 필요 항목',
      value: decisions === null ? '–' : val(`${decisions}개`),
      urgency: loading || decisions === null ? 'neutral' : decisions > 0 ? 'brand' : 'neutral',
      hint: decisions === null ? '모으는 중…' : tip(decisions > 0 ? '맞다 · 아니다만 고르면 끝' : '확인할 것 없음'),
      to: '/ops/decide',
    },
    ...(ai
      ? [
          {
            testId: 'kpi-ai',
            icon: Sparkles,
            label: '최근 AI 작업',
            value: val(`${ai.count}건`),
            hint: tip(latest ? `지난 7일 · 최근 ${latest.task}${latest.company ? ` · ${latest.company}` : ''}` : '지난 7일 실행 없음'),
            to: latest ? `/ai/${latest.caseId}` : '/ai',
          } satisfies ChipProps,
        ]
      : []),
    {
      testId: 'kpi-follow',
      icon: pilot ? CalendarClock : MessagesSquare,
      label: pilot ? '후속 약속' : '상담 · 후속',
      value: val(`${followCount}건`),
      urgency: loading ? 'neutral' : follow.lateAppointments > 0 ? 'warning' : !pilot && follow.events > 0 ? 'brand' : 'neutral',
      hint: tip([!pilot ? `새 상담신청 ${follow.events}` : '', `업체 약속 ${follow.appointments}${follow.lateAppointments > 0 ? `(지난 것 ${follow.lateAppointments})` : ''}`].filter(Boolean).join(' · ')),
      onClick: onFollow,
    },
  ]
  const row = chips.map((c) => <SummaryChip key={c.testId} {...c} />)
  if (phone) {
    return (
      <section aria-label="오늘 숫자" data-testid="today-kpis">
        <ScrollHintRow fade="from-white via-white/90" innerClassName="flex gap-2 pb-1">
          {row}
        </ScrollHintRow>
      </section>
    )
  }
  return (
    <section aria-label="오늘 숫자" data-testid="today-kpis" className="flex flex-wrap items-center gap-2">
      {row}
    </section>
  )
}
