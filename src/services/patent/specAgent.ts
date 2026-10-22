/**
 * D-252 AI 가 다 쓰는 명세서 — 대표: "하나하나 다 타자로 입력하는 거는 절대 없어야 돼. 조사해줘 · 아이디어 내줘 하면 LLM 이 MD 파일이랑 연계해서 최적의 결과".
 *
 * 단계(칸 단추 하나 = 단계 하나 · [전부 써줘] = 필요한 단계를 차례로):
 *   idea      아이디어 내줘   — 회사 기록 · 재료(AI 작업실 · 올린 자료)로 아이디어 3개 → 비어 있으면 추천 1번을 바로 채움
 *   research  조사해줘        — 선행기술 · 차별화 메모(검색 근거가 붙으면 출처) → 청구항 · 해결 수단이 이 차별화를 쓴다
 *   parts     구성 · 단계 써줘 — 권리축 7줄 · 시스템 이름 · 구성요소 · 단계 · 종속항 씨앗(부호는 OS 가 110 부터)
 *   a~e       본문 · 청구항   — D-247 의 다섯 묶음 그대로(specDraftAi)
 *   fix       점검대로 고쳐줘 — 규칙 점검(checkDraft · checkSpec)에서 걸린 칸만 다시
 * 기준 문서(내부 기준 문서 · 내부 기준 문서)는 서버가 단추마다 붙인다(api/_ai/knowledge.js) — 여기서는 자료만 보낸다.
 * 사람이 고친 칸은 덮지 않는다(본문 · 청구항은 새 안으로 · 구성은 그대로 두고 알림). 규칙 점검은 AI 가 아니다.
 */
import type { AssistAnswer, AssistItem, AssistRun } from '../aiAssist/client'
import { judgeLine, judgePassed } from '../aiAssist/judge'
import type { AssistContext, AssistRow } from '../aiAssist/context'
import { safeText } from '../aiAssist/context'
import { checkSpec, type SpecReport } from './specCheck'
import { parseSpecText } from './specParse'
import {
  AXIS_LABEL,
  SECTION_KEYS,
  SECTION_LABEL,
  asAdnominal,
  checkDraft,
  cleanAiText,
  IDEA_MAX,
  claimsOf,
  isSentenceName,
  mergeSpecAi,
  nameFromSentence,
  sectionOf,
  specMarkdown,
  titleLine,
  titleParts,
  type IdeaPick,
  type SectionKey,
  type SpecAxis,
  type SpecDraft,
  type SpecIdea,
  type SpecResearch,
} from './specDraft'
import { SPEC_BATCHES, paraChunks, paraRows, researchRows, type SpecBatch } from './specDraftAi'

export { paraChunks, researchRows }

export type AgentStage = 'idea' | 'ideaRank' | 'ideaMore' | 'research' | 'parts' | 'judge1' | SpecBatch | 'judge2' | 'fix'

/** 작업판의 칸(카드) — 단계 여럿이 한 칸이 되기도 한다 */
export type AgentCard = 'idea' | 'research' | 'parts' | 'body' | 'claims' | 'judge' | 'check'

export const STAGES: readonly { key: AgentStage; card: AgentCard; assistId: string; label: string; seconds: number }[] = [
  { key: 'idea', card: 'idea', assistId: 'spec.idea', label: '아이디어 5개 · 순위', seconds: 40 },
  // D-269 기획 — 후보 가운데 무엇이 가장 나은지 · 자체점검으로 더 날카로운 것 짜내기(대표가 누를 때만)
  { key: 'ideaRank', card: 'idea', assistId: 'spec.ideaRank', label: '후보 중 가장 나은 것', seconds: 30 },
  { key: 'ideaMore', card: 'idea', assistId: 'spec.ideaMore', label: '자체점검으로 더 짜내기', seconds: 40 },
  { key: 'research', card: 'research', assistId: 'spec.research', label: '선행기술 · 차별화 조사', seconds: 40 },
  { key: 'parts', card: 'parts', assistId: 'spec.parts', label: '권리축 · 구성요소 · 단계', seconds: 30 },
  // D-263 자체점검 — 구성 뒤 · 청구항 뒤에 반드시(판정 + 직접 고침)
  { key: 'judge1', card: 'judge', assistId: 'spec.judge', label: '자체점검 ① 구성 · 권리축', seconds: 40 },
  ...SPEC_BATCHES.map((b) => ({ key: b.key as AgentStage, card: (b.key === 'e' ? 'claims' : 'body') as AgentCard, assistId: b.assistId, label: b.label, seconds: 30 })),
  { key: 'judge2', card: 'judge', assistId: 'spec.judge', label: '자체점검 ② 명세서 전체', seconds: 50 },
  { key: 'fix', card: 'check', assistId: 'spec.fix', label: '점검대로 고치기', seconds: 40 },
]

export const stageOf = (k: AgentStage) => STAGES.find((s) => s.key === k)!

export const CARD_STAGES: Record<AgentCard, AgentStage[]> = {
  idea: ['idea'],
  research: ['research'],
  parts: ['parts'],
  body: ['a', 'b', 'c', 'd'],
  claims: ['e'],
  judge: ['judge1', 'judge2'],
  check: ['fix'],
}

/* ------------------------------------------------------------------ */
/* 회사 · 재료(화면이 모아 준다)                                          */
/* ------------------------------------------------------------------ */

export interface AgentCompany {
  name: string
  /** '업종: 제조업' 처럼 한 줄씩 — 사람 이름 · 연락처는 넣지 않는다 */
  facts: string[]
  /** AI 작업실 자료 · 올린 파일에서 읽은 글 */
  materials: { title: string; kind: string; text: string }[]
  /** AI 작업실 '특허 아이디어' 결과 제목 · 핵심(있으면) */
  priorIdeas: string[]
}

export const EMPTY_COMPANY: AgentCompany = { name: '', facts: [], materials: [], priorIdeas: [] }

/** 560자씩(서버가 메모 줄은 600자까지 받는다) */
function chunks(text: string, size = 560): string[] {
  const out: string[] = []
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < t.length; i += size) out.push(t.slice(i, i + size))
  return out
}

/** D-268 출원서에 들어가는 그대로 "한글 명칭{영문 명칭}" 한 줄 — 두 줄로 보냈더니 자체점검이 "영문 명칭이 분리됨" P0 를 냈다 */
const titleRow = (d: SpecDraft): AssistRow => ({ part: 'title{titleEn}', memo: titleLine(d) || '(없음)' })

const WHOLE_TEXT_RULES = [
  '[자료 · 명세서 지금 글] 은 칸마다 글 전체를 문단 한 줄씩 보낸 것이다("(이어서 n)" = 같은 칸의 n번째 문단). 서버가 길이 때문에 줄인 곳은 "(n건 더 — 줄임)" 으로만 표시된다 — 줄인 곳을 "글이 중간에 끝남" 으로 판정하지 않는다.',
  '명칭은 출원서에 "한글 명칭{영문 명칭}" 한 줄로 들어간다(화면은 title · titleEn 두 칸으로 받을 뿐 — 형식 문제 아님). 고칠 때는 title · titleEn 두 칸으로 나눠 낸다(중괄호 없이).',
]

