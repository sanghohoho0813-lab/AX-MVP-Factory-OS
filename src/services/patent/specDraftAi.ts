/**
 * D-247 명세서 AI 초안 — 대표만(서버 /api/ai-assist 가 대표 권한을 다시 본다).
 *
 * 다섯 번으로 나눠 차례로 부른다(서버 함수 60초 안):
 *   spec.a 기술분야 · 배경기술 · 해결하려는 과제 · 발명의 효과
 *   spec.b 과제의 해결 수단 · 요약
 *   spec.c 구체적인 내용 ① 구성(도 1 · 구성요소마다)
 *   spec.d 구체적인 내용 ② 흐름 · 나머지 도면 · 변형 실시예
 *   spec.e 청구항(시스템 독립항 + 종속항 + 방법 독립항)
 * 보내는 것: 아이디어 · 권리축 · 명칭 · 구성요소(부호) · 단계 · 도면 · 청구항 뼈대 · 이미 쓴 칸. 사람 이름 · 연락처는 없다.
 * 규칙 출처: Master v2.9 PART 2(8 · 12-1A · 12-2 · 12-4B · 12-4F) — 규칙으로 정한 이름 · 부호 · 도면 번호를 AI 가 바꾸지 못하게 한다.
 */
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistContext, AssistRow } from '../aiAssist/context'
import { AXIS_LABEL, SECTION_LABEL, claimSkeleton, figureSubject, titleLine, titleParts, type SectionKey, type SpecAxis, type SpecDraft, type SpecIdea } from './specDraft'

export type SpecBatch = 'a' | 'b' | 'c' | 'd' | 'e'
export type SpecAiKey = SectionKey | 'claims' | 'detail2'

export const SPEC_BATCHES: readonly { key: SpecBatch; assistId: string; label: string; keys: readonly SpecAiKey[] }[] = [
  { key: 'a', assistId: 'spec.a', label: '기술분야 · 배경 · 과제 · 효과', keys: ['field', 'background', 'problem', 'effect'] },
  { key: 'b', assistId: 'spec.b', label: '과제의 해결 수단 · 요약', keys: ['solution', 'abstract'] },
  { key: 'c', assistId: 'spec.c', label: '구체적인 내용 ① 구성', keys: ['detail'] },
  { key: 'd', assistId: 'spec.d', label: '구체적인 내용 ② 흐름 · 도면', keys: ['detail2'] },
  { key: 'e', assistId: 'spec.e', label: '청구항', keys: ['claims'] },
]

const IDEA_LABEL: Record<keyof SpecIdea, string> = { problem: '① 현재 문제', prior: '② 기존 방식과 부족한 점', distinct: '③ 차별 구조', flow: '④ 처리 흐름', point: '⑤ 권리화 포인트' }

/** 560자씩(서버가 메모 줄은 600자까지 받는다) */
function chunks(text: string, size = 560): string[] {
  const out: string[] = []
  const t = String(text ?? '').trim()
  for (let i = 0; i < t.length; i += size) out.push(t.slice(i, i + size))
  return out
}

export const SPEC_RULES = [
  '한국 특허 명세서를 쓴다. 문체는 "~한다 · ~이다" 의 평서체, 문단 단위로 쓰고 문단 사이는 빈 줄 하나.',
  '[자료 · 구성요소] 의 이름과 부호를 그대로 쓴다 — 발명의 설명에서는 "이름(부호)" (예: 판정부(140)), 청구항에서는 부호 없이 이름만. 새 구성요소 · 새 부호를 만들지 않는다.',
  '[자료 · 도면] 의 도 번호와 무엇을 보여 주는지 그대로 쓴다. 없는 도면(도 n)을 말하지 않는다.',
  '아이디어 · 권리축에 없는 기능 · 데이터 · 성능 수치(정확도 n% 등)를 만들지 않는다. 실시예의 값은 "예를 들어" 로 쓰고 실측처럼 쓰지 않는다.',
  '규칙 · 점수 계산을 AI · 인공지능 · 머신러닝이라고 부르지 않는다. 권리축에 학습 모델이 적혀 있을 때만 그 말을 쓴다.',
  '"상기 ○○" 는 앞 문장 · 앞 청구항에 이미 나온 말에만 쓴다.',
  '마크다운(#, **, 목록 기호) · 식별항목(【 】, [기술분야]) · 문단 번호([0001]) 를 쓰지 않는다 — OS 가 붙인다.',
  '내부 작업 문구(검토 · 강화 포인트 · 이번 특허에서 가장 중요한 · 메모)와 마케팅 말(혁신적 · 획기적 · 최고)을 쓰지 않는다.',
  '출력: items 에 칸마다 하나 — title = 칸 이름표 그대로(field · background · problem · effect · solution · abstract · detail · detail2 · claims), body = 본문, detail = 자료가 모자라 확인이 필요한 점(짧게 · 없으면 빈 글).',
]

