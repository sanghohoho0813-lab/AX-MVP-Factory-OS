/**
 * D-246 벤처 사업계획서 AI 초안 — 대표만(서버 /api/ai-assist 가 대표 권한을 다시 본다).
 *
 * 한 번에 다 쓰지 않고 여섯 번으로 나눠 차례로 부른다 — 서버 함수가 60초 안에 답해야 해서 긴 칸은 한 번에 두 개까지, 요약은 마지막:
 *   p1 [1] 1 개발 배경 · [1] 2 경쟁력     p2 [1] 3-1 추진 경과 · 3-2 향후 3년
 *   g1 [2] 1 목표시장 · [2] 2 경쟁사       g2 [2] 3 추진경과 · 향후 3년
 *   x  [1] 4 기업가정신 · [2] 5 자금운용   sum 신청기술명 · 기술 요약 · 핵심 요약(빈칸 문장)
 * 보내는 것: 특허 명세서 요약(사람이 확인한 재료) · AX/MVP 분석 · 컨설턴트 메모 · 업체 사실 · 이미 쓴 칸(이야기가 이어지게).
 * 사람 이름 · 연락처는 보내지 않는다(서버가 한 번 더 지운다).
 */
import type { AssistAnswer } from '../../services/aiAssist/client'
import type { AssistContext, AssistRow } from '../../services/aiAssist/context'
import { VPLAN_FIELD, VPLAN_FIELDS, type DraftItem, type VPlanBatch, type VPlanFacts, type VPlanState } from '../core/venturePlan'

export const VPLAN_BATCHES: readonly { key: VPlanBatch; assistId: string; label: string }[] = [
  { key: 'p1', assistId: 'venture.p1', label: '[1] 개발 배경 · 경쟁력' },
  { key: 'p2', assistId: 'venture.p2', label: '[1] 기술개발 경과 · 3년 계획' },
  { key: 'g1', assistId: 'venture.g1', label: '[2] 목표시장 · 경쟁사' },
  { key: 'g2', assistId: 'venture.g2', label: '[2] 시장진입 경과 · 3년 계획' },
  { key: 'x', assistId: 'venture.x', label: '[1] 기업가정신 · [2] 자금운용' },
  { key: 'sum', assistId: 'venture.sum', label: '요약 · 핵심 요약' },
]

export const fieldsOfBatch = (b: VPlanBatch) => VPLAN_FIELDS.filter((f) => f.batch === b)

/** 600자씩 끊어 자료 줄로(서버가 메모 줄은 600자까지 받는다) */
function chunks(text: string, size = 560): string[] {
  const out: string[] = []
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  let cur = ''
  for (const l of lines) {
    if ((cur + '\n' + l).length > size && cur) {
      out.push(cur)
      cur = ''
    }
    if (l.length > size) {
      for (let i = 0; i < l.length; i += size) out.push(l.slice(i, i + size))
      continue
    }
    cur = cur ? `${cur}\n${l}` : l
  }
  if (cur) out.push(cur)
  return out
}

const rowsOfText = (text: string, label: string): AssistRow[] => chunks(text).map((memo, i) => ({ part: `${label} ${i + 1}`, memo }))

export function factLines(f: VPlanFacts, extra: string[] = []): string[] {
  const out = [`회사명: ${f.companyName || '미확인'}`]
  if (f.industryText) out.push(`업종: ${f.industryText}`)
  out.push(`지식재산권(회사 정보): ${f.patents == null ? '미확인' : `${f.patents}건`}`)
  out.push(`연구개발 조직: ${f.researchUnit === 'lab' ? '기업부설연구소' : f.researchUnit === 'dept' ? '연구개발전담부서' : f.researchUnit === 'none' ? '없음' : '미확인'}`)
  out.push(`연구개발 인원: ${f.researchers == null ? '미확인' : `${f.researchers}명`}`)
  if (f.rndExpense != null) out.push(`직전 연도 연구개발비: ${Math.round(f.rndExpense).toLocaleString('ko-KR')}원`)
  if (f.patentTitle) out.push(`특허(출원) 명칭: ${f.patentTitle}`)
  return [...out, ...extra]
}

/** 이 묶음 칸의 규칙(쓰는 순서 · 하지 말 것 · 체크 선택지 · 문장 틀) */
function batchRules(b: VPlanBatch): string[] {
  const out: string[] = []
  for (const f of fieldsOfBatch(b)) {
    out.push(`칸 ${f.id} = ${f.no} ${f.title}${f.limit ? ` (${f.limit}자 안 · 850~950자 권장)` : ''}`)
    for (const g of f.guide) out.push(`  ${f.id} 쓸 것: ${g}`)
    for (const a of f.avoid ?? []) out.push(`  ${f.id} 하지 말 것: ${a}`)
    if (f.checks) out.push(`  ${f.id} 체크박스 선택지(근거 있는 것만 tag 에 쉼표로): ${f.checks.join(' / ')}`)
    if (f.template) out.push(`  ${f.id} 문장 틀(［ ］ 빈칸만 채우고 나머지 글자는 그대로): ${f.template}`)
  }
  return out
}

