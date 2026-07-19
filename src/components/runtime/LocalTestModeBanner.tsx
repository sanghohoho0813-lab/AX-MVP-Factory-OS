import { FlaskConical } from 'lucide-react'

interface LocalTestModeBannerProps {
  /** compact는 좁은 영역용 (한 줄) */
  compact?: boolean
}

const MESSAGE =
  '현재 설문 링크와 응답은 이 브라우저의 로컬 저장소에 저장됩니다. 동일한 브라우저 프로필에서만 테스트할 수 있으며, 실제 고객의 다른 휴대전화나 PC에서는 열리지 않습니다. 외부 공유는 Supabase 연결 후 제공됩니다.'

/** 로컬 테스트 모드 한계를 알리는 공용 배너 */
export function LocalTestModeBanner({ compact = false }: LocalTestModeBannerProps) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 ${
        compact ? 'py-2' : 'py-3'
      } text-warning-800`}
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">로컬 테스트 모드</p>
        {!compact && (
          <p className="mt-0.5 text-xs break-keep text-warning-700">{MESSAGE}</p>
        )}
      </div>
    </div>
  )
}

/** 공개 설문 하단용 작은 테스트 배지 */
export function LocalTestModeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      <FlaskConical aria-hidden="true" className="size-3" />
      로컬 테스트 모드
    </span>
  )
}
