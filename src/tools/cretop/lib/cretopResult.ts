/**
 * 크레탑 분석 결과의 모양 (D-121 — salesCretop 에서 옮김).
 *
 * 전략 순위(이름 · 점수 · 이유 · 보유) · 1장 요약 글 · 업체 기록에 붙일 때의 모양.
 * 크레탑 분석기 본체에 속한다 — OS(업체 · 영업 · 저장소)를 모른다. 단독 판매 때 그대로 간다.
 */
import { buildDiagnosisSummary, buildOneLiner, oneLinerText, rankStrategies, type CretopRanked, type CretopTone } from '../mini/analysisCore.js'
import { isCorpOnlyStrategy } from '../mini/extract.js'
import type { CretopMiniUi } from '../mini/MiniApp.jsx'

/** 고객 기록에 남기는 짧은 순위 한 줄 — 이름으로 전략 원문(질문 흐름 · 멘트 …)을 다시 찾는다 */
export interface CretopPickRef {
  name: string
  score: number
  reasons: string[]
  held: boolean
}

/** 개인사업자면 법인 전용 전략은 뺀다(크레탑 분석기 제안 탭과 같다) */
export function rankedRefs(ui: CretopMiniUi): CretopPickRef[] {
  const personal = !!(ui.bizForm as { isPersonal?: boolean } | undefined)?.isPersonal
  return rankStrategies(ui)
    .filter((r: CretopRanked) => !(personal && isCorpOnlyStrategy(r.s.name)))
    .map((r) => ({ name: r.s.name, score: r.score, reasons: r.reasons.slice(0, 3), held: r.held }))
}

/** 붙이는 쪽(OS 의 도구 결과)이 받는 모양 — 여기서는 OS 타입을 부르지 않고 모양만 맞춘다 */
export interface CretopResultInput {
  toolKey: 'cretop'
  title: string
  verdict: null
  verdictLabel: string
  summary: string
  data: CretopResultData
}

export const CRETOP_RESULT_TITLE = '크레탑 분석'

/** 1장 요약 글 — 크레탑 분석기 결과 막대의 '1장 요약 복사' 와 같은 글 */
export function cretopSummaryText(ui: CretopMiniUi, selected: string[] = [], extraLines: string[] = []): string {
  return [
    oneLinerText(buildOneLiner(ui)),
    ...(selected.length ? ['', '■ 최종 선택 컨설팅 항목', ...selected.map((n, i) => `${i + 1}. ${n}`)] : []),
    ...(extraLines.length ? ['', ...extraLines] : []),
    '',
    '※ 크레탑 원문 기준 참고용 분석이며, 실제 상담 전 원문 확인이 필요합니다.',
  ].join('\n')
}

export interface CretopResultData {
  companyInfo: unknown
  corePreview: unknown
  oneLiner: ReturnType<typeof buildOneLiner>
  selected: string[]
  stockValue: unknown
  /** D-119: 26개 전략 순위(이름 · 점수 · 이유 · 보유) — 미팅 준비가 질문 흐름을 다시 꺼낸다 */
  ranked?: CretopPickRef[]
  /** D-119: 진단 요약(위험 · 주의 · 기회 · 참고) */
  diagnosis?: { text: string; tone: CretopTone }[]
}

export function cretopResultInput(
  ui: CretopMiniUi,
  selected: string[] = [],
  extra: { stockValue?: unknown; extraLines?: string[] } = {},
): CretopResultInput {
  const one = buildOneLiner(ui)
  const data: CretopResultData = {
    companyInfo: ui.companyInfo,
    corePreview: ui.corePreview,
    oneLiner: one,
    selected,
    stockValue: extra.stockValue ?? null,
    ranked: rankedRefs(ui),
    diagnosis: buildDiagnosisSummary(ui),
  }
  return {
    toolKey: 'cretop',
    title: CRETOP_RESULT_TITLE,
    verdict: null,
    verdictLabel: one.risks[0] ?? '',
    summary: cretopSummaryText(ui, selected, extra.extraLines ?? []),
    data,
  }
}
