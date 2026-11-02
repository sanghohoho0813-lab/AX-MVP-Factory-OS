/**
 * 할 일 · 업무 일기 안내 한 줄 (2026-11-02 대표 지시) — "내 개인 일정을 남이 본다는 건 참기 힘들다".
 * 사실 그대로만 말한다: 업무 일기(할 일 포함)는 DB 에서 쓴 사람 본인만 읽고 쓴다(RLS owner_id = auth.uid()).
 */
import { Lock } from 'lucide-react'
import { PRIVATE_NOTE } from '../../services/journalKind'

export function PrivateNote({ className = '' }: { className?: string }) {
  return (
    <p className={`t-meta flex items-start gap-1.5 break-keep text-slate-500 ${className}`} data-testid="private-note">
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{PRIVATE_NOTE}</span>
    </p>
  )
}
