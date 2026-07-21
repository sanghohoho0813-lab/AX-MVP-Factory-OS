/**
 * 프로젝트 단계 흐름 레일. "전체 과정에서 어디까지 왔는가"를 한눈에 보여준다.
 * 도메인 규칙은 바꾸지 않고 journeyService 의 현재 단계만 이용해 표시 상태를 계산한다.
 * 데스크톱: 가로 / 모바일: 세로.
 */

import { NavLink } from 'react-router-dom'
import { Check, Circle, Dot, Lock } from 'lucide-react'
import type { FlowStepKey } from '../../services/journeyService'

type StepStatus = 'done' | 'current' | 'next' | 'locked'

interface DisplayStep {
  key: string
  label: string
  path: string
  lockedHint: string
}

function buildSteps(projectId: string, isWebsite: boolean): DisplayStep[] {
  const p = `/`
  void p
  const ax: DisplayStep[] = [
    { key: 'prepare', label: '프로젝트 준비', path: `/projects/${projectId}`, lockedHint: '고객사·프로젝트 등록이 필요합니다.' },
    { key: 'diagnosis', label: '기업 진단', path: `/diagnosis/projects/${projectId}/setup`, lockedHint: '먼저 프로젝트를 준비하세요.' },
    { key: 'selection', label: '핵심 업무 선택', path: `/selection/projects/${projectId}`, lockedHint: '진단 결과 확정이 필요합니다.' },
    { key: 'design', label: '기능·화면 설계', path: `/mvp-design/projects/${projectId}`, lockedHint: '핵심 업무 선택이 필요합니다.' },
    { key: 'validation', label: '실제 사용 테스트', path: `/validation/projects/${projectId}`, lockedHint: '설계 확정이 필요합니다.' },
    { key: 'deliverables', label: '제출자료 만들기', path: `/deliverables/projects/${projectId}`, lockedHint: '앞 단계 결과가 필요합니다.' },
    { key: 'funding', label: '기관·성과 관리', path: `/funding/projects/${projectId}`, lockedHint: '제출자료 준비가 필요합니다.' },
  ]
  if (isWebsite) {
    return [
      ax[0],
      { key: 'diagnosis', label: '홈페이지 진단', path: `/website-studio/projects/${projectId}`, lockedHint: '먼저 프로젝트를 준비하세요.' },
      { key: 'design', label: '홈페이지 설계', path: `/website-studio/projects/${projectId}`, lockedHint: '홈페이지 진단이 필요합니다.' },
      ax[4],
      ax[5],
      ax[6],
    ]
  }
  return ax
}

const ORDER: FlowStepKey[] = ['prepare', 'diagnosis', 'selection', 'design', 'validation', 'deliverables', 'done']

function statusFor(stepKey: string, currentKey: FlowStepKey, isWebsite: boolean): StepStatus {
  const order = isWebsite ? ['prepare', 'diagnosis', 'design', 'validation', 'deliverables', 'funding'] : [...ORDER.slice(0, 6), 'funding']
  const ci = order.indexOf(currentKey === 'done' ? 'funding' : currentKey)
  const si = order.indexOf(stepKey)
  if (si < 0 || ci < 0) return 'locked'
  if (si < ci) return 'done'
  if (si === ci) return 'current'
  if (si === ci + 1) return 'next'
  return 'locked'
}

const DOT: Record<StepStatus, { icon: typeof Check; ring: string; text: string; badge: string }> = {
  done: { icon: Check, ring: 'border-success-500 bg-success-500 text-white', text: 'text-slate-700', badge: '완료' },
  current: { icon: Circle, ring: 'border-brand-600 bg-brand-600 text-white', text: 'text-brand-800 font-semibold', badge: '지금 진행' },
  next: { icon: Dot, ring: 'border-brand-300 bg-white text-brand-500', text: 'text-slate-600', badge: '다음 준비' },
  locked: { icon: Lock, ring: 'border-slate-200 bg-slate-50 text-slate-300', text: 'text-slate-400', badge: '잠김' },
}

export function ProjectStepRail({
  projectId,
  currentStepKey,
  isWebsite,
}: {
  projectId: string
  currentStepKey: FlowStepKey
  isWebsite: boolean
}) {
  const steps = buildSteps(projectId, isWebsite)
  return (
    <ol className="flex flex-col gap-1 md:flex-row md:items-start md:gap-0" aria-label="프로젝트 진행 단계">
      {steps.map((step, i) => {
        const st = statusFor(step.key, currentStepKey, isWebsite)
        const meta = DOT[st]
        const Icon = meta.icon
        const clickable = st !== 'locked'
        const content = (
          <div className="flex items-start gap-2.5 md:flex-col md:items-center md:gap-2 md:text-center">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${meta.ring}`}>
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 md:px-1">
              <p className={`text-[0.95rem] leading-tight ${meta.text}`}>{step.label}</p>
              <p className="mt-0.5 text-[0.8rem] text-slate-400" aria-current={st === 'current' ? 'step' : undefined}>
                {meta.badge}
              </p>
              {st === 'locked' && <p className="mt-0.5 text-[0.78rem] break-keep text-slate-400 md:hidden">{step.lockedHint}</p>}
            </div>
          </div>
        )
        return (
          <li key={`${step.key}-${i}`} className="relative flex-1 md:min-w-0">
            {/* 연결선 (데스크톱) */}
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="absolute top-4 left-1/2 hidden h-0.5 w-full bg-slate-200 md:block" />
            )}
            <div className="relative md:flex md:justify-center">
              {clickable ? (
                <NavLink to={step.path} className="block rounded-lg px-1 py-1 hover:bg-slate-50 md:px-2">
                  {content}
                </NavLink>
              ) : (
                <div className="px-1 py-1 md:px-2" title={step.lockedHint}>{content}</div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
