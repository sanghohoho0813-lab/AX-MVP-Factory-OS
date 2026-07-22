/**
 * 화면 상태 안내 공통 컴포넌트 (Stage 12B-UX 5차).
 * '기능 없음 / 데이터 없음 / 선행단계 필요 / 고급 기능 / 로컬 모드'를
 * 사용자가 혼동하지 않게 한 가지 형식으로 안내한다.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Cloud, Layers, Lock, PackageOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../ui/Button'

function NoticeFrame({
  icon: Icon,
  badge,
  title,
  description,
  bullets,
  actionLabel,
  actionPath,
  tone = 'slate',
}: {
  icon: LucideIcon
  badge: string
  title: string
  description: string
  /** 왜 잠겼는지·무엇이 없는지·완료 시 무엇이 열리는지 */
  bullets?: string[]
  actionLabel?: string
  actionPath?: string
  tone?: 'slate' | 'brand' | 'warning'
}) {
  const navigate = useNavigate()
  const toneCls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50/50'
      : tone === 'warning'
        ? 'border-warning-200 bg-warning-50/50'
        : 'border-slate-200 bg-white'
  return (
    <section className={`rounded-(--radius-panel) border p-6 shadow-(--shadow-card) ${toneCls}`}>
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.82rem] font-semibold tracking-wide text-slate-500">{badge}</p>
          <h2 className="mt-0.5 text-[1.15rem] font-bold break-keep text-slate-900">{title}</h2>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed break-keep text-slate-600">{description}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-1.5 text-[0.9rem] break-keep text-slate-500">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-slate-300" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {actionLabel && actionPath && (
            <Button variant="primary" className="mt-4" onClick={() => navigate(actionPath)}>
              <span className="whitespace-normal">{actionLabel}</span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

/** 선행조건 미충족 — 왜 잠겼고 무엇을 먼저 해야 하는지 */
export function PrerequisiteNotice({
  title,
  description,
  missing,
  unlocks,
  actionLabel,
  actionPath,
}: {
  title: string
  description: string
  /** 어떤 데이터·결과가 아직 없는지 */
  missing?: string[]
  /** 완료하면 무엇이 열리는지 */
  unlocks?: string
  actionLabel: string
  actionPath: string
}) {
  const bullets = [
    ...(missing ?? []).map((m) => `아직 없음: ${m}`),
    ...(unlocks ? [`완료하면: ${unlocks}`] : []),
  ]
  return (
    <NoticeFrame
      icon={Lock}
      badge="이전 단계가 필요함"
      title={title}
      description={description}
      bullets={bullets}
      actionLabel={actionLabel}
      actionPath={actionPath}
      tone="brand"
    />
  )
}

/** 결과 데이터 없음 — 기능은 있으나 아직 만들 결과가 없을 때 */
export function MissingResultNotice({
  title,
  description,
  howToCreate,
  actionLabel,
  actionPath,
}: {
  title: string
  description: string
  /** 어떻게 하면 결과가 생기는지 */
  howToCreate?: string[]
  actionLabel?: string
  actionPath?: string
}) {
  return (
    <NoticeFrame
      icon={PackageOpen}
      badge="아직 결과가 없음"
      title={title}
      description={description}
      bullets={howToCreate}
      actionLabel={actionLabel}
      actionPath={actionPath}
    />
  )
}

/** 고급 운영 기능 안내 — core 모드에서 고급 라우트 직접 접근 시 */
export function AdvancedFeatureNotice({
  featureName,
  whenToUse,
}: {
  featureName: string
  whenToUse: string
}) {
  return (
    <NoticeFrame
      icon={Layers}
      badge="고급 운영 기능"
      title={`${featureName}은(는) 프로젝트 후반에 사용하는 고급 운영 기능입니다.`}
      description={whenToUse}
      bullets={[
        '기본 흐름(진단 → 업무 선택 → 설계 → 결과자료)을 먼저 진행하는 것을 권장합니다.',
        '설정에서 "고급 운영 기능 보기"를 켜면 메뉴에 항상 표시됩니다.',
      ]}
      actionLabel="설정에서 고급 기능 표시 켜기"
      actionPath="/settings"
    />
  )
}

/** 로컬 모드 제약 안내 — 외부 공유·협업이 필요한 기능 */
export function LocalModeNotice({ context }: { context?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <Cloud aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-warning-600" />
      <p className="min-w-0 text-[0.9rem] leading-relaxed break-keep text-warning-800">
        <span className="font-semibold">현재 로컬 모드</span> — 이 브라우저에만 저장됩니다.
        {context ? ` ${context}` : ''} 다른 기기에서 사용하거나 여러 명이 함께 쓰려면 클라우드 연결이 필요합니다.
      </p>
    </div>
  )
}
