import type { ReactNode } from 'react'

interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[13px] break-keep text-slate-500">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2">
        {children}
      </div>
    </section>
  )
}
