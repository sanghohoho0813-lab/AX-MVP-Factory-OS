/**
 * D-282 특허 · 벤처 단계 표시 — 회사 고르기 → 아이디어 → 특허 명세서 → 점검 → 벤처 사업계획서.
 *
 * 규칙 계산(AI 아님). 진행판(pvBoard)이 이미 계산한 값만 읽고, 명세서 · 점검 · 사업계획서 셋은 준비 현황(pvBrief)과
 * **같은 규칙**이다(두 곳이 다르게 말하지 않게):
 *   회사       = 회사를 골랐는가
 *   아이디어   = 명세서 초안이 있고 첫 단계(아이디어)를 넘겼는가
 *   특허 명세서 = 여섯 단계를 다 채웠는가(끝) · 초안이 있는가(진행 중)
 *   점검       = 명세서를 다 쓴 뒤 고칠 것(error)이 0 인가(끝) · 남았는가(진행 중)
 *   사업계획서 = 칸을 다 채웠는가(끝) · 손댔는가(진행 중)
 * 화면의 '지금 단계' = 진행 중인 첫 단계, 없으면 끝나지 않은 첫 단계.
 */
import type { PvBoardRow } from './pvBoard'
import { PV_HOME, planHref, specHref } from './pvBoard'

export type PvStepKey = 'company' | 'idea' | 'spec' | 'check' | 'plan'
/** 준비 현황과 같은 낱말 상태 */
export type PvStepWord = 'done' | 'doing' | 'todo'

export interface PvStep {
  key: PvStepKey
  label: string
  word: PvStepWord
  /** 화면 표시(지금 단계 강조) */
  state: 'done' | 'current' | 'todo'
  note: string
  /** 누르면 갈 곳(없으면 글자만) */
  href: string | null
}

const WORD: Record<PvStepWord, string> = { done: '끝', doing: '진행 중', todo: '아직' }

export function pvSteps(clientId: string, row: PvBoardRow | null, companyName = ''): PvStep[] {
  const spec = row?.spec ?? null
  const plan = row?.plan ?? null
  const specDone = !!spec && spec.done === spec.total
  const words: Record<PvStepKey, PvStepWord> = {
    company: clientId ? 'done' : 'todo',
    idea: spec ? (spec.step !== 'idea' ? 'done' : 'doing') : 'todo',
    spec: specDone ? 'done' : spec ? 'doing' : 'todo',
    check: !specDone ? 'todo' : spec.errors > 0 ? 'doing' : 'done',
    plan: plan?.complete ? 'done' : plan ? 'doing' : 'todo',
  }
  const withWord = (w: PvStepWord, text: string) => `${WORD[w]}${text ? ` · ${text}` : ''}`
  const base: Omit<PvStep, 'state' | 'word'>[] = [
    { key: 'company', label: '회사 고르기', note: clientId ? companyName || row?.companyName || '골랐음' : '위에서 회사 고르기', href: null },
    { key: 'idea', label: '아이디어', note: spec ? (words.idea === 'done' ? '정리됨' : '적는 중') : '새 명세서에서 시작', href: spec ? specHref(spec.id, clientId, 'idea') : `${PV_HOME}/write` },
    { key: 'spec', label: '특허 명세서', note: withWord(words.spec, spec ? `${spec.done}/${spec.total}단계` : ''), href: spec ? specHref(spec.id, clientId, spec.step) : null },
    { key: 'check', label: '점검', note: withWord(words.check, !specDone ? '' : spec.errors > 0 ? `고칠 것 ${spec.errors}` : '고칠 것 0'), href: spec ? specHref(spec.id, clientId, 'check') : null },
    { key: 'plan', label: '벤처 사업계획서', note: withWord(words.plan, plan ? `서술 ${plan.narrative}/${plan.narrativeTotal}` : ''), href: clientId ? planHref(clientId) : null },
  ]
  const doing = base.findIndex((s) => words[s.key] === 'doing')
  const current = doing >= 0 ? doing : base.findIndex((s) => words[s.key] !== 'done')
  return base.map((s, i) => ({ ...s, word: words[s.key], state: words[s.key] === 'done' ? 'done' : i === current ? 'current' : 'todo' }))
}
