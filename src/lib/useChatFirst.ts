/**
 * D-628 '대화창 같이 열기 / 화면만' 고른 값 읽기(D-552 chatFirst 값을 그대로 쓴다) — 설정 · 다른 탭에서 바꾸면 바로 따른다.
 * 모듈 9곳은 모듈마다 고른 것 → 전체. 특허 · 벤처 · 기업인증 · 마케팅은 전체 값을 따른다.
 */
import { useEffect, useState } from 'react'
import { CHAT_FIRST_EVENT, readChatFirst, type ChatFirstPrefs } from '../services/workChat/chatFirst'

export function useChatFirstPrefs(): ChatFirstPrefs {
  const [prefs, setPrefs] = useState(readChatFirst)
  useEffect(() => {
    const on = () => setPrefs(readChatFirst())
    window.addEventListener(CHAT_FIRST_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(CHAT_FIRST_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return prefs
}

/** 모듈이 아닌 대화창(특허 · 벤처 · 기업인증 · 마케팅) — 전체 값이 '화면만' 이 아니면 저절로 연다 */
export function useChatAutoOpen(): boolean {
  return (useChatFirstPrefs().all ?? 'chat') === 'chat'
}