const IDEA_LABEL: Record<keyof SpecIdea, string> = { problem: '① 현재 문제', prior: '② 기존 방식', distinct: '③ 차별 구조', flow: '④ 처리 흐름', point: '⑤ 권리화 포인트' }

function ideaRows(d: SpecDraft): AssistRow[] {
  return (Object.keys(IDEA_LABEL) as (keyof SpecIdea)[]).filter((k) => d.idea[k].trim()).flatMap((k) => chunks(d.idea[k]).map((memo) => ({ part: IDEA_LABEL[k], memo })))
}

/** 재료는 자료마다 앞쪽 4,480자(줄 8개)까지 — 자료 여섯 개(D-269 기획은 회사 이야기가 전부라 예전 2,240자에서 늘림) */
function materialRows(c: AgentCompany): AssistRow[] {
  return c.materials.slice(0, 6).flatMap((m) => chunks(safeText(m.text, [], 4480)).slice(0, 8).map((memo, i) => ({ part: `${m.kind}${i ? ' (이어서)' : ''}`, name: m.title.slice(0, 60), memo })))
}

/** 회사가 무엇을 하는지 알려 주는 기록 줄(매출 · 지역 · 설립만으로는 발명을 떠올릴 수 없다) */
const DESCRIBES = /^(?:업종|업태|종목|홈페이지|상담 메모):/

/**
 * D-269 AI 가 읽을 회사 이야기가 없나 — 업종 · 업태 · 종목 · 홈페이지 · 상담 메모 · 자료 · AI 작업실 아이디어가 모두 없으면.
 * 대표: "자료가 없으면 일단은 자료를 넣어 달라고 하고" — 이때는 아이디어를 내지 않고 회사 정보부터 받는다.
 */
export function companyThin(c: AgentCompany): boolean {
  return !c.facts.some((f) => DESCRIBES.test(f)) && !c.materials.some((m) => m.text.trim().length >= 20) && !c.priorIdeas.length
}

export const THIN_BLOCK = '회사 정보부터 — 업종 · 종목 · 상담 메모를 채우거나 회사 소개서 · 제품 설명 · GPT 와 나눈 대화를 넣어 주세요'

/* ------------------------------------------------------------------ */
/* 아이디어 내줘                                                          */
/* ------------------------------------------------------------------ */

export function buildIdeaContext(input: { draft: SpecDraft; company: AgentCompany; others: string[]; today: string }): AssistContext {
  const { draft: d, company: c, others, today } = input
  const sections: AssistContext['sections'] = [
    { name: '회사', rows: [{ part: '회사 이름', memo: c.name || '(회사 미정 — 업종 일반으로)' }, ...c.facts.slice(0, 20).map((f) => ({ part: '기록', memo: safeText(f) }))] },
    { name: '재료', rows: materialRows(c) },
  ]
  if (c.priorIdeas.length) sections.push({ name: 'AI 작업실 특허 아이디어', rows: c.priorIdeas.slice(0, 6).map((memo) => ({ part: '앞선 결과', memo: safeText(memo, [], 560) })) })
  if (others.length) sections.push({ name: '이미 있는 명세서', rows: others.slice(0, 10).map((t) => ({ part: '명칭', memo: t })) })
  const written = ideaRows(d)
  if (d.title.trim() || written.length) sections.push({ name: '지금 초안', rows: [...(d.title.trim() ? [{ part: '명칭', memo: d.title }] : []), ...written] })
  return {
    title: '특허 명세서 — 아이디어',
    today,
    purpose: '이 회사가 출원할 만한 특허 아이디어 5개(추천 순 · 1~3순위는 이유와 함께)',
    sections,
    rules: ['회사 기록 · 재료에 있는 업무 · 데이터 · 제품 · 판매 방식에서 출발한다. 어느 회사에나 맞는 일반 아이디어는 내지 않는다 — 아이디어마다 재료의 어떤 사실에서 나왔는지 detail 에.'],
  }
}

/** D-269 후보 줄 — 명칭 · 5개 질문 · 왜 이 회사에(560자씩) */
function candidateRows(ideas: IdeaPick[]): AssistRow[] {
  return ideas.flatMap((p, i) =>
    chunks(`${p.title}${p.titleEn ? `{${p.titleEn}}` : ''} — 문제: ${p.idea.problem} / 기존: ${p.idea.prior} / 차별: ${p.idea.distinct} / 흐름: ${p.idea.flow} / 포인트: ${p.idea.point} / 회사 근거: ${p.why}`).map((memo, j) => ({ part: `후보 ${i + 1}${j ? ' (이어서)' : ''}`, memo })),
  )
}

/** D-269 [이 중 제일 좋은 게 뭐야?] — 회사 · 재료 + 지금 후보들 */
export function buildIdeaRankContext(input: { draft: SpecDraft; company: AgentCompany; today: string }): AssistContext {
  const { draft: d, company: c, today } = input
  return {
    title: '특허 명세서 — 아이디어 후보 비교',
    today,
    purpose: `후보 ${d.ideas.length}개 가운데 무엇이 가장 나은지 — 자체점검 기준으로 점수 · 순위 · 이유`,
    sections: [
      { name: '회사', rows: [{ part: '회사 이름', memo: c.name || '(회사 미정)' }, ...c.facts.slice(0, 20).map((f) => ({ part: '기록', memo: safeText(f) }))] },
      { name: '재료', rows: materialRows(c) },
      { name: '후보', rows: candidateRows(d.ideas) },
    ],
  }
}

/** D-269 [자체점검으로 더 짜내기] — 회사 · 재료 + 지금 후보들(약점을 공격한 뒤 더 날카로운 새 아이디어) */
export function buildIdeaMoreContext(input: { draft: SpecDraft; company: AgentCompany; others: string[]; today: string }): AssistContext {
  const base = buildIdeaContext(input)
  return { ...base, title: '특허 명세서 — 아이디어 더 짜내기', purpose: '지금 후보들의 약점을 자체점검 기준으로 공격한 뒤, 그 약점을 피한 새 아이디어 2개', sections: [...base.sections, { name: '지금 후보', rows: candidateRows(input.draft.ideas) }] }
}

const EN_OK = /^[A-Z0-9 ,.\-'()/&;:]+$/

/** 줄 앞 번호 · 이름표 떼기('① 현재 문제: …' → '…') */
function stripLabel(line: string): string {
  return String(line ?? '')
    .replace(/^\s*(?:[①②③④⑤⑥]|\d+[.)]|[-•·])\s*/, '')
    .replace(/^(?:현재\s*문제|기존\s*방식(?:과\s*부족한\s*점)?|차별\s*구조|처리\s*흐름|권리화\s*포인트)\s*[:：]\s*/, '')
    .trim()
}

