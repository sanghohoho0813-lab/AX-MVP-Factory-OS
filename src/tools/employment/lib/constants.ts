/**
 * 고용지원금 매니저 Pro — 상수표.
 *
 * 원본(SubsidyApp.jsx 12~14, 15~20, 51, 110, 112~150, 494 줄)에서 글자 하나 바꾸지 않고 옮겼다.
 * 여기 있는 값은 규칙표다 — 화면에서 고쳐 쓰지 않는다.
 */

export const MIN_WAGE_2026 = 10320
export const MIN_WAGE_MONTH_2026 = 2156880
export const BOSU_FLOOR_2026 = 1240000
/** 100억 — 비정상 입력 방지 상한 */
export const MAX_MONEY = 10000000000

export type ProgramGroup = '신규채용' | '재직자유지' | '육아' | '커스텀'

export interface GroupColor {
  base: string
  light: string
  text: string
  dark: string
  badge: string
  icon: string
}

export const GROUP_COLORS: Record<ProgramGroup, GroupColor> = {
  신규채용: { base: '#2563EB', light: '#DBEAFE', text: '#1D4ED8', dark: '#1E40AF', badge: '#EFF6FF', icon: '🆕' },
  재직자유지: { base: '#475569', light: '#E2E8F0', text: '#334155', dark: '#1E293B', badge: '#F1F5F9', icon: '🔄' },
  육아: { base: '#059669', light: '#D1FAE5', text: '#047857', dark: '#065F46', badge: '#ECFDF5', icon: '🤱' },
  커스텀: { base: '#6B7280', light: '#F1F5F9', text: '#4B5563', dark: '#374151', badge: '#F8FAFC', icon: '⚙️' },
}

/** 업종 선택지 */
export const INDUSTRY_OPTIONS: readonly string[] = [
  '제조업',
  '건설업',
  '도소매업',
  '음식·숙박업',
  '운수·창고업',
  '정보통신업',
  '금융·보험업',
  '부동산업',
  '전문·과학·기술업',
  '교육 서비스업',
  '보건·사회복지업',
  '예술·스포츠·여가업',
  '협회·단체',
  '기타 서비스업',
  '기타/직접입력',
]

export interface Criterion {
  id: string
  label: string
  desc: string
}

/** 취업애로요건 (청년일자리도약장려금 · 1개 이상) */
export const ELIG: readonly Criterion[] = [
  { id: 'e1', label: '실업 4개월 이상', desc: '고용보험 피보험자격 상실 후 연속 4개월 이상 실업' },
  { id: 'e2', label: '고졸 이하 학력', desc: '대학 미진학, 최종학력 고등학교 졸업 이하' },
  { id: 'e3', label: '고용보험 가입 12개월 미만', desc: '생애 전체 고용보험 총 피보험기간 12개월 미만' },
  { id: 'e4', label: '고용촉진장려금 대상자', desc: '취업지원프로그램 이수자' },
  { id: 'e5', label: '국민취업지원제도 참여자', desc: '국취제(I/II유형) 참여' },
  { id: 'e6', label: '청년도전 지원사업 수료자', desc: '청년도전 지원사업 프로그램 수료' },
  { id: 'e7', label: '자립준비청년', desc: '보호종료 청년' },
  { id: 'e8', label: '북한이탈청년', desc: '북한이탈주민 중 청년' },
  { id: 'e9', label: '폐업 경험 청년', desc: '창업 후 폐업 경험(2년 이내)' },
  { id: 'e10', label: '기타 장관 인정', desc: '기타 고용노동부 장관이 취업애로청년으로 인정' },
]

/** 제외요건 (전부 "해당 아님"이어야 한다) */
export const EXCL: readonly Criterion[] = [
  { id: 'x1', label: '재학 중이 아닐 것', desc: '정규 교육기관 재학 중 제외' },
  { id: 'x2', label: '사업주 가족이 아닐 것', desc: '배우자·직계존비속·형제자매 제외' },
  { id: 'x3', label: '외국인이 아닐 것', desc: '외국인 제외(F-2,F-5,F-6 예외)' },
  { id: 'x4', label: '중복수급이 아닐 것', desc: '타 고용지원금과 중복수급 불가' },
  { id: 'x5', label: '자영업자·사업자가 아닐 것', desc: '사업자등록증 소지자 제외' },
]

