/**
 * D-690 고객 화면(My MIRAE) 켜짐 점검 · 첫 주 숫자 — 대표가 운영 SQL(0033 ~ 0036)을 넣은 뒤 앱 안에서 바로 확인한다.
 *
 *  1) 켜짐 점검 — 기능마다 가장 가벼운 읽기 한 번(아무것도 쓰지 않는다). 서버 답의 모양으로 켜짐 · 꺼짐 · 모름을 가른다.
 *     고객 함수(0035)는 대표가 부르면 '그 연결의 고객 아님(not found)' 으로 막히는데, 그것이 곧 '있고 · 부를 수 있다' 는 뜻이다.
 *  2) 첫 주 숫자 — 연결된 고객 계정 · 고객 화면에 와 본 계정 · 발행한 보고서 · 열어 본 · 확인한 보고서 · 문의(D-691) · 올라와 있는 추천 · 관심.
 *     계획서 '운영 적용 뒤 첫 주 지켜보기'(시범 고객 1곳 → 보고서 1편 → 열람 · 확인 · 문의가 실제로 들어오는지)를 한 줄씩.
 * 대표 화면에만(운영자 말을 써도 되는 곳). 규칙 계산이다 — AI 아님.
 */
export type FeatureState = 'on' | 'off' | 'unknown'

export interface GrowthFeature {
  key: '0033' | '0034' | '0035' | '0036'
  label: string
  state: FeatureState
}

export const GROWTH_FEATURE_LABEL: Record<GrowthFeature['key'], string> = {
  '0033': '보고서 발행 · 열어 봄 · 확인',
  '0034': '결과 자료 열람 기록',
  '0035': "고객 화면 '새 결과 자료'",
  '0036': "고객 화면 '담당자가 추천해요'",
}

/**
 * 서버 답 → 켜짐 · 꺼짐 · 모름.
 *  - 오류 없음 · '그 연결의 고객 아님'(P0002 · not found) → 켜짐(있고 부를 수 있다)
 *  - 함수 · 표 없음(PGRST202 · PGRST205 · 42883 · 42P01 · could not find · schema cache) · 실행 · 읽기 권한 없음(되돌림) → 꺼짐
 *  - 그 밖(끊김 · 로그인 만료 …) → 모름(꺼졌다고 하지 않는다)
 */
export function probeState(error: unknown): FeatureState {
  if (error === null || error === undefined) return 'on'
  const o = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
  const msg = [o.message, o.code, o.details, o.hint].filter((v) => typeof v === 'string').join(' ') || String(error)
  if (o.code === 'P0002' || /\bnot found\b/i.test(msg)) return 'on'
  if (/PGRST20[25]|42883|42P01|could not find the (?:function|table)|schema cache|does not exist|permission denied for (?:function|table) portal_/i.test(msg)) return 'off'
  return 'unknown'
}

export interface FirstWeekInput {
  links: readonly { id: string; status: string }[]
  /** 고객 화면에 와 본 연결 id(home 기록) */
  visited: ReadonlySet<string>
  reports: readonly { id: string; status: string }[]
  /** 열어 본 · 확인한 보고서 id(누구라도) */
  reportSeen: ReadonlySet<string>
  reportAcked: ReadonlySet<string>
  recosShown: number
  interests: number
  /** D-691 고객이 남긴 문의(작업공간 전체) — 못 읽었으면 null */
  asks: { total: number; open: number } | null
}

export interface FirstWeekStep {
  key: string
  label: string
  done: boolean
  /** 숫자 한 마디 */
  value: string
}

/** 첫 주 지켜보기 — 연결 → 첫 방문 → 보고서 → 열어 봄 → 확인 → 문의 → 추천 관심(차례대로 · 숫자는 실제 기록) */
export function firstWeekSteps(i: FirstWeekInput): FirstWeekStep[] {
  const active = i.links.filter((l) => l.status === 'active')
  const visited = active.filter((l) => i.visited.has(l.id)).length
  const published = i.reports.filter((r) => r.status === 'published')
  const seen = published.filter((r) => i.reportSeen.has(r.id)).length
  const acked = published.filter((r) => i.reportAcked.has(r.id)).length
  return [
    { key: 'link', label: '고객 계정 연결', done: active.length > 0, value: `${active.length}개` },
    { key: 'visit', label: '고객이 고객 화면에 와 봄', done: visited > 0, value: `${visited}개 계정` },
    { key: 'report', label: '보고서 발행', done: published.length > 0, value: `${published.length}편` },
    { key: 'seen', label: '고객이 보고서를 열어 봄', done: seen > 0, value: `${seen}편` },
    { key: 'ack', label: "고객이 [확인했어요]", done: acked > 0, value: `${acked}편` },
    // D-691 계획서 '열람 · 확인 · 문의가 실제로 들어오는지' 의 문의 — 답을 기다리는 것이 있으면 그 수도
    { key: 'ask', label: '고객이 문의를 남김', done: (i.asks?.total ?? 0) > 0, value: i.asks ? `${i.asks.total}건${i.asks.open ? ` · 답 기다림 ${i.asks.open}` : ''}` : '확인 못 함' },
    { key: 'reco', label: "추천에 [관심 있어요]", done: i.interests > 0, value: `추천 ${i.recosShown}개 · 관심 ${i.interests}` },
  ]
}

/** 꺼진 것이 있을 때 대표가 할 일 한 줄 */
export function growthFixText(features: readonly GrowthFeature[]): string | null {
  const off = features.filter((f) => f.state === 'off')
  if (!off.length) return null
  return `꺼진 것 ${off.map((f) => f.key).join(' · ')} — Supabase SQL Editor 에 apply_0033_0036_all.sql(저장소 supabase/manual)을 통째로 붙여 실행하세요. 여러 번 실행해도 같고, 넣은 뒤 이 점검을 다시 누르면 돼요.`
}