/** 점수 글 → 0~100 숫자("82점" · "82/100" · "82") */
function scoreOf(v: unknown): number | undefined {
  const m = /(\d{1,3}(?:\.\d+)?)/.exec(String(v ?? ''))
  if (!m) return undefined
  const n = Math.round(Number(m[1]))
  return n >= 0 && n <= 100 ? n : undefined
}

/** 명칭 비교용(띄어쓰기 · 기호 무시) */
const titleKey = (t: string) => String(t ?? '').replace(/\{[^}]*\}/g, '').replace(/[\s·,.\-()]/g, '')

/**
 * 아이디어 후보 — D-269 5개 · 추천 점수(amount) · 순위 이유(when). 점수가 있으면 점수 순(같으면 답 순서).
 * 명칭 앞에 붙은 '1순위' · '[추천]' 같은 표지는 뗀다.
 */
export function ideasOf(answer: AssistAnswer | null, max = 5): IdeaPick[] {
  if (!answer) return []
  const out: IdeaPick[] = []
  for (const it of answer.items ?? []) {
    const title = String(it.title ?? '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/[{}]/g, '')
      .replace(/^\s*(?:\[?\s*(?:\d\s*순위|추천|후보)\s*\]?\s*[:.)·-]?\s*)/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const lines = (it.outline ?? []).map(stripLabel).filter(Boolean)
    if (!title || lines.length < 3 || out.some((o) => titleKey(o.title) === titleKey(title))) continue
    const en = String(it.body ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
    const pick: IdeaPick = {
      title,
      titleEn: EN_OK.test(en) ? en : '',
      why: String(it.detail ?? '').trim(),
      idea: { problem: lines[0] ?? '', prior: lines[1] ?? '', distinct: lines[2] ?? '', flow: lines[3] ?? '', point: lines[4] ?? '' },
    }
    const score = scoreOf(it.amount)
    if (score != null) pick.score = score
    const reason = String(it.when ?? '').trim()
    if (reason) pick.reason = reason
    out.push(pick)
    if (out.length >= max) break
  }
  return rankIdeas(out)
}

/** 점수 높은 순(점수 없는 것은 뒤 · 같으면 원래 순서) */
export function rankIdeas(ideas: IdeaPick[]): IdeaPick[] {
  return ideas
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.score ?? -1) - (a.p.score ?? -1) || a.i - b.i)
    .map((x) => x.p)
}

/** 순위 표지 — 1~3순위만, 나머지는 후보 */
export const rankLabel = (i: number) => (i < 3 ? `${i + 1}순위` : '후보')

/**
 * D-269 [이 중 제일 좋은 게 뭐야?] 의 답 → 후보마다 점수 · 이유를 고쳐 다시 줄 세움.
 * 답의 항목은 후보 명칭(또는 '후보 n')으로 찾는다. 찾지 못한 후보는 점수를 그대로 둔다.
 */
export function rerankIdeas(ideas: IdeaPick[], answer: AssistAnswer | null): { ideas: IdeaPick[]; matched: number; headline: string } {
  if (!answer) return { ideas, matched: 0, headline: '' }
  const next = ideas.map((p) => ({ ...p }))
  let matched = 0
  for (const it of answer.items ?? []) {
    const raw = String(it.title ?? '')
    const byNo = /후보\s*(\d+)/.exec(raw) ?? /후보\s*(\d+)/.exec(String(it.ref ?? ''))
    let idx = byNo ? Number(byNo[1]) - 1 : -1
    if (idx < 0 || idx >= next.length) {
      const k = titleKey(raw.replace(/^\s*\[?\s*(?:\d\s*순위|후보\s*\d+)\s*\]?\s*[:.)·-]?\s*/, ''))
      idx = k ? next.findIndex((p) => titleKey(p.title) === k || (k.length >= 8 && (titleKey(p.title).includes(k) || k.includes(titleKey(p.title))))) : -1
    }
    if (idx < 0) continue
    const score = scoreOf(it.amount)
    if (score == null) continue
    next[idx].score = score
    const why = String(it.when ?? it.detail ?? '').trim()
    if (why) next[idx].reason = why
    matched += 1
  }
  return { ideas: rankIdeas(next), matched, headline: String(answer.headline ?? '').trim() }
}

/** D-269 [더 짜내기] 로 나온 새 아이디어를 후보에 더한다(같은 명칭은 빼고 · 표시 fresh · 모두 IDEA_MAX 안) */
export function addMoreIdeas(ideas: IdeaPick[], more: IdeaPick[]): { ideas: IdeaPick[]; added: number } {
  const fresh = more.filter((m) => !ideas.some((p) => titleKey(p.title) === titleKey(m.title))).map((m) => ({ ...m, fresh: true }))
  const all = rankIdeas([...ideas.map((p) => ({ ...p, fresh: false })), ...fresh])
  // 새로 나온 것은 넘쳐도 남긴다 — 점수가 가장 낮은 옛 후보부터 뺀다
  while (all.length > IDEA_MAX) {
    const drop = all.map((p, i) => ({ p, i })).filter((x) => !x.p.fresh).pop()
    if (!drop) break
    all.splice(drop.i, 1)
  }
  return { ideas: all.map((p) => (p.fresh ? p : { ...p, fresh: undefined })), added: fresh.length }
}

/** 아이디어 하나로 1단계를 채운다(명칭 · 영문 · 5개 질문). 고른 명칭은 ai.title 로 기억 — 사람이 고친 명칭인지 알기 위해 */
export function applyIdea(d: SpecDraft, pick: IdeaPick): SpecDraft {
  return {
    ...d,
    title: pick.title,
    titleEn: pick.titleEn || d.titleEn,
    idea: { ...pick.idea },
    source: d.source || 'AI 아이디어',
    ai: { ...d.ai, title: pick.title, titleEn: pick.titleEn || d.ai.titleEn || '' },
  }
}

/** 다른 아이디어로 바꾸면 앞 아이디어로 쓴 구성 · 본문 · 청구항은 맞지 않는다 — 비운다(되돌리기로 살린다) */
export function clearAfterIdea(d: SpecDraft): SpecDraft {
  return { ...d, axis: { input: '', process: '', state: '', judge: '', output: '', feedback: '', link: '' }, systemName: '', components: [], steps: [], seeds: [], claims: [], text: {}, suggestion: {}, research: null, ai: { title: d.ai.title ?? '', titleEn: d.ai.titleEn ?? '' } }
}

/** 구성 · 본문 · 청구항 중 하나라도 있나 */
/** 본문 칸이나 청구항을 이미 썼나(자체점검 ① 이 구성 이름을 바꾸면 안 되는 때 · 자체점검 카드는 ② 만) */
export const bodyWritten = (d: SpecDraft) => d.claims.some((c) => c.trim()) || SECTION_KEYS.some((k) => (d.text[k] ?? '').trim())

