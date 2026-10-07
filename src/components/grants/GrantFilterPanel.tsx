/**
 * 지원사업 거르기 (D-168) — 1차 맞는 업체 → 2차 금액 → 3차 선정 규모 · 행사 · 마감 여유.
 * 단계마다 몇 개가 남는지 색 띠로 보여 주고, 기준은 '기준 바꾸기' 창에서 직접 고른다(바로 적용 · 브라우저에 기억).
 */
import type { ReactNode } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { AMOUNT_STEPS, DAY_STEPS, DEFAULT_GRANT_FILTER, SLOT_STEPS, manText, settingsLine, type GrantFilterSettings } from '../../services/grants/grantFilter'

export interface FunnelCounts {
  base: number
  stage1: number | null
  stage2: number
  stage3: number
}

function Step({ n, label, count, tone, off, children }: { n: string; label: string; count: number | null; tone: string; off?: boolean; children?: ReactNode }) {
  return (
    <li className={`flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] flex-col gap-0.5 rounded-(--radius-control) border px-3 py-2 sm:basis-0 ${off ? 'border-slate-200 bg-white text-slate-400' : tone}`} data-testid={`grant-funnel-${n}`}>
      <span className="t-meta font-semibold break-keep">{label}</span>
      <span className="t-section font-bold tabular-nums">{off || count === null ? '꺼짐' : `${count.toLocaleString()}개`}</span>
      {children}
    </li>
  )
}

export function GrantFunnel({
  counts,
  settings,
  onlyReach,
  onToggleReach,
  onOpenSettings,
  showHidden,
  onToggleHidden,
}: {
  counts: FunnelCounts
  settings: GrantFilterSettings
  onlyReach: boolean
  onToggleReach: (v: boolean) => void
  onOpenSettings: () => void
  showHidden: boolean
  onToggleHidden: () => void
}) {
  const line = settingsLine(settings)
  const before3 = counts.stage1 ?? counts.base
  const hidden = before3 - counts.stage3
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-panel) border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-3 sm:p-4" aria-label="공고 거르기" data-testid="grant-funnel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="t-body inline-flex items-center gap-1.5 font-bold text-violet-900">
          <Filter aria-hidden="true" className="size-4" /> 볼 만한 공고만 거르기
        </h3>
        <Button variant="secondary" onClick={onOpenSettings} data-testid="grant-filter-open">
          기준 바꾸기
        </Button>
      </div>
      <ol className="flex flex-wrap gap-2">
        <Step n="base" label="접수 중" count={counts.base} tone="border-slate-200 bg-white text-slate-800" />
        <Step n="1" label="① 맞는 업체 있음" count={counts.stage1} off={!onlyReach} tone="border-emerald-200 bg-emerald-50 text-emerald-800">
          <label className="tap t-meta -my-1 inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <input type="checkbox" checked={onlyReach} onChange={(e) => onToggleReach(e.target.checked)} className="size-4 accent-emerald-600" data-testid="grant-only-reach" />
            맞는 업체가 있는 공고만
          </label>
        </Step>
        <Step n="2" label={`② 금액 · ${line.stage2}`} count={counts.stage2} off={!settings.on} tone="border-amber-200 bg-amber-50 text-amber-900" />
        <Step n="3" label={`③ ${line.stage3}`} count={counts.stage3} off={!settings.on} tone="border-violet-200 bg-violet-50 text-violet-900" />
      </ol>
      {settings.on && hidden > 0 && (
        <button type="button" onClick={onToggleHidden} aria-pressed={showHidden} data-testid="grant-show-hidden" className="tap t-sub self-start font-semibold text-violet-800 hover:underline">
          {showHidden ? '거른 공고 다시 숨기기' : `거른 공고 ${hidden.toLocaleString()}개도 보기`}
        </button>
      )}
    </section>
  )
}

function Pick<T extends number>({ value, steps, label, onPick, testid }: { value: T; steps: readonly T[]; label: (v: T) => string; onPick: (v: T) => void; testid: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {steps.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onPick(s)}
          data-testid={`${testid}-${s}`}
          className={`tap t-sub rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${value === s ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-violet-300'}`}
        >
          {label(s)}
        </button>
      ))}
    </div>
  )
}

