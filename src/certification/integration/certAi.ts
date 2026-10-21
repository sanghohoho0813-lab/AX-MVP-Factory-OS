/**
 * D-252 기업인증 AI — 대표만(서버 /api/ai-assist 가 대표 권한을 다시 본다). 대표: "하나하나 타자로 입력하는 건 절대 없어야 돼".
 *
 *   cert.reply — 대표님 답장(카톡 통째) → 질문마다 나눠 담기. 번호 · 순서로 안 나뉠 때만(규칙이 먼저 · replySplit).
 *   cert.say   — 실사 예상 질문마다 '말할 답' 초안. 확인된 사실 · 대표 답 · 증빙만 근거로, 모자라면 [대표 확인: …] 으로 비워 둔다.
 *
 * 보내는 것: 질문 글 · 확인된 사실(근거 붙은 것) · 대표 답. 사람 이름 · 연락처는 가린다(redactSensitive · 서버가 한 번 더).
 */
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import type { AssistAnswer } from '../../services/aiAssist/client'
import type { AssistContext, AssistRow } from '../../services/aiAssist/context'
import { ownerKey, type InspectionPackage } from '../core/inspectionPackage'
import type { ReplyAsk } from '../core/replySplit'

const hide = (s: string) => redactSensitive(s ?? '').text

/** 답장을 560자씩 끊어 자료 줄로 */
function replyRows(reply: string): AssistRow[] {
  const t = hide(reply).trim()
  const rows: AssistRow[] = []
  for (let i = 0; i < t.length && rows.length < 12; i += 560) rows.push({ memo: t.slice(i, i + 560) })
  return rows
}

export function buildReplyContext(input: { asks: readonly ReplyAsk[]; reply: string; certLabel: string; today: string }): AssistContext {
  return {
    title: `${input.certLabel} — 대표님 답장 나누기`,
    today: input.today,
    purpose: '보낸 질문마다 대표님 답을 찾아 담는다(답장에 없는 질문은 비워 둔다)',
    sections: [
      { name: '보낸 질문', rows: input.asks.map((a, i) => ({ ref: `q${i + 1}`, 질문: a.text })) },
      { name: '대표님 답장(받은 그대로)', rows: replyRows(input.reply) },
    ],
  }
}

/** 실사 질문 → 'say:질문id' 저장 이름표 */
export const sayKey = (qid: string) => `say:${qid}`

/** 대표님 답(owner 질문에 적은 것)은 이미 핵심 답 근거('대표 답')로 들어 있다 — 따로 보내지 않는다 */
export function buildSayContext(input: { pkg: InspectionPackage; today: string }): AssistContext {
  const { pkg } = input
  return {
    title: `${pkg.companyName || '이 회사'} ${pkg.certLabel} 실사 — 말할 답`,
    today: input.today,
    purpose: '실사 위원 앞에서 대표님이 그대로 말할 답을 질문마다 쓴다(확인된 사실 · 대표 답 · 증빙만)',
    sections: [
      { name: '업체 핵심정보(확인됨)', rows: [...pkg.company, ...pkg.strengths].map((s) => ({ 사실: hide(s.text), 근거: s.basis })) },
      {
        name: '예상 질문',
        rows: pkg.questions.map((x, i) => ({
          ref: `q${i + 1}`,
          질문: x.q.question,
          묻는이유: x.q.intent,
          핵심답근거: x.guide.core.map((s) => hide(s.text)).join(' / '),
          꼭말할것: x.guide.points.map((s) => hide(s.text)).join(' / '),
          증빙있음: x.guide.evidenceHave.join(' · '),
          증빙없음: x.guide.evidenceMissing.join(' · '),
          대표확인필요: x.prepared ? '' : x.guide.ownerAsk.join(' / '),
        })),
      },
    ],
  }
}

/** cert.say 답 → 질문 id 마다 말할 답. title 또는 ref = q번호 · body = 답 */
export function sayItemsOf(answer: AssistAnswer | null, pkg: InspectionPackage): { qid: string; text: string }[] {
  const out = new Map<string, string>()
  for (const it of answer?.items ?? []) {
    const m = /^q(\d{1,2})$/i.exec((it.ref ?? '').trim()) ?? /^q(\d{1,2})$/i.exec((it.title ?? '').trim())
    const x = m ? pkg.questions[Number(m[1]) - 1] : undefined
    const text = (it.body ?? '').trim()
    if (!x || !text || out.has(x.q.id)) continue
    out.set(x.q.id, text.slice(0, 1200))
  }
  return [...out.entries()].map(([qid, text]) => ({ qid, text }))
}

/** 대표 확인 질문 → 나눠 담을 질문 목록(보낸 카톡 번호와 같은 순서) */
export const ownerAsks = (questions: readonly string[]): ReplyAsk[] => questions.map((q) => ({ key: ownerKey(q), text: q }))