export const hasLaterWork = (d: SpecDraft) => d.components.some((c) => c.name.trim()) || claimsOf(d).length > 0 && d.claims.length > 0 || SECTION_KEYS.some((k) => (d.text[k] ?? '').trim())

/* ------------------------------------------------------------------ */
/* 조사해줘                                                              */
/* ------------------------------------------------------------------ */

export function buildResearchContext(input: { draft: SpecDraft; today: string }): AssistContext {
  const { draft: d, today } = input
  const rows: AssistRow[] = [{ part: '명칭', memo: titleLine(d) || '(명칭 없음)' }, ...ideaRows(d)]
  if (d.axis.link.trim()) rows.push({ part: AXIS_LABEL.link, memo: d.axis.link })
  const comps = d.components.filter((c) => c.name.trim())
  if (comps.length) rows.push({ part: '구성요소', memo: comps.map((c) => c.name).join(' · ') })
  return { title: '특허 명세서 — 선행기술 조사', today, purpose: '중복 가능성 · 무엇을 좁히고 더해 차별화할지', sections: [{ name: '고른 아이디어', rows }] }
}

export function researchOf(run: Pick<AssistRun, 'structured' | 'grounded' | 'sources' | 'createdAt'>, forTitle: string): SpecResearch | null {
  const a = run.structured
  if (!a) return null
  const items = (a.items ?? [])
    .map((it) => ({ tag: String(it.tag ?? '').trim(), title: String(it.title ?? '').trim(), detail: String(it.detail ?? '').trim(), outline: (it.outline ?? []).map((x) => String(x).trim()).filter(Boolean) }))
    .filter((it) => it.title || it.detail)
  if (!items.length) return null
  const sources = (run.sources ?? []).filter((s) => s && /^https?:\/\//.test(s.url)).slice(0, 8)
  return { at: run.createdAt || new Date().toISOString(), forTitle, headline: String(a.headline ?? '').trim(), items, next: (a.next ?? []).map((x) => String(x).trim()).filter(Boolean), grounded: !!run.grounded && sources.length > 0, sources }
}


/* ------------------------------------------------------------------ */
/* 구성 · 단계 써줘                                                       */
/* ------------------------------------------------------------------ */

export function buildPartsContext(input: { draft: SpecDraft; today: string }): AssistContext {
  const { draft: d, today } = input
  const sections: AssistContext['sections'] = [
    { name: '명칭', rows: [{ part: '발명의 명칭', memo: titleLine(d) }] },
    { name: '아이디어', rows: ideaRows(d) },
  ]
  const res = researchRows(d)
  if (res.length) sections.push({ name: '조사에서 나온 차별화', rows: res })
  return { title: '특허 명세서 — 권리축 · 구성 · 단계', today, purpose: '권리축 7줄 · 구성요소 · 방법 단계 · 종속항 씨앗', sections }
}

export interface PartsAnswer {
  axis: Partial<SpecAxis>
  systemName: string
  components: { name: string; does: string }[]
  steps: string[]
  seeds: { comp: string; text: string }[]
}

const AXIS_KEYS: (keyof SpecAxis)[] = ['input', 'process', 'state', 'judge', 'output', 'feedback', 'link']

/*
 * D-262 답 모양이 조금 달라도 읽는다 — 예전엔 title 이 정확히 "comp" 이고 이름이 detail 에 있어야만 읽혀,
 * 모델이 이름표를 tag 에 넣거나("title: 요청 수집부 · tag: comp") · 번호를 붙이거나("comp1") · 이름을 본문 앞에 쓰면("요청 수집부: …")
 * 구성요소 0개 → '구성요소를 찾지 못했습니다' 로 멈췄다(모델을 바꿔도 같았다).
 */
type PartLabel = { kind: 'axis'; key: keyof SpecAxis } | { kind: 'system' | 'comp' | 'step' | 'seed' }
const squash = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-:：·.,/()[\]#*'"`]/g, '')
const PART_WORDS: Record<string, PartLabel> = {
  system: { kind: 'system' },
  systemname: { kind: 'system' },
  시스템: { kind: 'system' },
  시스템이름: { kind: 'system' },
  시스템명: { kind: 'system' },
  comp: { kind: 'comp' },
  comps: { kind: 'comp' },
  component: { kind: 'comp' },
  components: { kind: 'comp' },
  구성요소: { kind: 'comp' },
  구성: { kind: 'comp' },
  step: { kind: 'step' },
  steps: { kind: 'step' },
  단계: { kind: 'step' },
  방법단계: { kind: 'step' },
  s: { kind: 'step' },
  seed: { kind: 'seed' },
  seeds: { kind: 'seed' },
  종속항: { kind: 'seed' },
  종속항씨앗: { kind: 'seed' },
  dependent: { kind: 'seed' },
}
for (const k of AXIS_KEYS) {
  PART_WORDS[`axis${k}`] = { kind: 'axis', key: k }
  PART_WORDS[`권리축${k}`] = { kind: 'axis', key: k }
  PART_WORDS[squash(AXIS_LABEL[k])] = { kind: 'axis', key: k }
}

/** 글 하나가 이름표인가 — 대소문자 · 띄어쓰기 · 기호 · 끝 번호(comp1 · S110 · 단계 2) 무시 */
export function partLabelOf(v: unknown): PartLabel | null {
  const s = squash(v)
  if (!s || s.length > 30) return null
  return PART_WORDS[s] ?? PART_WORDS[s.replace(/\d+$/, '')] ?? null
}

/** "요청 수집부(110): 채널별 요청을 받는" · "요청 수집부 — …" · "요청 수집부는 …" → 이름 · 하는 일 */
function splitNamed(text: string): { name: string; rest: string } | null {
  const m = /^\s*(?:[①-⑳]|\d{1,3}[.)]|[-•*])?\s*([^:：—–(\n]{1,30}?(?:부|모듈|엔진|유닛|장치|서버|단말|DB|데이터베이스))\s*(?:\(\s*\d{2,4}\s*\))?\s*(?:[:：—–]\s*|-\s+|는\s+|은\s+|가\s+|이\s+)(.+)$/s.exec(text)
  if (!m) return null
  const name = m[1].trim()
  // "수신된 데이터를 처리부" 같은 문장 조각은 이름이 아니다(목적격 · 꾸밈말 · 네 낱말 넘음)
  if (/(?:[을를]|에서|에게|으로|[된한던])\s/.test(name) || name.split(/\s+/).length > 3) return null
  return { name, rest: m[2].trim() }
}
const cleanName = (s: string) =>
  s
    .replace(/\(\s*\d{2,4}\s*\)/g, '')
    .replace(/^\s*(?:[①-⑳]|\d{1,3}[.)])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
const oneLine = (s: unknown) => cleanAiText(String(s ?? '')).replace(/\s+/g, ' ').trim()

/** D-268 문장 모양 이름("입력 자료를 수집합니다.")은 "입력 자료 수집부" 로 줄이고(그 문장은 하는 일로), 줄일 수 없으면 버린다 — 모자라면 단계가 이름표를 다시 알려 주고 다시 부른다 */
function pushComp(out: PartsAnswer, name: string, does: string) {
  let n = cleanName(name)
  let role = does
  if (isSentenceName(n)) {
    const fixed = nameFromSentence(n)
    if (!fixed) return
    role = does || n
    n = fixed
  }
  if (!n || n.length > 30 || out.components.length >= 8 || out.components.some((c) => c.name === n)) return
  out.components.push({ name: n, does: role ? asAdnominal(role) : '' })
}
function pushStep(out: PartsAnswer, text: string) {
  const t = oneLine(text)
    .replace(/^S?\d{2,4}[.:)]?\s*/, '')
    .replace(/^(?:[①-⑳]|\d{1,2}[.)])\s*/, '')
    .replace(/\s*단계$/, '')
    .trim()
  if (t && out.steps.length < 8) out.steps.push(asAdnominal(t))
}
function pushSeed(out: PartsAnswer, comp: string, text: string) {
  const t = oneLine(text)
  const c = cleanName(comp)
  if (t && out.seeds.length < 6) out.seeds.push({ comp: isSentenceName(c) ? (nameFromSentence(c) ?? '') : c, text: asAdnominal(t) })
}

