/**
 * D-245 특허로 편집기 오류 코드 → 원인 · 1차 복구 · 재발 방지 (Master v2.9 14-5 · 2026-09 실제 작성 중 확인한 것 포함).
 * 오류 코드 뜻은 출원 직전 편집기 메시지 · 최신 공식 매뉴얼이 우선이다(14-5 주석).
 */

export interface EditorCode {
  code: string
  cause: string
  fix: string
  prevent: string
  /** 여러 오류가 함께 뜨면 이 순서로 푼다(14-6) — 작을수록 먼저 */
  order: number
}

export const EDITOR_CODES: EditorCode[] = [
  { code: 'E-201', order: 1, cause: '편집기가 허용하지 않는 식별항목을 직접 쳤거나, 지금 편집기와 다른 이름을 썼습니다.', fix: '직접 친 식별항목을 지우고 [서식목록 삽입]으로 다시 만드세요.', prevent: 'MD 의 【 】 · [ ] 제목을 그대로 붙여 넣지 않습니다.' },
  { code: 'E-244', order: 1, cause: '식별항목의 차례 · 계층이 틀렸습니다.', fix: '왼쪽 트리에서 위치를 옮기거나, 잘못 만든 항목을 지우고 제자리에 다시 만드세요.', prevent: '요약서와 도면은 따로 둡니다(도 n 을 요약서 아래에 만들지 않기).' },
  { code: 'E-245', order: 1, cause: '꼭 있어야 할 식별항목이 빠졌습니다.', fix: '편집기에서 빠진 정식 식별항목을 만드세요.', prevent: '초안의 제목 글과 실제 식별항목을 헷갈리지 않습니다.' },
  { code: 'E-249', order: 2, cause: '상위 식별항목과 하위 식별항목 사이에 본문이 있습니다.', fix: '글을 지우지 말고, 들어가야 할 하위 식별항목 아래로 옮기세요.', prevent: '상위 → 하위 → 내용 순서(Parent/Child 규칙).' },
  { code: 'E-261', order: 3, cause: '발명의 명칭 · 대표도에 숨은 글자 속성(굵게 등)이 있습니다.', fix: '내용을 지우고 새 평문 문단 · 기본 서식으로 다시 넣으세요.', prevent: '밖에서 복사한 뒤엔 서식 초기화 · 제목은 직접 입력.' },
  { code: 'E-262', order: 3, cause: '발명의 명칭이 두 문단 이상입니다.', fix: '한글명칭과 {영문명칭}을 한 문단으로 합치세요.', prevent: '제목은 한 문단으로 고정.' },
  { code: 'E-266', order: 3, cause: '한글 발명의 명칭 오른쪽에 {영문명칭} 이 없습니다.', fix: '한글명칭{ENGLISH TITLE} 모양으로 고치세요.', prevent: "'영문명:' 같은 이름표를 쓰지 않습니다." },
  { code: 'E-267', order: 3, cause: '{ } 안에 쓰면 안 되는 글자가 있습니다.', fix: '영문명칭 안의 한글 · 허용 안 되는 문자를 지우세요.', prevent: '중괄호 안에는 영문명칭만.' },
  { code: 'E-268', order: 3, cause: '닫는 } 뒤에 글이 있습니다.', fix: '} 뒤의 글을 지우세요.', prevent: '영문명칭이 제목의 마지막.' },
  { code: 'E-242', order: 4, cause: '대표도 바로 다음 내용이 올바른 도 번호 · 그림 1개가 아닙니다.', fix: "실제 도면이 있는지 보고, 대표도에 '도 1' 만 평문으로(또는 그림 1개만) 넣으세요.", prevent: '대표도에 글과 그림을 함께 넣지 않습니다.' },
  { code: 'E-250', order: 4, cause: '대표도로 지정한 도 번호가 실제 도면에 없습니다.', fix: '실제 도 n 을 만들어 그림을 넣은 뒤, 대표도 번호를 평문으로 다시 넣으세요.', prevent: '대표도 번호 굵게 금지 · 실제 도면 먼저 넣기.' },
  { code: 'S-010', order: 4, cause: "'도 n' 과 그림 사이에 빈 문단이 있습니다.", fix: '빈 문단을 지우고 그림을 도 번호 바로 다음에 두세요.', prevent: '그림을 넣은 뒤 빈 문단 확인.' },
  { code: 'E-240', order: 4, cause: "'도 n' 다음 줄에 그림 1개가 아닌 빈 문단 · 글 · 다른 것이 있습니다.", fix: '도 n 아래를 정리하고 그림 1개만 다시 넣으세요.', prevent: '도면 번호 바로 뒤 그림 1개, 앞뒤 빈 문단 0.' },
  { code: 'E-298', order: 5, cause: '도면 그림 좌우 · 같은 줄에 공백 · 글자 · 숨은 서식이 있습니다.', fix: '그림 주변 글 · 공백을 지우고 그림만 다시 넣으세요.', prevent: '그림은 혼자 한 줄.' },
  { code: 'E-252', order: 5, cause: '선행기술문헌 식별항목의 계층 · 쓰는 방식이 지침과 다릅니다.', fix: '실제 문헌이 없으면 항목을 빼는 것을 먼저 검토하고, 있으면 정식 하위 식별항목으로 다시 짜세요.', prevent: '선행기술문헌 바로 아래에 빈 문단을 두지 않습니다.' },
]

/** 'e249' · 'E 249' · 'E-249 오류' 처럼 넣어도 찾는다 */
export function findEditorCodes(input: string): EditorCode[] {
  const wanted = new Set<string>()
  for (const m of String(input).toUpperCase().matchAll(/\b([ES])\s*-?\s*(\d{3})\b/g)) wanted.add(`${m[1]}-${m[2]}`)
  return EDITOR_CODES.filter((c) => wanted.has(c.code)).sort((a, b) => a.order - b.order)
}
