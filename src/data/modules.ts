import {
  BarChart3,
  Building2,
  ClipboardList,
  Filter,
  FolderOpen,
  Palette,
  PencilRuler,
  SearchCheck,
  Settings,
} from 'lucide-react'
import type { ModulePageConfig } from '../types'

/** 홈 이외 메뉴의 빈 상태(준비 중) 페이지 정의 */
export const MODULE_PAGES: ModulePageConfig[] = [
  {
    key: 'diagnosis',
    path: '/diagnosis',
    title: '진단 스튜디오',
    description:
      '업종 맞춤 설문과 인터뷰로 고객사의 업무·데이터 상태를 진단하고 AX 적합성을 분석합니다.',
    upcomingFeatures: [
      '업종별 현장진단 설문 템플릿',
      '업무·데이터 성숙도 진단 결과 산출',
      'AX 적합성 분석 리포트 생성',
    ],
    icon: ClipboardList,
  },
  {
    key: 'selection',
    path: '/selection',
    title: 'AX 과제선별 보드',
    description:
      '진단 결과를 기준으로 구축 가치가 높은 자동화 과제만 MVP 후보로 좁힙니다.',
    upcomingFeatures: [
      '가중치 기반 선별 기준 설정',
      '과제 우선순위 매트릭스',
      'MVP 후보 선정과 보류 관리',
    ],
    icon: Filter,
  },
  {
    key: 'mvp-design',
    path: '/mvp-design',
    title: 'MVP 설계 워크벤치',
    description:
      '선별된 AX 과제를 현장에서 검증 가능한 최소 기능 단위로 설계합니다.',
    upcomingFeatures: [
      '핵심 기능 설계도와 흐름 정의',
      '범위 가드레일(Must/Should/Later) 관리',
      '검증 기준(수용 기준) 정의',
    ],
    icon: PencilRuler,
  },
  {
    key: 'website-studio',
    path: '/website-studio',
    title: '웹사이트 디자인 스튜디오',
    description:
      '기업과 브랜드의 특성을 입력하면 반응형 홈페이지의 디자인 가이드와 개발 프롬프트를 설계합니다.',
    upcomingFeatures: [
      '홈페이지 목적과 브랜드 정보 입력',
      '섹션·컬러·이미지·모션 방향 생성',
      'Claude Code용 홈페이지 개발 프롬프트 출력',
    ],
    icon: Palette,
  },
  {
    key: 'validation',
    path: '/validation',
    title: '현장검증 트래커',
    description:
      '실제 담당자가 사용할 수 있는지 단계별 테스트와 피드백으로 검증합니다.',
    upcomingFeatures: [
      '검증 회차별 시나리오·이슈 관리',
      '현장 피드백 수집과 액션 아이템 추적',
      '검증 지표(시간 절감·오류 감소) 집계',
    ],
    icon: SearchCheck,
  },
  {
    key: 'deliverables',
    path: '/deliverables',
    title: '자금조달 자료 패키지',
    description:
      '진단·설계·검증 결과를 정책자금과 기술보증 제출자료로 전환합니다.',
    upcomingFeatures: [
      '증빙 라이브러리와 제출본 생성',
      '제출 적합성 체크리스트 점수화',
      '추천 지원사업 매칭',
    ],
    icon: FolderOpen,
  },
  {
    key: 'clients',
    path: '/clients',
    title: '고객사 관리',
    description:
      '고객사 등록부터 단계별 진행 현황, 담당자와 이력을 한곳에서 관리합니다.',
    upcomingFeatures: [
      '고객사 등록과 기본 정보 관리',
      '프로젝트 단계·진행률 추적',
      '담당자·미팅 이력 기록',
    ],
    icon: Building2,
  },
  {
    key: 'reports',
    path: '/reports',
    title: '리포트',
    description:
      '프로젝트 성과와 운영 지표를 요약해 내부 보고와 기관 평가 자료로 활용합니다.',
    upcomingFeatures: [
      '주간·월간 운영 리포트',
      '고객사별 성과 지표 대시보드',
      '기관 평가용 데이터 축적 현황',
    ],
    icon: BarChart3,
  },
  {
    key: 'settings',
    path: '/settings',
    title: '설정',
    description:
      '워크스페이스, 구성원, 알림 등 운영 환경을 관리합니다.',
    upcomingFeatures: [
      '워크스페이스·구성원 관리',
      '알림·이메일 설정',
      '진단 템플릿 기본값 관리',
    ],
    icon: Settings,
  },
]