/** 항목 모양 답(items) → 권리축 · 시스템 · 구성요소 · 단계 · 종속항 씨앗. rawObj = 항목 모양이 아닌 답(components 배열 등)도 읽기 */
export function partsOf(answer: AssistAnswer | null, rawObj?: Record<string, unknown> | null): PartsAnswer {
  const out: PartsAnswer = { axis: {}, systemName: '', components: [], steps: [], seeds: [] }
  for (const it of answer?.items ?? []) {
    const byTitle = partLabelOf(it.title)
    const label = byTitle ?? partLabelOf(it.tag) ?? partLabelOf(it.ref)
    if (!label) continue
    // 이름표가 title 이 아닌 곳에 있으면 title 이 곧 이름(구성요소 · 종속항이 꾸밀 구성요소)
    const titleName = byTitle ? '' : oneLine(it.title)
    const body = oneLine(it.body)
    const detail = oneLine(it.detail)
    const lines = (it.outline ?? []).map(oneLine).filter(Boolean)
    switch (label.kind) {
      case 'axis': {
        const t = body || detail || lines[0] || ''
        if (t) out.axis[label.key] = asAdnominal(t)
        break
      }
      case 'system': {
        const t = (body || detail || titleName).replace(/\(\s*100\s*\)/, '').trim()
        if (t && !out.systemName) out.systemName = t
        break
      }
      case 'comp': {
        // 자기 이름(title · detail)이 있으면 그 이름이 구성요소 하나 — outline 은 하는 일을 덧붙인 것일 뿐
        const named = titleName || (detail && cleanName(detail).length <= 30 ? detail : '')
        if (named) {
          pushComp(out, named, body || (titleName ? detail : '') || lines[0] || '')
          break
        }
        // 이름 없이 outline 줄마다 "이름: 하는 일" — 한 항목에 여러 개
        if (lines.length > 1) {
          for (const ln of lines) {
            const s = splitNamed(ln)
            if (s) pushComp(out, s.name, s.rest)
          }
          break
        }
        const s = splitNamed(body) ?? splitNamed(lines[0] ?? '')
        if (s) pushComp(out, s.name, s.rest)
        break
      }
      case 'step': {
        // 본문이 있으면 단계 하나(outline 은 그 단계의 세부) · 본문 없이 줄만 있으면 줄마다 단계
        const one = body || (lines.length > 1 ? '' : detail || lines[0] || titleName)
        if (one) pushStep(out, one)
        else lines.forEach((ln) => pushStep(out, ln))
        break
      }
      case 'seed': {
        const comp = titleName || detail
        const one = body || (lines.length > 1 ? '' : (titleName ? detail : '') || lines[0] || '')
        if (one) pushSeed(out, comp, one)
        else lines.forEach((ln) => pushSeed(out, comp, ln))
        break
      }
    }
  }
  if (rawObj && out.components.length < 2) partsFromObject(out, rawObj)
  return out
}

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]
  return undefined
}
const asObj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** 항목 모양이 아닌 답 — { system, axis: {...} | [...], components: [{ name, does }], steps: [...], seeds: [...] } (한글 키도) */
function partsFromObject(out: PartsAnswer, raw: Record<string, unknown>) {
  const o = asObj(raw.result) ?? asObj(raw.data) ?? raw
  const sys = pick(o, ['system', 'systemName', 'system_name', '시스템', '시스템이름'])
  if (typeof sys === 'string' && !out.systemName) out.systemName = sys.replace(/\(\s*100\s*\)/, '').trim()
  const axis = pick(o, ['axis', 'axes', '권리축'])
  if (Array.isArray(axis)) {
    axis.slice(0, 7).forEach((v, i) => {
      if (typeof v === 'string' && v.trim() && !out.axis[AXIS_KEYS[i]]) out.axis[AXIS_KEYS[i]] = asAdnominal(oneLine(v))
    })
  } else {
    const ax = asObj(axis)
    if (ax) for (const k of AXIS_KEYS) if (typeof ax[k] === 'string' && !out.axis[k]) out.axis[k] = asAdnominal(oneLine(ax[k]))
  }
  for (const c of asList(pick(o, ['components', 'comps', 'component', '구성요소', 'parts']))) {
    if (typeof c === 'string') {
      const s = splitNamed(c)
      if (s) pushComp(out, s.name, s.rest)
      else if (c.trim().length <= 30) pushComp(out, c, '')
      continue
    }
    const x = asObj(c)
    if (!x) continue
    const name = pick(x, ['name', 'title', 'label', '이름', '구성요소'])
    const does = pick(x, ['does', 'role', 'function', 'body', 'description', 'desc', '역할', '하는일', '기능'])
    if (typeof name === 'string') pushComp(out, name, typeof does === 'string' ? oneLine(does) : '')
  }
  if (!out.steps.length)
    for (const s of asList(pick(o, ['steps', 'methodSteps', 'method', '단계', '방법단계']))) {
      const x = asObj(s)
      const t = typeof s === 'string' ? s : x ? pick(x, ['text', 'body', 'step', 'description', '내용']) : ''
      if (typeof t === 'string') pushStep(out, t)
    }
  if (!out.seeds.length)
    for (const s of asList(pick(o, ['seeds', 'dependents', 'dependentClaims', '종속항']))) {
      if (typeof s === 'string') {
        pushSeed(out, '', s)
        continue
      }
      const x = asObj(s)
      if (!x) continue
      const comp = pick(x, ['comp', 'component', 'target', '구성요소'])
      const text = pick(x, ['text', 'body', 'claim', '내용'])
      if (typeof text === 'string') pushSeed(out, typeof comp === 'string' ? comp : '', text)
    }
}

