/**
 * 고객 설문 화면의 개인정보 안내문 (D-101).
 *
 * 예전 기본 문구 끝에는 '실제 운영 전 개인정보 처리 문구는 법적 검토가 필요합니다.' 가 붙어 있었다 — 우리끼리 할 말인데
 * 링크를 받은 고객이 그대로 읽었다. 이미 보낸 링크는 저장된 문구를 고치지 않고(기록은 그대로), 고객 화면에 그릴 때 그 한 문장만 뺀다.
 */
const INTERNAL_SENTENCES = [/\s*실제 운영 전 개인정보 처리 문구는 법적 검토가 필요합니다\.?/g]

export function customerPrivacyText(text: string): string {
  let out = text ?? ''
  for (const re of INTERNAL_SENTENCES) out = out.replace(re, '')
  // 문장을 빼고 남은 ‘…및 설문 응답이며,’ 꼬리를 문장 끝으로
  return out.replace(/이며,\s*$/, '입니다.').trim()
}
