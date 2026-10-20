/**
 * D-249 명세서 쓰기 길잡이(규칙 · AI 아님) — 처음 쓰는 사람이 '무엇을 어떻게' 적는지 보면서 쓰게.
 *
 *   견본 발명(공구 마모 예측 — 실제 고객 발명 아님) · 칸마다 예시 · 권리축 '~하는' 끝맺음 고치기 · 아이디어 답 짧음/마케팅 말 ·
 *   본문 칸 권장 길이(대략) · 특허로 제출 전 확인표.
 */
import { checkDraft, claimsOf, emptyDraft, skeletonFromAxis, asAdnominal, titleLine, type SectionKey, type SpecAxis, type SpecDraft, type SpecIdea } from './specDraft'
import type { SpecReport } from './specCheck'

/** 칸마다 예시 — 견본 발명과 같은 글 */
export const IDEA_EXAMPLE: Record<keyof SpecIdea, string> = {
  problem: '가공 현장에서 공구 교체 시점을 작업자의 감으로 정해 불량과 과잉 교체가 반복된다.',
  prior: '종래에는 정해진 사용 시간이 지나면 공구를 일괄 교체하여, 마모가 덜 된 공구도 버리고 마모가 빠른 공구는 불량을 낸다.',
  distinct: '공구별 진동 특성을 기준값과 비교해 마모 단계를 나누고, 다음 작업 일정에 맞춰 교체 시점을 산출한다.',
  flow: '진동 수집 → 측정항목 정규화 → 마모 지수 갱신 → 마모 단계 판정 → 교체 알림 → 교체 결과 재반영',
  point: '마모 지수의 누적 갱신과 작업 일정을 함께 써서 교체 시점을 정하는 연결',
}

export const AXIS_EXAMPLE: Record<keyof SpecAxis, string> = {
  input: '공구의 진동신호를 수집하는',
  process: '진동신호를 측정항목으로 정규화하는',
  state: '측정항목으로 공구별 마모 지수를 누적 갱신하는',
  judge: '마모 지수와 기준값을 비교하여 마모 단계를 판정하는',
  output: '마모 단계와 작업 일정으로 교체 시점을 산출하여 알리는',
  feedback: '교체 결과를 기준값에 다시 반영하는',
  link: '누적 갱신한 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출',
}

export const SAMPLE_SOURCE = '견본 — 연습용(실제 발명 아님)'

/** 견본 명세서 — 1~4단계가 채워진 연습용 초안(본문은 뼈대 그대로 → 5단계에서 연습) */
export function sampleDraft(): SpecDraft {
  const d = emptyDraft()
  d.title = '공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법'
  d.titleEn = 'SYSTEM AND METHOD FOR DETERMINING TOOL WEAR AND REPLACEMENT TIME BASED ON VIBRATION DATA'
  d.idea = { ...IDEA_EXAMPLE }
  d.axis = { ...AXIS_EXAMPLE }
  const sk = skeletonFromAxis(d.axis)
  d.components = sk.components.map((c) => (c.no === '140' ? { ...c, name: '마모판정부' } : c))
  d.steps = sk.steps
  d.systemName = '공구관리 시스템'
  d.seeds = [
    { comp: '140', text: '마모 단계를 정상 · 주의 · 교체의 세 단계로 나누는' },
    { comp: '150', text: '교체 시점을 다음 작업 일정 시작 전으로 앞당겨 알리는' },
  ]
  d.source = SAMPLE_SOURCE
  return d
}

/** 권리축 한 줄 — '~하는' 으로 끝나지 않으면 고친 안(그대로면 null). 연결관계 줄은 문장이어도 된다 */
export function axisEndingFix(key: keyof SpecAxis, text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t || key === 'link') return null
  const bare = t.replace(/[.。]+$/, '').trim()
  if (/는$/.test(bare)) return null
  const fixed = asAdnominal(bare)
  return fixed && fixed !== t ? fixed : null
}

