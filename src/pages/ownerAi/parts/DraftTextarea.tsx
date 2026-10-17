/**
 * D-219: 한 줄에 하나씩 적는 칸 — 적는 동안 글은 적은 그대로 두고(줄 끝 띄어쓰기 · 엔터), 바깥에는 다듬은 값만 넘긴다.
 *
 * 예전에는 한 글자마다 줄을 나눠 다듬은 값으로 칸을 다시 그려, 줄 끝 띄어쓰기가 바로 사라지고(" 자동" → "감소자동")
 * 엔터로 새 줄을 만들 수 없었다(본문 · 메뉴 · 구역 항목을 더할 수 없었음).
 * 바깥 값이 이 칸이 넘긴 것과 다르게 바뀌면(AI 다시 만들기 · 다른 쪽) 그때만 바깥 값으로 다시 채운다.
 */

import { useState, type TextareaHTMLAttributes } from 'react'

export interface DraftTextareaProps<T> extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: T
  toText: (v: T) => string
  fromText: (text: string) => T
  onValue: (v: T) => void
}

export function DraftTextarea<T>({ value, toText, fromText, onValue, ...rest }: DraftTextareaProps<T>) {
  const [raw, setRaw] = useState(() => toText(value))
  const key = JSON.stringify(value)
  const [seen, setSeen] = useState(key)
  if (seen !== key) {
    setSeen(key)
    if (JSON.stringify(fromText(raw)) !== key) setRaw(toText(value))
  }
  return (
    <textarea
      {...rest}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value)
        onValue(fromText(e.target.value))
      }}
    />
  )
}
