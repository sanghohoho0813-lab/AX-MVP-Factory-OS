import type { InternalMember } from '../types/domain'

/** 내부 담당자 데모 데이터 (이번 단계에서는 고정 목록) */
export const INTERNAL_MEMBERS: InternalMember[] = [
  {
    id: 'member-kim',
    name: '김팀장',
    role: 'AX랩 대표',
    email: 'kim@axlab.example.com',
    avatarInitial: '김',
  },
  {
    id: 'member-park',
    name: '박지훈',
    role: 'AX 기획',
    email: 'park@axlab.example.com',
    avatarInitial: '박',
  },
  {
    id: 'member-choi',
    name: '최유진',
    role: '프로젝트 매니저',
    email: 'choi@axlab.example.com',
    avatarInitial: '최',
  },
  {
    id: 'member-lee',
    name: '이상훈',
    role: '현장검증',
    email: 'lee@axlab.example.com',
    avatarInitial: '이',
  },
]

export function getMemberById(id: string): InternalMember | null {
  return INTERNAL_MEMBERS.find((m) => m.id === id) ?? null
}

export function memberName(id: string): string {
  return getMemberById(id)?.name ?? '미지정'
}
