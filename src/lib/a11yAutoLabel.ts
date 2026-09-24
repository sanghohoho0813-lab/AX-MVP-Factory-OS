/**
 * 옮겨 온 원본 모듈 화면에 빠진 '읽는 이름' 을 채운다 (D-101).
 *
 * 원본 모듈(고용지원금·연구소·영업·정책자금·창업감면·크레탑)은 칸 이름을 <label for> 없이 옆 글자로만 붙였고,
 * 단추를 기호(🔍 + − ⋮ ✕)로만 그린 곳이 있다. 화면 읽기 프로그램은 이런 칸을 '편집 칸' 으로만, 단추를 '더하기' 로만 읽는다.
 * 수백 곳을 하나하나 고치는 대신 모듈 칸 안에서만, **이름이 전혀 없는 것에만** 이름을 붙인다. 이미 붙은 이름은 건드리지 않는다.
 */

/** 원본 모듈 화면(따로 뜨는 창 포함)의 뿌리 */
export const ORIGINAL_ROOTS = '.pf-orig, .st-orig, .lab-orig, .hr-app, .hr-portal, [data-testid="sales-orig"], .ui-modal, .cretop-mini'

const SYMBOL_NAMES: Record<string, string> = {
  '🔍': '검색',
  '+': '추가',
  '＋': '추가',
  '−': '빼기',
  '-': '빼기',
  '⋮': '더 보기',
  '⋯': '더 보기',
  '…': '더 보기',
  '✕': '닫기',
  '×': '닫기',
  '✖': '닫기',
  '✓': '완료',
  '✔': '완료',
  '🔔': '알림',
  '☰': '목차',
  '←': '뒤로',
  '→': '앞으로',
  '▲': '위로',
  '▼': '아래로',
}

/** 기호만 있는 단추의 이름 — 한글·영문·숫자가 하나라도 있으면 null (이미 읽을 수 있다) */
export function symbolButtonName(text: string): string | null {
  const t = text.replace(/\s+/g, '')
  if (!t || /[가-힣A-Za-z0-9]/.test(t)) return null
  return SYMBOL_NAMES[t] ?? null
}

/** 칸 앞의 짧은 글자를 이름으로 — 너무 길면(설명문) 쓰지 않는다 */
export function cleanLabelText(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').replace(/[*:：]\s*$/, '').trim()
  if (!t || t.length > 40 || !/[가-힣A-Za-z]/.test(t)) return null
  return t
}

function hasName(el: Element): boolean {
  if ((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby') || (el.getAttribute('title') || '').trim()) return true
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if ((el.placeholder || '').trim()) return true
  }
  const id = el.getAttribute('id')
  if (id && el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) return true
  return !!el.closest('label')
}

function labelFor(el: Element): string | null {
  // 같은 줄 앞 형제 → 부모의 앞 형제 → 부모 안 첫 글자 칸 (두 단계까지만)
  let node: Element | null = el
  for (let depth = 0; depth < 2 && node; depth++) {
    let prev = node.previousElementSibling
    while (prev) {
      if (!prev.matches('input, select, textarea, button')) {
        const got = cleanLabelText((prev as HTMLElement).innerText ?? prev.textContent)
        if (got) return got
      }
      prev = prev.previousElementSibling
    }
    node = node.parentElement
  }
  return null
}

/** 앞에 글자가 없는 고르기 칸은 첫 항목이 제목 구실을 한다('필터: 전체', '🗂️ 전체 업체 기준') — 그 글자로 */
export function selectCaptionText(firstOption: string): string | null {
  const t = firstOption.replace(/[^\p{L}\p{N}\s:·()/-]/gu, '').trim()
  const head = t.includes(':') ? t.split(':')[0].trim() : t
  return cleanLabelText(head)
}

function selectCaption(el: HTMLSelectElement): string | null {
  return selectCaptionText(el.options[0]?.text ?? '')
}

/** 뿌리 안의 이름 없는 칸·기호 단추에 이름을 붙인다. 붙인 수를 돌려준다 */
export function autoLabel(doc: Document = document): number {
  let n = 0
  for (const root of doc.querySelectorAll(ORIGINAL_ROOTS)) {
    for (const el of root.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')) {
      if (hasName(el)) continue
      const name = labelFor(el) ?? (el instanceof HTMLSelectElement ? selectCaption(el) : null)
      if (name) {
        el.setAttribute('aria-label', name)
        n += 1
      }
    }
    for (const el of root.querySelectorAll('button, [role="button"]')) {
      if ((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby')) continue
      // 단추는 안 글자가 title 보다 먼저 읽힌다 — '🔍' 만 있으면 title('업체·직원 검색')이 있어도 '돋보기' 로 읽힌다.
      // 그래서 기호만 있는 단추는 title 을 이름으로 올리고, title 도 없으면 기호 뜻으로
      const symbol = symbolButtonName((el as HTMLElement).innerText ?? el.textContent ?? '')
      if (!symbol) continue
      el.setAttribute('aria-label', (el.getAttribute('title') || '').trim() || symbol)
      n += 1
    }
  }
  return n
}

/** 화면이 바뀔 때마다(원본 앱이 그리는 대로) 다시 붙인다. 한 프레임에 한 번만 */
export function installAutoLabel(doc: Document = document): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  let queued = false
  const run = () => {
    queued = false
    autoLabel(doc)
  }
  const mo = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  })
  mo.observe(doc.body, { childList: true, subtree: true })
  run()
  return () => mo.disconnect()
}