function Check({ checked, onChange, children, testid }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; testid: string }) {
  return (
    <label className="tap t-body inline-flex items-start gap-2 text-slate-800">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-violet-600" data-testid={testid} />
      <span className="break-keep">{children}</span>
    </label>
  )
}

function Block({ tone, title, children }: { tone: string; title: string; children: ReactNode }) {
  return (
    <fieldset className={`flex flex-col gap-2.5 rounded-(--radius-control) border p-3 ${tone}`}>
      <legend className="t-body px-1 font-bold">{title}</legend>
      {children}
    </fieldset>
  )
}

export function GrantFilterSheet({ value, onChange, left, onClose }: { value: GrantFilterSettings; onChange: (v: GrantFilterSettings) => void; left: number; onClose: () => void }) {
  const set = (patch: Partial<GrantFilterSettings>) => onChange({ ...value, ...patch })
  return (
    <BottomSheet
      title="공고 거르기 기준"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-body font-semibold text-slate-800" data-testid="grant-filter-left">
            지금 기준이면 <span className="text-violet-700">{left.toLocaleString()}개</span> 남아요
          </span>
          <Button variant="primary" onClick={onClose}>
            이대로 보기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="grant-filter-sheet">
        <p className="t-sub break-keep text-slate-600">공고 글에 적힌 숫자만 규칙으로 읽습니다. 기업마당 공고는 금액 · 규모가 개요에 없으면 '안 적힘' 으로 봅니다. 기준은 이 브라우저에 기억해요.</p>
        <Check checked={value.on} onChange={(on) => set({ on })} testid="grant-filter-on">
          2차 · 3차 거르기 켜기 <span className="text-slate-500">(끄면 지역 · 업종만 보고 전부 보여요)</span>
        </Check>
        <div className={`flex flex-col gap-4 ${value.on ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!value.on}>
          <Block tone="border-amber-200 bg-amber-50/60 text-amber-950" title="② 금액 — 업체당 최소">
            <Pick value={value.minAmount} steps={AMOUNT_STEPS as readonly number[]} label={(v) => (v === 0 ? '상관없음' : `${manText(v)} 이상`)} onPick={(minAmount) => set({ minAmount })} testid="grant-filter-amount" />
            <Check checked={value.hideNoAmount} onChange={(hideNoAmount) => set({ hideNoAmount })} testid="grant-filter-no-amount">
              금액이 안 적힌 공고도 숨기기
            </Check>
          </Block>
          <Block tone="border-violet-200 bg-violet-50/60 text-violet-950" title="③ 선정 규모 · 경쟁">
            <Pick value={value.minSlots} steps={SLOT_STEPS as readonly number[]} label={(v) => (v === 0 ? '상관없음' : `${v}곳 이상 선정`)} onPick={(minSlots) => set({ minSlots })} testid="grant-filter-slots" />
            <Check checked={value.hideNoSlots} onChange={(hideNoSlots) => set({ hideNoSlots })} testid="grant-filter-no-slots">
              선정 규모가 안 적힌 공고도 숨기기
            </Check>
            <Check checked={value.skipEvents} onChange={(skipEvents) => set({ skipEvents })} testid="grant-filter-events">
              교육 · 설명회 · 행사 · 공모전 · 수요조사 빼기
            </Check>
            <span className="t-sub font-semibold">마감까지 여유</span>
            <Pick value={value.minDays} steps={DAY_STEPS as readonly number[]} label={(v) => (v === 0 ? '상관없음' : `${v}일 이상 남음`)} onPick={(minDays) => set({ minDays })} testid="grant-filter-days" />
          </Block>
        </div>
        <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_GRANT_FILTER })} className="self-start" data-testid="grant-filter-reset">
          <RotateCcw aria-hidden="true" className="size-4" /> 처음 기준으로
        </Button>
      </div>
    </BottomSheet>
  )
}
