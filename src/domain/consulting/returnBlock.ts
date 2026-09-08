/**
 * OS 반환 블록 — 외부 LLM 결과를 구조로 되받는 약속.
 *
 * 프롬프트 끝에 아래 형식을 요구하고, 돌아온 글에서 그대로 뽑아낸다.
 * LLM API 없이 복사 → 붙여넣기만으로 구조화 결과를 얻기 위한 장치다.
 *
 *   --- MIRAE_OS_RETURN ---
 *   TYPE: PATENT_IDEA
 *   SUMMARY: 한 문단
 *   DECISION_OPTIONS:
 *   1) ...
 *   2) ...
 *   MISSING_FACTS:
 *   - 최근 매출
 *   NEXT_RECOMMENDATION: ...
 *   --- END_MIRAE_OS_RETURN ---
 *
 * 가장 중요한 규칙: **파싱에 실패해도 원문은 반드시 산출물로 저장된다.**
 * 구조를 얻으면 화면이 더 친절해질 뿐, 못 얻어도 잃는 것은 없다.
 */

import type { ArtifactType } from '../../types/consulting'
import { isArtifactType } from './artifactDefinitions'

export const RETURN_BEGIN = '--- MIRAE_OS_RETURN ---'
export const RETURN_END = '--- END_MIRAE_OS_RETURN ---'

export interface ParsedReturnBlock {
  /** 블록을 찾았는지 */
  found: boolean
  type: ArtifactType | null
  summary: string
  /** 사용자가 고를 후보 (특허 아이디어 3안 등) */
  decisionOptions: string[]
  /** LLM 이 "이건 확인이 필요하다" 고 짚은 값 */
  missingFacts: string[]
  nextRecommendation: string
}

/** 프롬프트에 붙일 요구문 — 종류마다 기대하는 것이 조금 다르다 */
export function returnBlockInstruction(type: ArtifactType, wantsOptions: boolean): string {
  const lines = [
    '## 마지막에 반드시 붙일 것 — OS 반환 블록',
    '아래 블록을 답변 맨 끝에 그대로의 형식으로 붙인다. 이 블록은 사람이 읽는 것이 아니라 시스템이 읽는다.',
    '',
    RETURN_BEGIN,
    `TYPE: ${type}`,
    'SUMMARY: (3~4문장. 이번 결과의 핵심만)',
  ]
  if (wantsOptions) {
    lines.push(
      'DECISION_OPTIONS:',
      '1) (사람이 고를 수 있는 후보를 한 줄로. 2~4개)',
      '2) ',
      '3) ',
    )
  }
  lines.push(
    'MISSING_FACTS:',
    '- (근거가 없어 지어내지 않고 남겨 둔 값. 없으면 "없음")',
    'NEXT_RECOMMENDATION: (다음에 무엇을 하면 좋은지 한 줄)',
    RETURN_END,
  )
  return lines.join('\n')
}

function section(block: string, key: string): string {
  // "KEY: 값" 또는 "KEY:" 다음 줄부터 다음 KEY 까지
  const re = new RegExp(`^${key}\\s*:\\s*(.*)$`, 'mi')
  const m = re.exec(block)
  if (!m) return ''
  const inline = m[1].trim()
  const after = block.slice(m.index + m[0].length)
  const stop = /^[A-Z_]{3,}\s*:/m.exec(after)
  const rest = (stop ? after.slice(0, stop.index) : after).trim()
  return [inline, rest].filter((s) => s !== '').join('\n').trim()
}

function listItems(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*·]|\d+[).])\s*/, '').trim())
    .filter((l) => l !== '' && !/^없음$|^none$|^-$/i.test(l))
}

export function parseReturnBlock(text: string): ParsedReturnBlock {
  const empty: ParsedReturnBlock = { found: false, type: null, summary: '', decisionOptions: [], missingFacts: [], nextRecommendation: '' }
  const begin = text.indexOf(RETURN_BEGIN)
  if (begin < 0) return empty
  const endAt = text.indexOf(RETURN_END, begin)
  const block = text.slice(begin + RETURN_BEGIN.length, endAt < 0 ? undefined : endAt)

  const rawType = section(block, 'TYPE').split(/\s/)[0] ?? ''
  return {
    found: true,
    type: isArtifactType(rawType) ? rawType : null,
    summary: section(block, 'SUMMARY'),
    decisionOptions: listItems(section(block, 'DECISION_OPTIONS')).slice(0, 6),
    missingFacts: listItems(section(block, 'MISSING_FACTS')).slice(0, 8),
    nextRecommendation: section(block, 'NEXT_RECOMMENDATION').split('\n')[0] ?? '',
  }
}

/** 반환 블록을 뺀 본문 — 산출물로 저장할 내용 */
export function stripReturnBlock(text: string): string {
  const begin = text.indexOf(RETURN_BEGIN)
  if (begin < 0) return text.trim()
  const endAt = text.indexOf(RETURN_END, begin)
  const tail = endAt < 0 ? '' : text.slice(endAt + RETURN_END.length)
  return (text.slice(0, begin) + tail).trim()
}