export const VENTURE_RULES = [
  '벤처기업확인(혁신성장유형) 신청 사이트의 사업계획서 칸을 쓴다. 심사위원 · 현장실사 담당자가 읽는다.',
  '특허 · AX(MVP) · 벤처 사업계획서가 한 이야기여야 한다: [자료 · 특허 명세서] 의 기술(청구항 · 해결 수단)이 [자료 · AX · MVP] 의 실제 제품 · 서비스로 구현되고 그것이 시장으로 간다.',
  '특허는 출원 상태 그대로 쓴다(등록 · 보유라고 쓰지 않는다). 명세서에 없는 기능을 특허 기술이라고 쓰지 않는다.',
  '실제로 한 일(구현 · 매출 · 고객 · 인원)은 [자료] 에 있는 것만. 없으면 그 문장을 빼거나 "~할 계획" 으로. 숫자를 만들지 않는다.',
  '시장 규모 · 성장률은 [자료 · 컨설턴트 메모] 에 출처와 함께 있을 때만. 없으면 "(시장 규모 확인 필요)" 처럼 표시한다.',
  '문체는 "~합니다" 또는 "~함" 중 사이트 칸에 맞게 — 서술 칸은 "~합니다", 핵심 요약 문장 틀은 틀 그대로("~음 · ~됨").',
  '마크다운(#, **, 목록 기호)을 쓰지 않는다. 문단 사이는 빈 줄 하나.',
  '출력: items 에 칸마다 하나 — title = 칸 id 그대로(예: development_background), body = 본문, tag = 고른 체크박스(쉼표로 · 체크 칸만), detail = 근거가 모자라 확인이 필요한 점(짧게 · 없으면 빈 글).',
]

/** 묶음 하나의 보낼 자료 */
export function buildBatchContext(input: { batch: VPlanBatch; state: VPlanState; facts: VPlanFacts; today: string }): AssistContext {
  const { batch, state, facts, today } = input
  const mine = new Set(fieldsOfBatch(batch).map((f) => f.id))
  const written: AssistRow[] = []
  for (const f of VPLAN_FIELDS) {
    if (mine.has(f.id)) continue
    const t = (state.text[f.id] ?? '').trim()
    if (!t) continue
    for (const [i, c] of chunks(t).entries()) written.push({ part: `${f.id}${i ? ` (이어서)` : ''} · ${f.title}`, memo: c })
  }
  const sections = [
    { name: '특허 명세서(출원본 · 사람이 확인한 요약)', rows: rowsOfText(state.materials.patent, '명세서') },
    { name: 'AX · MVP(실제 구현 · 계획)', rows: rowsOfText(state.materials.ax, 'AX') },
    { name: '컨설턴트 메모(확인된 사실 · 숫자 · 출처)', rows: rowsOfText(state.materials.memo, '메모') },
    { name: '이미 쓴 칸(이야기를 이어 갈 것)', rows: written },
  ]
  return {
    title: '벤처기업확인 사업계획서',
    today,
    purpose: `이번에 쓸 칸: ${[...mine].map((id) => VPLAN_FIELD[id].title).join(' · ')}`,
    sections,
    facts: factLines(facts),
    rules: [...VENTURE_RULES, ...batchRules(batch)],
  }
}

/** 답 → 칸. title 이 id 가 아니면 칸 이름으로 찾는다 */
export function draftItemsOf(answer: AssistAnswer | null, batch: VPlanBatch): DraftItem[] {
  if (!answer) return []
  const mine = fieldsOfBatch(batch)
  const out: DraftItem[] = []
  for (const it of answer.items ?? []) {
    const key = (it.title ?? '').trim()
    const f = mine.find((x) => x.id === key) ?? mine.find((x) => key && (x.title.includes(key) || key.includes(x.title)))
    if (!f) continue
    // detail 은 '확인할 점' — 본문으로 쓰지 않는다
    const body = (it.body ?? '').trim()
    if (!body) continue
    const checks = (it.tag ?? '').split(/[,，·|]/).map((x) => x.trim()).filter(Boolean)
    const note = (it.detail ?? '').trim()
    out.push({ id: f.id, text: body, checks: f.checks ? checks : undefined, note: note || undefined })
  }
  return out
}
