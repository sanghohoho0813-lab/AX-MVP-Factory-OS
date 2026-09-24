/**
 * AX 1차 미팅 체크리스트 — 자리 (D-103).
 *
 * 대표가 따로 만들고 있는 '영업자용 AX 1차 미팅 체크리스트' 프로그램이 들어올 자리다.
 * 들어오면: 이 파일을 그 프로그램 화면으로 바꾸고, moduleRegistry 의 `first-meeting` 줄에서 status: 'soon' 을 지운다.
 * 주소(/sales/first-meeting)와 메뉴 위치(영업 묶음)는 그대로 둔다 — 영업자가 이미 익힌 길이 바뀌지 않게.
 */
import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, Handshake, ListChecks } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'

const WILL_DO = [
  '미팅 전 — 업체 이름 · 업종 · 누가 소개했는지 · 챙겨 갈 자료를 한 번에 확인',
  '미팅 중 — AX 로 풀 만한 일을 묻는 질문 순서대로 체크하고 짧게 적기',
  '미팅 뒤 — 체크한 내용이 업체 기록 · 다음 일정 · 담당 영업자로 그대로 이어짐',
]

const CONNECTS = [
  { to: '/ops/clients', icon: ListChecks, label: '고객 운영', note: '체크한 업체가 업체 목록에 들어옵니다' },
  { to: '/ops/agents', icon: Handshake, label: '영업자 정산', note: '누가 데려온 업체인지가 정산으로 이어집니다' },
  { to: '/ops/calendar', icon: CalendarDays, label: '일정', note: '2차 미팅 · 자료 보내기가 달력에 뜹니다' },
]

export function FirstMeetingChecklistPage() {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <PageHeader title="AX 1차 미팅 체크리스트" description="영업자가 고객사를 처음 만날 때 쓰는 점검표입니다. 지금 만들고 있어 곧 이 자리에 들어옵니다." />

      <Panel>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-700">
            <ClipboardCheck className="size-6" />
          </span>
          <div className="min-w-0">
            <span className="t-meta inline-block rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">준비 중</span>
            <p className="t-body mt-1.5 break-keep text-slate-700">들어오면 이런 일을 합니다.</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {WILL_DO.map((w) => (
                <li key={w} className="t-sub flex gap-2 break-keep text-slate-600">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel title="들어오면 이어지는 곳">
        <ul className="grid gap-2 sm:grid-cols-3">
          {CONNECTS.map((c) => (
            <li key={c.to}>
              <Link to={c.to} className="flex h-full flex-col gap-1 rounded-(--radius-control) border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40">
                <span className="t-sub inline-flex items-center gap-1.5 font-bold text-slate-800">
                  <c.icon aria-hidden="true" className="size-4 text-brand-600" /> {c.label}
                </span>
                <span className="t-meta break-keep text-slate-500">{c.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
