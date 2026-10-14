/**
 * 스킬 서재 — 화면 쪽 이름표(서버 api/_ai/skills.js 와 id · version · tier 가 같아야 한다 — 단위 시험이 맞춘다).
 * 지시문(systemInstruction)은 서버에만 둔다. 화면은 이름 · 설명 · 빠른 작업 단추 · 고를 것만 안다.
 */
import type { SkillId, Tier } from './types'

export interface SkillMeta {
  id: SkillId
  name: string
  version: number
  tier: Exclude<Tier, 'manual'>
  description: string
}

export const SKILL_META: Record<SkillId, SkillMeta> = {
  AX_PENGUIN: { id: 'AX_PENGUIN', name: 'AX 전략 분석', version: 1, tier: 'deep', description: '돈 버는 방식부터 12단계로 생각해 가장 추천하는 AX 1개와 차선' },
  AX_IDEA: { id: 'AX_IDEA', name: 'AX 아이템 발굴', version: 1, tier: 'standard', description: '해 볼 만한 AX 아이템 후보(빨리 되는 것 표시)' },
  AX_MVP: { id: 'AX_MVP', name: 'MVP 구체화', version: 1, tier: 'standard', description: '채택한 AX 를 MVP 범위 · 기능 · 화면 · 단계로' },
  AX_FRONT: { id: 'AX_FRONT', name: 'AX 화면 기획', version: 1, tier: 'standard', description: 'PC 대시보드 1개 + 모바일 핵심 화면 2개(글자는 OS 가 그림)' },
  SANGHO_PROPOSAL: { id: 'SANGHO_PROPOSAL', name: '제안서 구성', version: 1, tier: 'standard', description: '페이지 구성 · 제목 · 메시지 · 핵심 수치 → 제안서 스튜디오에서 실제 글자로' },
  PATENT_IDEA: { id: 'PATENT_IDEA', name: '특허 아이디어', version: 1, tier: 'deep', description: '채택한 AX 로 특허 아이디어 정리(변리사 검토 전 내부용)' },
  VENTURE_PLAN: { id: 'VENTURE_PLAN', name: '벤처기업확인 사업계획', version: 1, tier: 'deep', description: '기업인증 벤처 패키지와 같은 9칸으로 사업계획 논리' },
  FUNDING_STRATEGY: { id: 'FUNDING_STRATEGY', name: '정책자금 · 정부지원 전략', version: 1, tier: 'deep', description: '항목마다 근거 종류 표시 · 최신 자료 확인 필요 표시' },
  CONSULTANT_MESSAGE: { id: 'CONSULTANT_MESSAGE', name: '동료 전달문구', version: 1, tier: 'cheap', description: '카톡에 바로 붙일 요약 — 300자 · 500자 · 자세히' },
  FREE_CHAT: { id: 'FREE_CHAT', name: '자유 AI 작업', version: 1, tier: 'standard', description: '이 업체 기억이 붙은 자유 질문' },
  CONTEXT_UPDATE: { id: 'CONTEXT_UPDATE', name: '기억 정리', version: 1, tier: 'cheap', description: '채택한 결과를 기억 칸에 맞게 정리(확인 뒤 저장)' },
  PROOFREAD: { id: 'PROOFREAD', name: '맞춤법 · 오타 검사', version: 1, tier: 'cheap', description: '제안서 글의 맞춤법 · 오타만' },
  SNAPSHOT_EXTRACT: { id: 'SNAPSHOT_EXTRACT', name: '자료 요약 · 정보 추출', version: 1, tier: 'cheap', description: '올린 자료 요약 · 업체 기본 정보(없으면 미확인)' },
}

export const TIER_LABEL: Record<Tier, string> = { cheap: '빠르게', standard: '보통', deep: '깊게', manual: '붙여넣기' }

/** 빠른 작업 10가지(대표 지시 순서) — 모두 같은 업체 기억을 쓴다 */
export interface QuickAction {
  key: string
  label: string
  skill: SkillId
  /** 한 줄 설명(단추 아래) */
  hint: string
  /** 고를 것 */
  choices?: { key: string; label: string; options: { value: string; label: string }[]; initial: string }[]
  /** 직접 적는 칸(자유 작업 · 제안 목적 등) */
  ask?: { label: string; placeholder: string; required?: boolean }
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { key: 'ax', label: 'AX 전략 분석', skill: 'AX_PENGUIN', hint: '가장 추천하는 AX 1개 + 차선', ask: { label: '더 볼 점(선택)', placeholder: '예: 영업 쪽 업무를 먼저 보고 싶어요' } },
  { key: 'idea', label: 'AX 아이템 발굴', skill: 'AX_IDEA', hint: '해 볼 만한 아이템 후보' },
  { key: 'mvp', label: 'MVP 구체화', skill: 'AX_MVP', hint: '채택한 AX 를 만들 범위로', ask: { label: '어느 AX 로(선택 · 비우면 채택한 것)', placeholder: '예: 견적 자동 작성' } },
  { key: 'patent', label: '특허 아이디어', skill: 'PATENT_IDEA', hint: '내부 정리용 · 변리사 검토 필요' },
  { key: 'venture', label: '벤처 사업계획', skill: 'VENTURE_PLAN', hint: '벤처기업확인 9칸 논리' },
  { key: 'funding', label: '정책자금 · 지원 전략', skill: 'FUNDING_STRATEGY', hint: '근거 종류 · 최신 확인 표시' },
  {
    key: 'proposal',
    label: '제안서 구성',
    skill: 'SANGHO_PROPOSAL',
    hint: '페이지 구성 → 실제 글자로 그림',
    choices: [{ key: 'pages', label: '페이지 수', options: [{ value: '5', label: '5장' }, { value: '8', label: '8장' }, { value: '10', label: '10장' }], initial: '5' }],
    ask: { label: '목적 · 대상(선택)', placeholder: '예: 대표 미팅용 AX 도입 제안' },
  },
  { key: 'front', label: 'AX 화면 기획', skill: 'AX_FRONT', hint: 'PC 1개 + 모바일 2개 화면' },
  {
    key: 'message',
    label: '동료 전달문구',
    skill: 'CONSULTANT_MESSAGE',
    hint: '카톡에 바로 붙이기',
    choices: [{ key: 'length', label: '길이', options: [{ value: '300', label: '300자' }, { value: '500', label: '500자' }, { value: 'detail', label: '자세히' }], initial: '300' }],
    ask: { label: '받는 사람(선택)', placeholder: '예: 김○○ 팀장' },
  },
  { key: 'free', label: '자유 AI 작업', skill: 'FREE_CHAT', hint: '이 업체 기억이 붙은 질문', ask: { label: '물어볼 것', placeholder: '예: 이 회사 대표 미팅 전에 물어볼 질문 만들어줘', required: true } },
]

export function skillName(id: string): string {
  return (SKILL_META as Record<string, SkillMeta | undefined>)[id]?.name ?? id
}
