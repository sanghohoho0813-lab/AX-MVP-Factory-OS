/**
 * 고객 관리 'AI 비서' 자리 (D-169) — 나중에 GPT · Claude 를 붙일 곳.
 *
 * 고객이 많아질수록 '이번 주 누구를 만나고 무엇부터 할지' 를 사람이 다 챙기기 어렵다.
 * 연결하면 업체 기록(다음 약속 · 서류 기한 · 받을 돈 · 지원사업 마감 · 메모)을 읽어 우선순위로 정리하고,
 * PDF 로 만들어 메일로 보내고, 확인한 것만 할 일 · 일정으로 걸어 준다.
 *
 * 지금은 **아무것도 밖으로 보내지 않는다**(LLM 호출 0) — 무엇을 하게 될지 예시만 보여 준다.
 */
import { useState } from 'react'
import { CalendarClock, FileText, ListOrdered, Mail, MessageSquareText, Sparkles, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'

const EXAMPLES: { icon: LucideIcon; title: string; say: string; does: string }[] = [
  { icon: CalendarClock, title: '이번 주 만나야 할 고객', say: '"이번 주에 누구 만나야 돼?"', does: '다음 약속 · 미팅 날짜 · 한 달 넘게 연락 못 한 계약 고객을 모아 요일별로 정리합니다.' },
  { icon: ListOrdered, title: '급한 일부터 우선순위', say: '"이번 주 진행할 것 급한 순으로"', does: '서류 만료 · 받을 돈 · 지원사업 마감 · 인증 갱신 · 신청 준비를 마감과 금액 순으로 줄 세웁니다.' },
  { icon: FileText, title: 'PDF 한 장으로', say: '"정리한 거 PDF로 만들어 줘"', does: '고객별 할 일 · 기한 · 담당을 한 장짜리 PDF 로 만듭니다(인쇄 · 팀 공유용).' },
  { icon: Mail, title: '내 메일로 매주 보내기', say: '"매주 월요일 아침 8시에 메일로"', does: '정해 둔 요일 · 시간에 이번 주 정리본을 대표님 · 팀장님 메일로 보냅니다.' },
  { icon: Workflow, title: '할 일 · 일정 바로 걸기', say: '"이대로 할 일로 걸어 줘"', does: '정리한 우선순위를 업체별 할 일 · 달력에 겁니다 — 한 번 확인한 것만.' },
  { icon: MessageSquareText, title: '고객별 연락 문구 초안', say: '"연락 안 한 계약 고객 안부 문구"', does: '업체마다 진행 상황에 맞춘 카톡 · 문자 초안을 씁니다(보내기 전 확인).' },
]

export function AiClientAssistantButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="ai-client-assistant"
        className="tap t-body inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 font-semibold whitespace-nowrap text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 sm:min-h-10 sm:px-4"
      >
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        <span className="hidden sm:inline">AI 비서로 정리</span>
        <span className="sm:hidden">AI 비서</span>
        <span className="t-meta hidden shrink-0 rounded-full bg-white/25 px-1.5 py-px font-semibold sm:inline">준비 중</span>
      </button>
      {open && (
        <BottomSheet
          title="AI 비서 — 연결 준비 중"
          onClose={() => setOpen(false)}
          footer={
            <Button variant="primary" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              알겠어요
            </Button>
          }
        >
          <div className="flex flex-col gap-4" data-testid="ai-client-assistant-sheet">
            <p className="t-body break-keep text-slate-800">
              고객이 많아질수록 <b>누구를 먼저 만나고 무엇부터 할지</b> 챙기기 어려워집니다. GPT · Claude 를 연결하면 업체 기록(다음 약속 · 서류 기한 · 받을 돈 · 지원사업 마감 · 메모)을 읽고, 말 한마디로 정리 · 우선순위 · PDF · 메일 · 할 일 걸기까지 해 줍니다.
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {EXAMPLES.map((e) => (
                <li key={e.title} className="flex gap-3 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 p-3" data-testid="ai-example">
                  <e.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-700" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="t-body font-semibold break-keep text-violet-950">{e.title}</span>
                    <span className="t-sub break-keep text-violet-800">{e.say}</span>
                    <span className="t-sub break-keep text-slate-700">{e.does}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="t-sub break-keep text-slate-600">
              이 밖에도 '이번 달 정책자금 가능성 높은 업체만', '갱신 3개월 남은 인증 모아서', '잠재고객 중 다시 연락할 곳' 처럼 말로 묻는 대로 고객 목록을 정리하고 일을 걸 수 있습니다.
            </p>
            <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 break-keep text-slate-600">
              지금은 연결 전이라 아무 내용도 밖으로 보내지 않습니다. 연결하면 보내기 · 할 일 걸기는 늘 한 번 확인한 뒤에만 합니다.
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
