import type { ReactNode } from "react";

type Tone = "default" | "normal" | "warning" | "danger" | "navy";

const TONE_STYLES: Record<Tone, { value: string; accent: string }> = {
  default: { value: "text-slate-900", accent: "bg-slate-100 text-slate-600" },
  navy: { value: "text-navy-800", accent: "bg-navy-100 text-navy-700" },
  normal: { value: "text-status-normal", accent: "bg-status-normalBg text-status-normal" },
  warning: { value: "text-status-warning", accent: "bg-status-warningBg text-status-warning" },
  danger: { value: "text-status-danger", accent: "bg-status-dangerBg text-status-danger" },
};

export default function MetricCard({
  label,
  value,
  unit,
  tone = "default",
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: string;
  icon?: ReactNode;
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-slate-600 sm:text-base">{label}</p>
        {icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${s.accent}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 sm:mt-3">
        <span className={`text-4xl font-bold tracking-tight sm:text-5xl ${s.value}`}>{value}</span>
        {unit ? <span className="text-sm font-medium text-slate-500 sm:text-base">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-slate-500 sm:text-sm">{hint}</p> : null}
    </div>
  );
}
