/**
 * 기능 상태표 — 무엇이 실제로 돌아가고(LIVE), 무엇이 연결만 준비됐고(READY),
 * 무엇이 아직 없는지(NEXT)를 한 곳에 적는다.
 *
 * 규격(v3.0 §15)이 요구하는 것은 하나다: 시연·설정·설명 어디에서도 이 셋을
 * 섞어 말하지 않는 것. 그래서 화면 문구가 아니라 여기서 목록으로 관리한다.
 * '향후 확장' 화면과 '기획의도' 화면이 이 목록을 그대로 읽는다.
 */

import type { DataMode } from '../data/dataMode'

export type CapabilityLevel = 'live' | 'ready' | 'next'

export const CAPABILITY_LEVEL_LABEL: Record<CapabilityLevel, string> = {
  live: 'LIVE · 실제로 쓰는 중',
  ready: 'READY · 연결 준비됨',
  next: 'NEXT · 아직 없음',
}

export interface Capability {
  key: string
  label: string
  level: CapabilityLevel
  /** 한 줄 설명 — 중학생도 알아듣게 */
  note: string
}

/**
 * 지금 있는 것. 데이터 모드에 따라 LIVE/READY 가 달라지는 항목만 분기한다.
 *   local    : 이 브라우저에만 저장. 고객 플랫폼 왕복은 샘플로만 돈다.
 *   supabase : 클라우드 저장. 고객 플랫폼과 실제로 이어진다.
 */
export function currentCapabilities(mode: DataMode): Capability[] {
  const cloud = mode === 'supabase'
  return [
    { key: 'today', label: '오늘 화면 (지금 이것부터 · 숫자 · 빠른 기록)', level: 'live', note: '규칙으로 순서를 정한다. AI 판단이 아니다.' },
    { key: 'clients', label: '고객 운영 (업체별 현황표 · 업무 6종 + 직접 추가)', level: 'live', note: '마감·서류·수금 경고가 자동으로 붙는다.' },
    { key: 'detail', label: '업체 상세 (업무 · 서류 · 수금 · 자금 · 기록 · 파일)', level: 'live', note: '상태를 바꾸면 활동 기록이 자동으로 남는다.' },
    { key: 'journal', label: '업무 일기 (통화 · 결정 · 후속조치 · 막힘)', level: 'live', note: '고객에게는 어떤 경로로도 보이지 않는다.' },
    { key: 'calendar', label: '일정 (마감 · 신청 · 수금 · 서류 만료)', level: 'live', note: '모든 업체의 날짜를 한 달력에서 본다.' },
    { key: 'funding', label: '자금 · 지원사업 신청 건별 관리', level: 'live', note: '마감 14일 전부터 오늘 화면에 올라온다.' },
    { key: 'ocr', label: '서류에서 회사 정보 읽어오기 (OCR)', level: 'live', note: '읽은 값은 사람이 확인한 뒤에만 저장된다.' },
    { key: 'backup', label: '백업 내려받기 · 불러오기', level: 'live', note: '파일 하나로 전체를 되살릴 수 있다.' },
    { key: 'theme', label: '화면 색 9종 · 글자 크기 3단계 · 움직임 줄이기', level: 'live', note: '본문 글자색은 어떤 테마에서도 바뀌지 않는다.' },
    { key: 'mobile', label: '휴대폰 화면 (하단 내비 · 한 손 조작)', level: 'live', note: '360px · 글자 1.3배에서도 잘리지 않는다.' },
    {
      key: 'bridge_in',
      label: '고객 플랫폼 → 이벤트함 (요청 · 서류 · 주문이 자동으로 들어옴)',
      level: cloud ? 'live' : 'ready',
      note: cloud ? '2026-09-04 실제 왕복 확인 완료.' : '로컬 데모에서는 샘플 이벤트로만 볼 수 있다.',
    },
    {
      key: 'bridge_out',
      label: '이벤트함 → 고객 플랫폼 (내가 발행한 업데이트가 고객 화면에)',
      level: cloud ? 'live' : 'ready',
      note: cloud ? '초안은 고객에게 보이지 않고, 발행한 것만 보인다.' : '로컬 데모에서는 미리보기로만 확인한다.',
    },
    { key: 'custom_services', label: '업무 항목 직접 추가', level: cloud ? 'ready' : 'live', note: cloud ? '클라우드 표(ops_custom_services)를 만든 뒤 LIVE 가 된다.' : '이 브라우저에 저장된다.' },
    { key: 'studio', label: 'AX 스튜디오 (진단 · 선별 · 설계 · 검증 · 결과자료)', level: 'live', note: '고객사 AX 프로젝트를 만들 때 쓰는 전문 도구.' },
  ]
}

/** 아직 없는 것 — 메뉴에는 NEXT 로만 보이고, 현재 기능처럼 말하지 않는다 */
export interface FutureItem {
  key: string
  label: string
  /** 무엇을 만들 것인가 */
  what: string
  /** 왜 지금이 아닌가 */
  whyNotNow: string
  /** 언제 다시 볼 것인가 */
  revisitWhen: string
}

export const FUTURE_ITEMS: FutureItem[] = [
  {
    key: 'notify',
    label: '고객 알림 보내기 (이메일 · 카카오)',
    what: '내가 업데이트를 발행하면 고객에게 "확인해 보세요" 알림이 간다. 지금은 고객이 직접 들어와야 안다.',
    whyNotNow: '발송 채널 비용과 수신 동의 절차가 먼저 정해져야 한다. 알림 없이도 왕복 자체는 이미 돌아간다.',
    revisitWhen: '고객 플랫폼에 들어오는 요청이 주 5건을 넘을 때.',
  },
  {
    key: 'llm_summary',
    label: '하루 정리를 글로 풀어 주는 AI',
    what: '지금의 하루 정리는 규칙으로 뽑은 목록이다. 이것을 사람이 쓴 것처럼 문장으로 정리해 준다.',
    whyNotNow: '목록만으로 충분히 읽힌다. 근거 없는 요약이 되지 않도록 어떤 기록을 썼는지 함께 보여주는 방식부터 정해야 한다.',
    revisitWhen: '하루 기록이 평균 10건을 넘어 목록이 길어질 때.',
  },
  {
    key: 'team_journal',
    label: '직원별 업무 일기 (팀)',
    what: '직원이 생기면 각자 기록을 남기고, 대표는 업체별로 모아 본다.',
    whyNotNow: '지금은 대표 혼자 쓴다. 직원 계정 없이 만들면 쓰이지 않는 기능이 된다.',
    revisitWhen: '두 번째 사용자(직원)가 생길 때.',
  },
  {
    key: 'share_results',
    label: '결과자료를 고객 화면에 자동으로 올리기',
    what: 'AX 스튜디오에서 만든 결과자료를 버튼 하나로 고객 My MIRAE 에 올린다.',
    whyNotNow: '어떤 자료를 고객에게 보여도 되는지 기준을 먼저 정해야 한다. 내부 메모가 섞여 나가면 안 된다.',
    revisitWhen: '결과자료를 고객에게 보내는 일이 월 3건을 넘을 때.',
  },
  {
    key: 'saas',
    label: '다른 컨설팅 회사용으로 분리 (SaaS)',
    what: '이 시스템의 브랜드·업무 종류·메뉴를 바꿔 다른 법인컨설팅 회사도 쓰게 한다.',
    whyNotNow: '먼저 우리 회사에서 매일 쓰이고 지표가 쌓여야 한다. 쓰이지 않는 것을 팔 수는 없다.',
    revisitWhen: '두 번째 고객사(다른 컨설팅 법인)가 확정될 때.',
  },
]