/** 구성 칸이 사람이 고친 것인지 — AI 가 마지막으로 넣은 모양(ai.parts)과 다르면 사람 */
export function partsSig(d: Pick<SpecDraft, 'axis' | 'systemName' | 'components' | 'steps' | 'seeds'>): string {
  return JSON.stringify([d.axis, d.systemName, d.components, d.steps, d.seeds])
}

export function partsHuman(d: SpecDraft): boolean {
  const any = d.components.some((c) => c.name.trim()) || Object.values(d.axis).some((x) => x.trim())
  return any && partsSig(d) !== (d.ai.parts ?? '')
}

export function applyParts(d: SpecDraft, p: PartsAnswer, opts: { force?: boolean } = {}): { draft: SpecDraft; applied: boolean; kept: boolean } {
  if (p.components.length < 2) return { draft: d, applied: false, kept: false }
  if (partsHuman(d) && !opts.force) return { draft: d, applied: false, kept: true }
  const components = p.components.map((c, i) => ({ no: String(110 + i * 10), name: c.name, does: c.does }))
  const steps = p.steps.map((text, i) => ({ no: `S${110 + i * 10}`, text }))
  const seeds = p.seeds.map((s) => ({ comp: components.find((c) => s.comp && (c.name === s.comp || s.comp.includes(c.name) || c.name.includes(s.comp)))?.no ?? '', text: s.text }))
  const axis = { ...d.axis }
  for (const k of AXIS_KEYS) if (p.axis[k]) axis[k] = p.axis[k]!
  const next: SpecDraft = { ...d, axis, systemName: p.systemName || d.systemName, components, steps, seeds }
  return { draft: { ...next, ai: { ...next.ai, parts: partsSig(next) } }, applied: true, kept: false }
}

/* ------------------------------------------------------------------ */
/* 점검대로 고쳐줘                                                        */
/* ------------------------------------------------------------------ */

export type FixKey = 'title' | 'titleEn' | SectionKey | 'claims'
const FIX_KEYS: FixKey[] = ['title', 'titleEn', ...SECTION_KEYS, 'claims']

/** 고칠 것 — 규칙 점검 두 겹(초안 점검 · 명세서 점검)의 고쳐야 함 · 주의 */
export function fixIssues(d: SpecDraft, report?: SpecReport): string[] {
  const r = report ?? checkSpec(parseSpecText(specMarkdown(d, { notice: false }), 'draft.md'))
  const a = checkDraft(d).filter((i) => i.level !== 'info').map((i) => `${i.level === 'error' ? '고쳐야 함' : '주의'} · ${i.text}`)
  const b = r.findings.filter((f) => f.level !== 'info').map((f) => `${f.level === 'error' ? '고쳐야 함' : '주의'} · ${f.title}${f.code ? `(${f.code})` : ''} — ${f.fix}`)
  return [...new Set([...a, ...b])].slice(0, 30)
}

/** 사람이 손댈 수 없는 것(구성요소 부족 · 부호 겹침 등)은 AI 로 고치지 않는다 — 글 칸만 */
export const fixable = (issues: string[]) => issues.filter((t) => !/구성요소가 2개보다|부호가 겹|부호는 숫자|100번은|같은 이름의 구성요소|대표도 도|도면이 2장보다|도면이 6장을/.test(t))

export function buildFixContext(input: { draft: SpecDraft; issues: string[]; today: string }): AssistContext {
  const { draft: d, issues, today } = input
  const comps = d.components.filter((c) => c.name.trim())
  return {
    title: '특허 명세서 — 점검대로 고치기',
    today,
    purpose: '점검에서 걸린 칸만 고친다',
    // D-268 청구항을 본문보다 앞에 — 글이 아주 길어 서버가 줄여도 청구항은 남게
    sections: [
      { name: '점검에서 걸린 것', rows: issues.map((memo) => ({ part: '점검', memo })) },
      { name: '구성요소', rows: comps.map((c) => ({ part: c.no, name: c.name })) },
      { name: '청구항', rows: claimRows(d) },
      { name: '명세서 지금 글', rows: draftRows(d) },
    ],
    rules: WHOLE_TEXT_RULES,
  }
}

/** D-268 명칭 한 줄 + 본문 일곱 칸 전체(문단마다) */
function draftRows(d: SpecDraft): AssistRow[] {
  return [titleRow(d), ...SECTION_KEYS.flatMap((k) => paraRows(k, sectionOf(d, k)))]
}
/** D-268 청구항 전체(예전엔 청구항마다 앞 560자) */
function claimRows(d: SpecDraft): AssistRow[] {
  return claimsOf(d).slice(0, 30).flatMap((c, i) => paraRows(`claims ${i + 1}`, c))
}

export function fixItemsOf(answer: AssistAnswer | null): { key: FixKey; text: string; note?: string }[] {
  if (!answer) return []
  const out: { key: FixKey; text: string; note?: string }[] = []
  // D-262 이름표가 title 이 아닌 tag · ref 에 있거나 대소문자가 달라도(titleen) 읽는다
  const keyOf = (v: unknown) => {
    const t = String(v ?? '').trim()
    return FIX_KEYS.find((k) => k.toLowerCase() === t.toLowerCase()) ?? (SECTION_KEYS as readonly string[]).find((k) => SECTION_LABEL[k as SectionKey] === t)
  }
  for (const it of answer.items ?? []) {
    const key = keyOf(it.title) ?? keyOf(it.tag) ?? keyOf(it.ref)
    const body = String(it.body ?? '').trim()
    if (!key || !body || out.some((o) => o.key === key)) continue
    out.push({ key: key as FixKey, text: body, note: String(it.detail ?? '').trim() || undefined })
  }
  return out
}

/** 고친 글 합치기 — 명칭은 사람이 고친 명칭이면 그대로(새 안으로), 본문 · 청구항은 mergeSpecAi(사람 글 보호) */
export function applyFix(d: SpecDraft, given: { key: FixKey; text: string }[]): { draft: SpecDraft; replaced: string[]; kept: string[] } {
  let next: SpecDraft = { ...d, ai: { ...d.ai }, suggestion: { ...d.suggestion } }
  const replaced: string[] = []
  const kept: string[] = []
  // D-268 명칭을 출원서 모양 "한글{ENGLISH}" 한 줄로 돌려줘도 두 칸으로 나눈다(예전엔 중괄호만 지워 영문이 한글 명칭에 붙었다)
  const items = given.flatMap((it) => {
    const m = it.key === 'title' ? /^([^{}]+?)\s*\{([^{}]+)\}\s*$/.exec(it.text.trim()) : null
    if (!m) return [it]
    return [{ key: 'title' as FixKey, text: m[1] }, ...(given.some((g) => g.key === 'titleEn') ? [] : [{ key: 'titleEn' as FixKey, text: m[2] }])]
  })
  for (const it of items) {
    if (it.key !== 'title' && it.key !== 'titleEn') continue
    const val = it.key === 'titleEn' ? it.text.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().toUpperCase() : it.text.replace(/[{}\n]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!val || (it.key === 'titleEn' && !EN_OK.test(val))) continue
    const cur = next[it.key].trim()
    const human = !!cur && cur !== (next.ai[it.key] ?? '').trim()
    if (human) {
      next.suggestion[it.key] = val
      kept.push(it.key)
      continue
    }
    next = { ...next, [it.key]: val, ai: { ...next.ai, [it.key]: val } }
    replaced.push(it.key)
  }
  const body = items.filter((i) => i.key !== 'title' && i.key !== 'titleEn') as { key: SectionKey | 'claims'; text: string }[]
  const m = mergeSpecAi(next, body)
  return { draft: m.draft, replaced: [...replaced, ...m.replaced], kept: [...kept, ...m.kept] }
}

