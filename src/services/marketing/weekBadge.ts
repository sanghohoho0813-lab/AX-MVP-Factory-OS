/**
 * 스레드 · 릴스 기록표의 '1주일치' 딱지 — 1주일치 묶음(weekCollect · 클라우드 읽기 쓰기)과 떼어, 쓰기 화면이 처음 그릴 때 그 묶음을 받지 않게 했다(D-646).
 */
/** 기록표에서 '1주일치 · 11/3(화)' 표시 — 1주일치에서 모은 줄이 아니면 null */
export function weekBadge(p: { id: string; topic: string }): string | null {
  if (!p.id.startsWith('mkw_')) return null
  const day = /^\d{1,2}\/\d{1,2}\([월화수목금토일]\)/.exec(p.topic)?.[0]
  return day ? `1주일치 · ${day}` : '1주일치'
}
