/**
 * 상황 예시로 연 모듈 화면의 알림 한 칸 (D-199 → D-211).
 *
 * 무엇을 '가정' 으로 넣었는지 칩으로 보이고, [가정 빼기] 로 그 칸만 상황 예시 전 값으로 되돌린다.
 * 업체 숫자(직원 수 · 매출 · 주소)는 가정이 아니라서 칩에 없다 — 대표가 "이건 내가 넣은 게 아니다" 를 바로 안다.
 */

import type { ReactNode } from 'react'

export function PresetNote({
  testId,
  title,
  done,
  chips,
  onClear,
  cleared,
  clearedText,
  children,
}: {
  testId: string
  title: string
  /** '이 업체 숫자로 바로 계산했어요' 같은 한 줄 */
  done: string
  /** 지금 칸에 남아 있는 가정 */
  chips: string[]
  /** 없으면 [가정 빼기] 단추를 두지 않는다(절세 — 상황 문장 자체가 목적) */
  onClear?: () => void
  cleared?: boolean
  clearedText?: string
  children?: ReactNode
}) {
  if (cleared)
    return (
      <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 break-keep text-slate-600" data-testid={testId} data-cleared="1">
        상황 예시 · {title} — 넣었던 가정을 뺐어요. {clearedText}
      </p>
    )
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-success-200 bg-success-50 px-3 py-2" data-testid={testId}>
      <p className="t-sub font-semibold break-keep text-success-800">
        상황 예시 · {title} — {done}
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="preset-assumptions">
          <span className="t-meta font-semibold text-success-800">넣은 가정</span>
          {chips.map((c) => (
            <span key={c} className="t-meta max-w-full rounded-full border border-success-300 bg-white px-2.5 py-0.5 break-keep text-success-900" data-testid="preset-chip">
              {c}
            </span>
          ))}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="t-meta ml-auto min-h-11 shrink-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
              data-testid="preset-clear"
            >
              가정 빼기
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