/* ------------------------------------------------------------------ */
/* 전부 써줘 — 무엇을 차례로 부를지                                        */
/* ------------------------------------------------------------------ */

const ideaCount = (d: SpecDraft) => Object.values(d.idea).filter((x) => x.trim()).length

/** 아이디어 → 조사 → 구성 → 본문 a~d → 청구항 e → 점검대로 고치기(그때 걸린 것이 있으면). 이미 된 앞 단계는 건너뛴다 */
export function planAll(d: SpecDraft): AgentStage[] {
  const out: AgentStage[] = []
  if (!d.title.trim() || ideaCount(d) < 3) out.push('idea')
  if (!d.research || d.research.forTitle !== d.title || !d.title.trim()) out.push('research')
  if (d.components.filter((c) => c.name.trim()).length < 2) out.push('parts')
  // D-263 자체점검는 구성 뒤 · 청구항 뒤에 반드시(구성을 새로 쓰거나 아직 판정 전이면 ①부터 — 본문이 이미 있으면 ② 가 함께 본다)
  if (out.includes('parts') || (!d.judge.parts && !bodyWritten(d))) out.push('judge1')
  out.push('a', 'b', 'c', 'd', 'e', 'judge2', 'fix')
  return out
}

/*
 * D-269 기획 먼저 — 대표: "버튼 한 번에 처음부터 끝까지 피드백 없이 다 쓰는 거는 별로 · 다섯 번 누르더라도 절차마다 버튼으로".
 *   회사 정보(없으면 먼저 받기) → 아이디어 5개 · 고르기 → [이걸로 시작] 조사 · 구성 · 자체점검 ① → 구성 확인 → [본문 · 청구항 쓰기] → 전문
 */

/** [이걸로 시작] — 조사(명칭이 바뀌었으면) → 구성 → 자체점검 ① 까지. 여기서 멈추고 대표가 구성을 본다 */
export function planParts(d: SpecDraft): AgentStage[] {
  return [...(!d.research || d.research.forTitle !== d.title ? (['research'] as AgentStage[]) : []), 'parts', 'judge1']
}

/** [이 구성으로 본문 · 청구항 쓰기] — 본문 a~d · 청구항 · 자체점검 ② · 점검대로 고치기 */
export const PLAN_BODY: readonly AgentStage[] = ['a', 'b', 'c', 'd', 'e', 'judge2', 'fix']

export type SpecPhase = 'company' | 'ideas' | 'parts' | 'review' | 'body' | 'done'

const BOARD_CARDS: AgentCard[] = ['idea', 'research', 'parts', 'body', 'claims', 'judge', 'check']

/** 다 썼나 — 칸 다섯 이상 됨 · 명칭 있음 */
export const specFinished = (d: SpecDraft): boolean => !!d.title.trim() && BOARD_CARDS.filter((c) => cardState(c, d).done).length >= 5

/** 지금 어느 절차인가 — 명칭은 대표가 아이디어를 골라야(또는 직접 적어야) 생긴다 */
export function specPhase(d: SpecDraft, thin: boolean): SpecPhase {
  if (!d.title.trim()) return thin ? 'company' : 'ideas'
  if (d.components.filter((c) => c.name.trim()).length < 2) return 'parts'
  if (!bodyWritten(d)) return 'review'
  return specFinished(d) ? 'done' : 'body'
}

/** 다른 아이디어로 돌아가기 — 명칭 · 5개 질문까지 비우고 후보 목록은 남긴다(되돌리기로 살린다) */
export function backToIdeas(d: SpecDraft): SpecDraft {
  const c = clearAfterIdea(d)
  return { ...c, title: '', titleEn: '', idea: { problem: '', prior: '', distinct: '', flow: '', point: '' }, judge: { parts: null, full: null }, ai: {} }
}

/** 단계마다 부를 수 있는지(앞 단계가 모자라면 왜인지) */
export function stageBlock(stage: AgentStage, d: SpecDraft): string {
  if (stage === 'idea') return ''
  if (stage === 'ideaRank') return d.ideas.length >= 2 ? '' : '아이디어부터 — [아이디어 5개 내줘]'
  if (stage === 'ideaMore') return d.ideas.length ? '' : '아이디어부터 — [아이디어 5개 내줘]'
  if (!d.title.trim()) return '아이디어부터 — [아이디어 내줘]'
  if (stage === 'research' || stage === 'parts') return ''
  if (d.components.filter((c) => c.name.trim()).length < 2) return '구성요소부터 — [구성 · 단계 써줘]'
  if (stage === 'judge2' && !bodyWritten(d)) return '본문 · 청구항부터 — [본문 써줘] · [청구항 써줘]'
  return ''
}

/** 칸의 상태 — 작업판 카드에 쓴다 */
export function cardState(card: AgentCard, d: SpecDraft): { done: boolean; human: boolean; summary: string } {
  switch (card) {
    case 'idea':
      return { done: !!d.title.trim() && ideaCount(d) >= 3, human: !!d.title.trim() && d.title !== (d.ai.title ?? ''), summary: d.title.trim() ? titleLine(d) : d.ideas.length ? `후보 ${d.ideas.length}개 — 하나를 고르세요` : '' }
    case 'research':
      return { done: !!d.research && d.research.forTitle === d.title, human: false, summary: d.research ? d.research.headline || `메모 ${d.research.items.length}개` : '' }
    case 'parts': {
      const comps = d.components.filter((c) => c.name.trim())
      return { done: comps.length >= 2, human: partsHuman(d), summary: comps.length ? comps.map((c) => `${c.name}(${c.no})`).join(' · ') : '' }
    }
    case 'body': {
      const written = SECTION_KEYS.filter((k) => (d.text[k] ?? '').trim())
      return { done: written.length >= 4, human: written.some((k) => (d.text[k] ?? '').trim() !== (d.ai[k] ?? '').trim()), summary: written.length ? `${written.length}/7칸 — ${written.map((k) => SECTION_LABEL[k]).join(' · ')}` : '' }
    }
    case 'claims': {
      const n = d.claims.length
      return { done: n >= 2, human: n > 0 && d.claims.join('\n\n').trim() !== (d.ai.claims ?? '').trim(), summary: n ? `청구항 ${n}개` : '' }
    }
    case 'judge': {
      const r = d.judge.full ?? d.judge.parts
      return { done: judgePassed(d.judge.full), human: false, summary: judgeLine(r) }
    }
    case 'check':
      return { done: !checkDraft(d).some((i) => i.level === 'error'), human: false, summary: '' }
  }
}

