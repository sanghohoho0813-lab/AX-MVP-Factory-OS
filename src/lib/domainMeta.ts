import {
  Archive,
  Building2,
  CircleDot,
  FilePen,
  FolderPlus,
  Globe,
  Layers,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProjectStage, StatusTone } from '../types'
import type {
  ActivityType,
  BusinessType,
  MvpLevel,
  OrganizationStatus,
  ProjectStatus,
  ProjectType,
} from '../types/domain'

/* ------------------------------------------------------------------ */
/* 고객사 상태                                                          */
/* ------------------------------------------------------------------ */

export const ORG_STATUS_META: Record<
  OrganizationStatus,
  { label: string; tone: StatusTone }
> = {
  active: { label: '진행 고객', tone: 'info' },
  prospect: { label: '상담 중', tone: 'neutral' },
  paused: { label: '일시 중단', tone: 'warning' },
  archived: { label: '보관됨', tone: 'neutral' },
}

export const BUSINESS_TYPE_META: Record<BusinessType, { label: string }> = {
  corporation: { label: '법인' },
  sole_proprietor: { label: '개인사업자' },
  medical: { label: '의료법인' },
  nonprofit: { label: '비영리' },
  other: { label: '기타' },
}

/* ------------------------------------------------------------------ */
/* 프로젝트 상태·유형                                                   */
/* ------------------------------------------------------------------ */

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; tone: StatusTone }
> = {
  planned: { label: '준비 중', tone: 'neutral' },
  active: { label: '진행 중', tone: 'info' },
  waiting_client: { label: '고객 응답 대기', tone: 'warning' },
  on_hold: { label: '보류', tone: 'warning' },
  completed: { label: '완료', tone: 'success' },
  archived: { label: '보관됨', tone: 'neutral' },
}

export const PROJECT_TYPE_META: Record<
  ProjectType,
  { label: string; shortLabel: string; tone: StatusTone; icon: LucideIcon; codePrefix: string }
> = {
  ax: { label: 'AX 프로그램', shortLabel: 'AX', tone: 'info', icon: Sparkles, codePrefix: 'AX' },
  ax_website: {
    label: 'AX 프로그램 + 기업 홈페이지',
    shortLabel: 'AX+홈페이지',
    tone: 'accent',
    icon: Layers,
    codePrefix: 'HYB',
  },
  website: {
    label: '기업 홈페이지 단독',
    shortLabel: '홈페이지',
    tone: 'accent',
    icon: Globe,
    codePrefix: 'WEB',
  },
}

/* ------------------------------------------------------------------ */
/* 단계 흐름 — 프로젝트 유형별 사용 단계                                  */
/* ------------------------------------------------------------------ */

export const STAGE_FLOW_BY_TYPE: Record<ProjectType, ProjectStage[]> = {
  ax: ['intake', 'diagnosis', 'selection', 'mvp_design', 'validation', 'deliverables', 'completed'],
  ax_website: [
    'intake',
    'diagnosis',
    'selection',
    'mvp_design',
    'website_design',
    'validation',
    'deliverables',
    'completed',
  ],
  website: ['intake', 'website_design', 'validation', 'deliverables', 'completed'],
}

/** 단계별 다음 모듈 안내 (경로가 null이면 아직 이동할 모듈 없음) */
export const STAGE_NEXT_MODULE: Record<
  ProjectStage,
  { path: string | null; moduleName: string; guide: string }
> = {
  intake: {
    path: '/diagnosis',
    moduleName: '진단 스튜디오',
    guide: '진단 스튜디오에서 대표자용·현장 담당자용 설문을 준비하세요.',
  },
  diagnosis: {
    path: '/diagnosis',
    moduleName: '진단 스튜디오',
    guide: '진단 스튜디오에서 현장진단을 진행하고 결과를 정리하세요.',
  },
  selection: {
    path: '/selection',
    moduleName: '과제선별',
    guide: '과제선별 보드에서 구축 가치가 높은 과제를 선별하세요.',
  },
  mvp_design: {
    path: '/mvp-design',
    moduleName: 'MVP 설계',
    guide: 'MVP 설계 워크벤치에서 검증 가능한 최소 기능을 설계하세요.',
  },
  website_design: {
    path: '/website-studio',
    moduleName: '웹사이트 스튜디오',
    guide: '웹사이트 스튜디오에서 디자인 가이드와 개발 프롬프트를 설계하세요.',
  },
  validation: {
    path: '/validation',
    moduleName: '현장검증',
    guide: '현장검증 트래커에서 회차별 테스트와 피드백을 관리하세요.',
  },
  deliverables: {
    path: '/deliverables',
    moduleName: '자료 패키지',
    guide: '자료 패키지에서 정책자금·기술보증 제출자료를 준비하세요.',
  },
  completed: {
    path: null,
    moduleName: '완료',
    guide: '모든 단계가 완료된 프로젝트입니다. 유지관리와 후속 프로젝트를 검토하세요.',
  },
}

/* ------------------------------------------------------------------ */
/* MVP 레벨 — 홈페이지 단독 프로젝트는 제작 수준 라벨로 번역               */
/* ------------------------------------------------------------------ */

export const MVP_LEVELS: MvpLevel[] = [0, 1, 2, 3, 4, 5]

export const MVP_LEVEL_META: Record<
  MvpLevel,
  { label: string; websiteLabel: string }
> = {
  0: { label: 'Level 0 · 진단·아이디어', websiteLabel: '방향 설정' },
  1: { label: 'Level 1 · 클릭형 프로토타입', websiteLabel: '디자인 시안' },
  2: { label: 'Level 2 · MVP-lite', websiteLabel: '반응형 구현' },
  3: { label: 'Level 3 · 실사용 MVP', websiteLabel: '운영 적용' },
  4: { label: 'Level 4 · AX 운영 시스템', websiteLabel: '고도화' },
  5: { label: 'Level 5 · 사업화·확장형', websiteLabel: '확장·연계' },
}

export function mvpLevelLabel(level: MvpLevel, type: ProjectType): string {
  return type === 'website'
    ? MVP_LEVEL_META[level].websiteLabel
    : MVP_LEVEL_META[level].label
}

/** 프로젝트 유형에 따른 수준 필드 명칭 */
export function levelFieldLabel(type: ProjectType): string {
  return type === 'website' ? '제작 수준' : 'MVP 레벨'
}

/* ------------------------------------------------------------------ */
/* 활동 유형                                                            */
/* ------------------------------------------------------------------ */

export const ACTIVITY_TYPE_META: Record<
  ActivityType,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  organization_created: { label: '고객사 등록', tone: 'info', icon: Building2 },
  organization_updated: { label: '고객사 수정', tone: 'neutral', icon: FilePen },
  project_created: { label: '프로젝트 생성', tone: 'info', icon: FolderPlus },
  project_updated: { label: '프로젝트 수정', tone: 'neutral', icon: FilePen },
  status_changed: { label: '상태 변경', tone: 'warning', icon: RefreshCw },
  stage_changed: { label: '단계 변경', tone: 'success', icon: CircleDot },
  archived: { label: '보관 처리', tone: 'neutral', icon: Archive },
}

/* ------------------------------------------------------------------ */
/* 자금조달 목표 기관                                                    */
/* ------------------------------------------------------------------ */

export const TARGET_INSTITUTIONS = [
  '신용보증기금',
  '기술보증기금',
  '중소벤처기업진흥공단',
  '소상공인시장진흥공단',
  '창업지원사업',
  'R&D 지원사업',
  '지자체 지원사업',
  '기타',
] as const
