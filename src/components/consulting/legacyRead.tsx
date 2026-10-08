/**
 * 예전 벤처 기록 읽기 화면 부품 (D-179) — 입력칸 대신 읽기용 글. 비어 있으면 '기록 없음'.
 */
import type { ReactNode } from 'react'
import { Surface } from '../ui/primitives'

export function ReadValue({ value, empty = '기록 없음' }: { value: string | null | undefined; empty?: string }) {
  const v = (value ?? '').trim()
  return v ? <span className="whitespace-pre-wrap break-words text-slate-800">{v}</span> : <span className="text-slate-400">{empty}</span>
}

export function ReadRow({ label, value, testid, extra }: { label: string; value: string | null | undefined; testid?: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5" data-testid={testid}>
      <dt className="t-sub flex flex-wrap items-center gap-1.5 font-semibold text-slate-600">
        {label}
        {extra}
      </dt>
      <dd className="t-body">
        <ReadValue value={value} />
      </dd>
    </div>
  )
}

export function ReadSection({ title, meta, children, testid }: { title: string; meta?: string; children: ReactNode; testid?: string }) {
  return (
    <Surface>
      <div className="flex flex-col gap-1" data-testid={testid}>
        <h3 className="t-card flex flex-wrap items-baseline gap-x-2 text-slate-900">
          {title}
          {meta && <span className="t-sub font-normal text-slate-500">{meta}</span>}
        </h3>
        {children}
      </div>
    </Surface>
  )
}
