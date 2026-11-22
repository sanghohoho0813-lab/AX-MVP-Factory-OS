/**
 * 모델 이름 — 고른 모델(회사 · 모델 id) → 화면에 쓰는 이름.
 * W7(D-644) AiAssist.tsx(AI 도우미 판 전체)에서 뗐다: 머리줄 · 대화 판의 모델 고르기 단추가 이름 하나 때문에 판 전체를 첫 화면 전에 받았다.
 */
import type { AssistStatus } from '../../services/aiAssist/client'
import type { AiChoice } from '../../services/aiAssist/store'

export function prettyModel(id: string): string {
  return id
    .replace(/(\d)-(\d)/g, '$1.$2')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^Gpt/, 'GPT')
    .replace(/Flash Lite$/, 'Flash-Lite')
}

export function labelOf(status: AssistStatus | null, c: AiChoice): string {
  const p = status?.providers.find((x) => x.id === c.provider)
  const m = p?.models.find((x) => x.id === c.model)
  return m ? m.label : prettyModel(c.model)
}
