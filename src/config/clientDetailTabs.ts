/**
 * 업체 상세 탭 목록 — 업체 화면(OperationsClientDetailPage)과 경로 줄(D-235 wayfinding)이 같이 읽는다.
 *
 * D-129: 매일 쓰는 순서 — 개요 → 서류 → 업무 → 업무 일기 → 고객 플랫폼 → 수금.
 * 컨설팅(특허·MVP) · 자금·지원은 기본 줄에서 뺐다(hidden) — 기능 · 데이터 · 주소(?tab=)는 그대로이고, 더보기에서 연다.
 * 예전 '파일' 탭은 서류 탭 안으로 들어갔다(?tab=files 는 서류로 연다).
 */
export type ClientDetailTab = 'smart' | 'overview' | 'work' | 'consulting' | 'docs' | 'fees' | 'funding' | 'portal' | 'journal' | 'ai'

export const CLIENT_DETAIL_TABS: { key: ClientDetailTab; label: string; hidden?: boolean }[] = [
  // D-144: 개요 왼쪽 — 서류를 올리면 모든 모듈 판정 · 다음 행동이 여기 먼저(규칙 계산이라 'AI' 라고 부르지 않는다)
  { key: 'smart', label: '맞춤 추천' },
  { key: 'overview', label: '개요' },
  { key: 'docs', label: '서류' },
  { key: 'work', label: '업무' },
  { key: 'journal', label: '업무 일기' },
  { key: 'portal', label: '고객 플랫폼' },
  { key: 'fees', label: '수금' },
  { key: 'consulting', label: '컨설팅', hidden: true },
  // D-151: 공고에서 '신청 준비' 를 건 업체는 줄에 보인다(아래 showTab)
  { key: 'funding', label: '지원사업 신청', hidden: true },
  // 대표 AI 작업실 — 기본 줄에 없고(탭 순서 그대로) 더보기에서 연다. 대표 전용
  { key: 'ai', label: 'AI 작업실', hidden: true },
]

/** 탭 이름(주소 ?tab= 값 → 화면 이름). 모르는 값 · 없으면 개요 */
export function clientTabLabel(tab: string | null | undefined): string {
  const key = tab === 'files' ? 'docs' : tab
  return CLIENT_DETAIL_TABS.find((t) => t.key === key)?.label ?? '개요'
}
