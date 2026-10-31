/**
 * D-389 대표 신분증 사본(주민등록증 · 운전면허증) → 대표 생년월일 · 이름.
 *
 * 서류함 기본 칸 '대표자 신분증 사본' 에 올려도 아무것도 읽지 않아, 창업감면(청년 대표) · 정책자금(청년기업 가점)이
 * 계속 '대표 생년월일을 알면 판정해요' 라고 했다.
 *  - 주민등록번호 모양(앞 6자리 - 성별 1자리 …)에서 생년월일만 만든다. 주민등록번호 · 주소 · 사진은 남기지 않는다(글자도 저장하지 않음).
 *  - 이름은 번호와 같은 줄 앞 · 바로 위 줄의 한글 2~4자(괄호 속 한자는 뺌). '주민등록증 · 서울특별시 …' 같은 낱말은 이름이 아니다.
 *  - 신분증은 보통 사진이라 글자 인식(OCR) 값 — 바로 넣지 않고 '확인할 것' 으로 묻는다(docAutoFill 규칙 그대로).
 * 규칙 계산 — 외부 호출 없음.
 */
import { birthFromRrnPrefix } from './koreanDocParser'

/** 맨 위 몇 줄에 '주민등록증 · 운전면허증' 제목이 있거나 파일 이름이 신분증 — 본문에 '신분증 사본 제출' 이 있는 신청서는 아니다 */
export function looksLikeIdCard(text: string, fileName = ''): boolean {
  const head = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5).join(' ')
  return /주\s*민\s*등\s*록\s*증|운\s*전\s*면\s*허\s*증|자\s*동\s*차\s*운\s*전/.test(head) || /신분증|주민등록증|운전면허/.test(fileName)
}

const NOT_NAME = /^(주민|등록|운전|면허|자동차|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|특별|광역|구청|시장|군수|경찰|발급|성명|이름|주소|기간|갱신|적성|조건|종별)/

function nameIn(s: string): string {
  for (const m of s.matchAll(/([가-힣]{2,4})(?:\s*\([^)]{0,10}\))?/g)) {
    if (!NOT_NAME.test(m[1])) return m[1]
  }
  return ''
}

export function readIdCard(text: string, fileName = ''): { birth: string; name: string } | null {
  const raw = String(text || '')
  if (!looksLikeIdCard(raw, fileName)) return null
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/[ \t ]+/g, ' ').trim())
  for (let i = 0; i < lines.length; i++) {
    const m = /(?<!\d)(\d{6})\s*[-–]\s*([1-8])(?:\d{6}|\*{4,7})?(?!\d)/.exec(lines[i])
    if (!m) continue
    const birth = birthFromRrnPrefix(m[1], m[2])
    if (!birth) continue
    // 이름 — 같은 줄의 번호 앞, 없으면 바로 위 줄
    const name = nameIn(lines[i].slice(0, m.index)) || nameIn(lines[i - 1] ?? '')
    return { birth, name }
  }
  return null
}