/* ------------------------------------------------------------------ */
/* D-263 자체점검 — 구성 뒤(①) · 청구항 뒤(②)                              */
/* ------------------------------------------------------------------ */

export type JudgeScope = 'parts' | 'full'
export const JUDGE_SCOPE_LABEL: Record<JudgeScope, string> = { parts: '구성', full: '전체' }

/** 자체점검에 보낼 자료 — ① 아이디어 · 조사 · 권리축 · 구성 · 단계 · 씨앗 / ② 명칭 · 본문 · 청구항(구체적인 내용은 앞부분만 — 뒷받침 확인용) */
export function buildJudgeContext(input: { draft: SpecDraft; scope: JudgeScope; today: string }): AssistContext {
  const { draft: d, scope, today } = input
  const comps = d.components.filter((c) => c.name.trim())
  const sections: AssistContext['sections'] = []
  const ideaRows: AssistRow[] = [{ part: '명칭', memo: d.title }, ...AXIS_KEYS.map((k) => ({ part: `axis.${k}`, memo: d.axis[k] || '(없음)' }))]
  for (const [k, v] of Object.entries(d.idea)) if (v.trim()) ideaRows.push({ part: `아이디어 ${k}`, memo: v })
  if (scope === 'parts') {
    sections.push({ name: '아이디어 · 권리축', rows: ideaRows })
    if (d.research) sections.push({ name: '선행기술 조사 메모', rows: [{ part: '결론', memo: d.research.headline }, ...d.research.items.slice(0, 7).map((i) => ({ part: i.tag || '메모', memo: `${i.title} — ${i.detail}` }))] })
    sections.push({ name: '시스템 · 구성요소', rows: [{ part: 'system', name: d.systemName || titleParts(d.title).system }, ...comps.map((c) => ({ part: c.no, name: c.name, does: c.does }))] })
    sections.push({ name: '방법 단계', rows: d.steps.map((x) => ({ part: x.no, memo: x.text })) })
    sections.push({ name: '종속항 씨앗', rows: d.seeds.map((x) => ({ part: x.comp || '씨앗', memo: x.text })) })
  } else {
    // D-268 글 전체(문단마다) · 명칭 한 줄 · 청구항 전체 — 청구항을 본문보다 앞에(아주 길어 서버가 줄여도 청구항은 남게)
    sections.push({ name: '구성요소(이름 · 부호 그대로 쓸 것)', rows: comps.map((c) => ({ part: c.no, name: c.name, does: c.does })) })
    sections.push({ name: '청구항', rows: claimRows(d) })
    sections.push({ name: '명세서 지금 글', rows: draftRows(d) })
    sections.push({ name: '아이디어 · 권리축', rows: ideaRows })
  }
  return { title: `특허 명세서 — 자체점검 ${scope === 'parts' ? '①' : '②'}`, today, purpose: `판정 범위: ${JUDGE_SCOPE_LABEL[scope]}`, sections, ...(scope === 'full' ? { rules: WHOLE_TEXT_RULES } : {}) }
}

/**
 * 자체점검이 고친 것 합치기 — 사람 글은 보호(구성은 partsHuman · 본문은 mergeSpecAi 새 안).
 *  ① 고친 권리축 · 시스템 · 구성 · 단계 · 씨앗을 지금 구성 위에 겹쳐(일부만 와도) applyParts
 *  ② 명칭 · 본문 칸 · 청구항은 applyFix — 구체적인 내용(detail)은 길어서(두 번에 나눠 쓴 글) 자체점검이 통째로 다시 쓰지 않는다(문제는 판정으로)
 */
export function applyJudge(d: SpecDraft, scope: JudgeScope, rewrites: AssistItem[]): { draft: SpecDraft; fixed: string[]; kept: string[] } {
  if (!rewrites.length) return { draft: d, fixed: [], kept: [] }
  if (scope === 'parts') {
    const p = partsOf({ headline: '', items: rewrites })
    const touched = p.components.length >= 2 || p.steps.length > 0 || p.seeds.length > 0 || !!p.systemName || AXIS_KEYS.some((k) => p.axis[k])
    if (!touched) return { draft: d, fixed: [], kept: [] }
    if (partsHuman(d)) return { draft: d, fixed: [], kept: ['구성'] }
    // 본문 · 청구항이 이미 있으면 구성요소 · 단계 · 시스템 이름은 그대로(바꾸면 본문 · 청구항의 이름 · 부호와 어긋난다)
    const locked = bodyWritten(d)
    const newComps = !locked && p.components.length >= 2
    const newSteps = !locked && p.steps.length >= 2
    const newSystem = !locked && !!p.systemName
    const merged: PartsAnswer = {
      axis: { ...d.axis, ...Object.fromEntries(AXIS_KEYS.filter((k) => p.axis[k]).map((k) => [k, p.axis[k]!])) },
      systemName: newSystem ? p.systemName : d.systemName,
      components: newComps ? p.components : d.components.filter((c) => c.name.trim()).map((c) => ({ name: c.name, does: c.does })),
      steps: newSteps ? p.steps : d.steps.map((x) => x.text),
      seeds: p.seeds.length ? p.seeds : d.seeds.map((x) => ({ comp: d.components.find((c) => c.no === x.comp)?.name ?? x.comp, text: x.text })),
    }
    const r = applyParts(d, merged, { force: true })
    const fixed = [
      ...AXIS_KEYS.filter((k) => p.axis[k]).map((k) => `권리축 ${AXIS_LABEL[k]}`),
      ...(newSystem ? ['시스템 이름'] : []),
      ...(newComps ? ['구성요소'] : []),
      ...(newSteps ? ['방법 단계'] : []),
      ...(p.seeds.length ? ['종속항 씨앗'] : []),
    ]
    const kept = locked && (p.components.length >= 2 || p.steps.length >= 2 || !!p.systemName) ? ['구성요소 · 단계(본문 · 청구항이 이미 있어 이름 그대로)'] : []
    return { draft: fixed.length ? r.draft : d, fixed, kept }
  }
  const items = fixItemsOf({ headline: '', items: rewrites }).filter((i) => i.key !== 'detail')
  if (!items.length) return { draft: d, fixed: [], kept: [] }
  const m = applyFix(d, items)
  const name = (k: string) => (k === 'title' ? '명칭' : k === 'titleEn' ? '영문 명칭' : k === 'claims' ? '청구항' : (SECTION_LABEL as Record<string, string>)[k] ?? k)
  return { draft: m.draft, fixed: m.replaced.map(name), kept: m.kept.map(name) }
}