function batchRules(b: SpecBatch, d: SpecDraft): string[] {
  const { system, method } = titleParts(d.title)
  switch (b) {
    case 'a':
      return [
        '칸 field = 기술분야 — 1~2문장. "본 발명은 … 에 관한 것으로, 보다 상세하게는 … 에 관한 것이다."',
        '칸 background = 배경기술 — 3~5문단. 기존 방식(② 기존 방식)과 그 한계를 사실대로. 특정 회사 · 제품 이름을 지어내지 않는다.',
        '칸 problem = 해결하려는 과제 — 2~3문단. "본 발명은 … 을 제공하는 것을 목적으로 한다." 로 맺는 문장을 포함.',
        '칸 effect = 발명의 효과 — 3~5문단. 권리축의 출력 · 재반영에서 나오는 효과만. 수치 약속 금지.',
      ]
    case 'b':
      return [
        `칸 solution = 과제의 해결 수단 — 청구항 뼈대를 풀어 쓴다. 첫 문단은 "상기 목적을 달성하기 위한 본 발명의 일 실시예에 따른 ${system}은(는) …", 다음 문단은 종속항 내용, 마지막 문단은 ${method}.`,
        '칸 abstract = 요약 — 400자 이내 한 문단. "본 발명은 … 에 관한 것으로," 로 시작해 핵심 구성 · 처리 · 효과를 한 번에.',
      ]
    case 'c':
      return [
        '칸 detail = 발명을 실시하기 위한 구체적인 내용의 앞부분 — "이하, 첨부된 도면을 참조하여 …" 로 시작.',
        `도 1 을 참조하여 ${system}(100)의 전체 구성을 먼저, 그다음 [자료 · 구성요소] 순서대로 구성요소마다 1~2문단(입력 · 처리 · 출력 · 다른 구성요소와의 연결)을 쓴다. 2,000~3,000자.`,
        '흐름(단계) · 도 2 이후는 다음 묶음이 쓴다 — 여기서는 구성만.',
      ]
    case 'd':
      return [
        '칸 detail2 = 발명을 실시하기 위한 구체적인 내용의 뒷부분 — 앞부분(구성) 다음에 이어 붙는다. 머리말 · 인사 없이 "도 2 를 참조하면, …" 처럼 바로.',
        `도 2 이후 도면마다 [자료 · 도면] 의 내용을 설명하고, [자료 · 단계] 의 단계 번호(S110 …)를 순서대로 쓴다. 권리축의 연결관계(경쟁사가 피하기 어려운 연결)가 어느 단계에서 어떻게 일어나는지 분명히. 마지막 문단은 변형 실시예(같은 구조를 다른 업종 · 다른 입력에 적용). 2,000~3,000자.`,
      ]
    case 'e':
      return [
        `칸 claims = 청구범위. 청구항마다 "청구항 n." 머리로 시작해 빈 줄로 나눈다. 청구항 1 = ${system} 독립항(구성요소를 "~하는 이름;" 으로 나열하고 "…;를 포함하는 ${system}."), 그다음 종속항("청구항 1에 있어서, 상기 … 것을 특징으로 하는 ${system}."), 마지막 = ${method} 독립항(단계 나열).`,
        '독립항 1 에는 권리축의 "경쟁사가 피하기 어려운 연결관계" 가 반드시 들어간다 — 실시예에만 두고 독립항에서 빼지 않는다.',
        '청구항 수는 고정하지 않는다(보통 6~10항). 시스템 독립항과 방법 독립항의 처리 순서가 서로 맞게. 청구항에는 부호를 쓰지 않는다.',
        '청구항 뼈대(규칙으로 만든 것)를 출발점으로 쓰되 문장을 다듬고 종속항을 보탠다.',
      ]
  }
}