export type StatusKey = 'preparing' | 'submitted' | 'reviewing' | 'approved' | 'inprogress' | 'completed' | 'resigned'

export interface StatusDef {
  key: StatusKey
  label: string
  color: string
  bg: string
  icon: string
}

/** 진행 단계 7개 */
export const STS: readonly StatusDef[] = [
  { key: 'preparing', label: '준비중', color: '#64748B', bg: '#F1F5F9', icon: '⏳' },
  { key: 'submitted', label: '서류접수', color: '#2563EB', bg: '#EFF6FF', icon: '📨' },
  { key: 'reviewing', label: '심사중', color: '#475569', bg: '#E2E8F0', icon: '🔍' },
  { key: 'approved', label: '승인', color: '#059669', bg: '#ECFDF5', icon: '✅' },
  { key: 'inprogress', label: '지급중', color: '#2563EB', bg: '#DBEAFE', icon: '💸' },
  { key: 'completed', label: '최종지급완료', color: '#059669', bg: '#D1FAE5', icon: '🎉' },
  { key: 'resigned', label: '퇴사', color: '#94A3B8', bg: '#F1F5F9', icon: '🚪' },
]

/** 진행 보드 단계별 컬러 (단계 구분을 강하게 — 컬럼 헤더 채움 + 카드 톤) */
export const KANBAN_COL: Record<StatusKey, { main: string; soft: string; border: string }> = {
  preparing: { main: '#64748B', soft: '#F8FAFC', border: '#E2E8F0' }, // 준비중 · 회색
  submitted: { main: '#2563EB', soft: '#EFF6FF', border: '#DBEAFE' }, // 서류접수 · 파랑
  reviewing: { main: '#7C3AED', soft: '#F5F3FF', border: '#E9D5FF' }, // 심사중 · 보라
  approved: { main: '#059669', soft: '#ECFDF5', border: '#A7F3D0' }, // 승인 · 초록
  inprogress: { main: '#0D9488', soft: '#F0FDFA', border: '#99F6E4' }, // 지급중 · 청록
  completed: { main: '#15803D', soft: '#F0FDF4', border: '#BBF7D0' }, // 최종지급완료 · 진초록
  resigned: { main: '#94A3B8', soft: '#F8FAFC', border: '#E2E8F0' }, // 퇴사 · 연회색
}

export type DiagCatId = '청년' | '여성' | '고령자' | '장애인' | '취약계층' | '일반'

export interface DiagCat {
  id: DiagCatId
  label: string
  icon: string
}

/** 채용 진단 — 채용 대상자 유형 */
export const DIAG_CATS: readonly DiagCat[] = [
  { id: '청년', label: '청년 (만 15~34세)', icon: '🧑' },
  { id: '여성', label: '경력단절 여성', icon: '👩' },
  { id: '고령자', label: '만 60세 이상', icon: '👴' },
  { id: '장애인', label: '장애인', icon: '♿' },
  { id: '취약계층', label: '취업취약계층(프로그램 이수)', icon: '🪪' },
  { id: '일반', label: '해당 없음/일반', icon: '👤' },
]

/** 채용 진단 — 상황별 구체 조건 (HiringDiagnosis SPECIAL_OPTIONS 그대로) */
export const SPECIAL_OPTIONS_RETAIN: readonly { id: string; label: string }[] = [
  { id: '정규직전환', label: '비정규직→정규직 전환' },
  { id: '정년도달', label: '정년 도달 직원' },
  { id: '유연근무', label: '유연근무 도입' },
  { id: '주4.5일제', label: '주 4.5일제 도입(20인↑)' },
]
export const SPECIAL_OPTIONS_CHILDCARE: readonly { id: string; label: string }[] = [
  { id: '육아휴직', label: '직원 육아휴직' },
  { id: '근로시간단축', label: '육아기 근로시간 단축' },
  { id: '대체인력', label: '빈자리 대체 채용' },
  { id: '업무분담', label: '동료 업무분담' },
]