const MARKETING = /혁신적|획기적|최고|최초|세계 유일|완벽|압도적|놀라운|혁명적/

/** 아이디어 답 한 칸 — 짧음 · 마케팅 말(없으면 null) */
export function ideaHint(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (MARKETING.test(t)) return "'혁신적 · 최고' 같은 말은 빼고 무엇을 어떻게 하는지 사실로 적어 주세요 — 명세서에서는 약점이 됩니다"
  if (t.length < 15) return '한 문장만 더 — 누가 · 무엇을 · 왜 불편한지가 들어가면 배경 · 과제 문장이 저절로 나옵니다'
  return null
}

/** 본문 칸 권장 길이(대략 · 막지 않음) — 실제 명세서 · 작성 규칙의 문단 수를 글자로 옮긴 어림값 */
export const SECTION_RANGE: Record<SectionKey, readonly [number, number]> = {
  field: [30, 200],
  background: [300, 1500],
  problem: [120, 800],
  solution: [300, 2500],
  effect: [150, 1000],
  detail: [2000, 9000],
  abstract: [150, 400],
}

export type LengthState = 'empty' | 'short' | 'ok' | 'long'

export function lengthState(key: SectionKey, len: number): LengthState {
  const [min, max] = SECTION_RANGE[key]
  if (len <= 0) return 'empty'
  if (len < min) return 'short'
  if (len > max) return 'long'
  return 'ok'
}

/** 0~1 — 막대 채움(최대의 120% 까지 그린다) */
export function lengthRatio(key: SectionKey, len: number): number {
  const [, max] = SECTION_RANGE[key]
  return Math.max(0, Math.min(1, len / (max * 1.2)))
}

/** 특허로 제출 전 확인표(묶음 안 checklist.txt) — 사람이 마지막에 손으로 볼 것 */
export function submitChecklist(d: SpecDraft, report: SpecReport | null, today: string): string {
  const claims = claimsOf(d)
  const indep = claims.filter((c) => !/^청구항\s*\d+\s*에\s*있어서/.test(c.trim())).length
  const errs = checkDraft(d).filter((i) => i.level === 'error')
  const lines = [
    `특허로 제출 전 확인표 — ${today}`,
    '',
    `발명의 명칭: ${titleLine(d)}`,
    `청구항: ${claims.length}개(독립 ${indep}개 · 종속 ${claims.length - indep}개)`,
    `도면: ${d.figures.length}장 · 대표도 도 ${Math.min(Math.max(1, d.repFig), d.figures.length || 1)}`,
    `초안 점검 고칠 것: ${errs.length}개${errs.length ? ` — ${errs.map((e) => e.text).join(' / ')}` : ''}`,
    `명세서 점검(특허로 서식) 고칠 것: ${report ? report.counts.error : '확인 안 함'}개 · 확인할 것: ${report ? report.counts.warn : '-'}개`,
    '',
    '[ ] 편집기에서 식별항목(【발명의 명칭】 등)을 먼저 만들고, 그 아래 본문만 붙여 넣었다',
    '[ ] 발명의 명칭은 한글명칭{영문명칭} 한 문단이다',
    '[ ] 청구항마다 편집기의 【청구항 n】 아래에 붙였다(청구항 머리 글자를 본문에 직접 쓰지 않았다)',
    '[ ] 도면마다 그림은 1개, 그림 파일은 특허로가 받는 형식으로 바꿨다(fig*.png 는 초안 — 선 · 글자를 다듬는다)',
    '[ ] 대표도에는 평문 "도 n" 만 넣었다',
    '[ ] 편집기 [오류 검사] 를 눌러 오류 코드가 없는지 봤다(명세서 점검 0 은 편집기 통과를 뜻하지 않는다)',
    '[ ] 출원인 · 발명자 정보는 특허로에서 직접 넣는다(이 묶음에는 없다)',
  ]
  return lines.join('\n') + '\n'
}