/** 묶음 하나의 보낼 자료 */
export function buildSpecContext(input: { batch: SpecBatch; draft: SpecDraft; today: string }): AssistContext {
  const { batch, draft: d, today } = input
  const ideaRows: AssistRow[] = (Object.keys(IDEA_LABEL) as (keyof SpecIdea)[]).filter((k) => d.idea[k].trim()).flatMap((k) => chunks(d.idea[k]).map((memo) => ({ part: IDEA_LABEL[k], memo })))
  const axisRows: AssistRow[] = (Object.keys(AXIS_LABEL) as (keyof SpecAxis)[]).filter((k) => d.axis[k].trim()).map((k) => ({ part: AXIS_LABEL[k], memo: d.axis[k].trim().slice(0, 560) }))
  const compRows: AssistRow[] = [{ part: '100', name: d.systemName.trim() || titleParts(d.title).system, memo: '시스템 전체' }, ...d.components.filter((c) => c.name.trim()).map((c) => ({ part: c.no, name: c.name, memo: c.does }))]
  const stepRows: AssistRow[] = d.steps.filter((s) => s.text.trim()).map((s) => ({ part: s.no, memo: s.text }))
  const figRows: AssistRow[] = d.figures.map((f) => ({ part: `도 ${f.n}`, memo: `${figureSubject(d, f)} · ${f.kind}` }))
  const sections: AssistContext['sections'] = [
    { name: '명칭', rows: [{ part: '발명의 명칭', memo: titleLine(d) }] },
    { name: '아이디어', rows: ideaRows },
    { name: '권리축', rows: axisRows },
    { name: '구성요소', rows: compRows },
    { name: '단계', rows: stepRows },
    { name: '도면', rows: figRows },
  ]
  if (batch === 'b' || batch === 'e') sections.push({ name: '청구항 뼈대', rows: claimSkeleton(d).map((c, i) => ({ part: `청구항 ${i + 1}`, memo: c.slice(0, 560) })) })
  // 이야기가 이어지게 — 이미 쓴 다른 칸(이번 묶음 칸은 빼고)
  const mine = new Set<string>(SPEC_BATCHES.find((x) => x.key === batch)?.keys ?? [])
  const written: AssistRow[] = []
  for (const k of ['field', 'background', 'problem', 'solution', 'effect', 'detail'] as SectionKey[]) {
    if (mine.has(k)) continue
    const t = (d.text[k] ?? '').trim()
    if (!t) continue
    chunks(t).slice(0, batch === 'd' && k === 'detail' ? 6 : 2).forEach((memo, i) => written.push({ part: `${SECTION_LABEL[k]}${i ? ' (이어서)' : ''}`, memo }))
  }
  if (written.length) sections.push({ name: '이미 쓴 칸', rows: written })
  return {
    title: '특허 명세서 초안',
    today,
    purpose: `이번에 쓸 칸: ${SPEC_BATCHES.find((x) => x.key === batch)?.label ?? ''}`,
    sections,
    rules: [...SPEC_RULES, ...batchRules(batch, d)],
  }
}

/** 답 → 칸. title 이 이름표가 아니면 칸 이름으로 찾는다 */
export function specItemsOf(answer: AssistAnswer | null, batch: SpecBatch): { key: SpecAiKey; text: string; note?: string }[] {
  if (!answer) return []
  const mine = SPEC_BATCHES.find((x) => x.key === batch)?.keys ?? []
  const label: Record<string, string> = { ...SECTION_LABEL, claims: '청구범위', detail2: '구체적인 내용 뒷부분' }
  const out: { key: SpecAiKey; text: string; note?: string }[] = []
  for (const it of answer.items ?? []) {
    const t = (it.title ?? '').trim()
    const key = mine.find((k) => k === t) ?? mine.find((k) => t && (label[k].includes(t) || t.includes(label[k])))
    if (!key) continue
    const body = (it.body ?? '').trim()
    if (!body) continue
    const note = (it.detail ?? '').trim()
    out.push({ key, text: body, note: note || undefined })
  }
  // 하나뿐인 칸 묶음인데 이름표가 어긋났으면 첫 본문을 그 칸으로
  if (!out.length && mine.length === 1) {
    const first = (answer.items ?? []).find((it) => (it.body ?? '').trim())
    if (first) out.push({ key: mine[0], text: String(first.body).trim(), note: (first.detail ?? '').trim() || undefined })
  }
  return out
}

/** 구체적인 내용 앞 · 뒤를 한 칸으로 */
export function joinDetail(front: string, back: string): string {
  return [front.trim(), back.trim()].filter(Boolean).join('\n\n')
}

