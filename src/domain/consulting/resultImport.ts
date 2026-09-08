/**
 * 결과 들여오기 — 사람이 LLM 결과를 붙여 넣으면 종류·단계·제목을 알아본다.
 *
 * 프롬프트 꾸러미는 결과 첫 줄에 `[ARTIFACT] type=… stage=… title=…` 를 요구한다.
 * 그 줄이 있으면 그대로 읽고, 없으면 기본값(프롬프트 종류 → 산출물 종류)을 쓴다.
 * 어느 쪽이든 사람이 확인하고 저장한다.
 */

import type { ArtifactType, StageKey } from '../../types/consulting'
import { artifactDef, isArtifactType } from './artifactDefinitions'
import { isStageKey } from './workflowDefinition'

export interface ParsedResult {
  type: ArtifactType | null
  stage: StageKey | null
  title: string
  /** 머리줄을 뺀 본문 */
  body: string
  /** 머리줄을 찾았는지 */
  hadHeader: boolean
}

const HEADER = /^\s*\[ARTIFACT\]\s*(.*)$/m

export function parsePastedResult(text: string): ParsedResult {
  const m = HEADER.exec(text)
  if (!m) {
    return { type: null, stage: null, title: firstHeading(text), body: text.trim(), hadHeader: false }
  }
  const attrs = m[1]
  const type = /type\s*=\s*([A-Z_]+)/.exec(attrs)?.[1] ?? null
  const stage = /stage\s*=\s*(S\d{1,2})/.exec(attrs)?.[1] ?? null
  const title = /title\s*=\s*"([^"]*)"|title\s*=\s*([^\s].*)$/.exec(attrs)
  const body = text.replace(HEADER, '').trim()
  return {
    type: isArtifactType(type) ? type : null,
    stage: isStageKey(stage) ? stage : null,
    title: (title?.[1] ?? title?.[2] ?? '').trim() || firstHeading(body),
    body,
    hadHeader: true,
  }
}

/** 첫 마크다운 제목 또는 첫 줄 60자 */
export function firstHeading(text: string): string {
  const h = /^\s*#{1,3}\s+(.+)$/m.exec(text)
  if (h) return h[1].trim().slice(0, 80)
  const first = text.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? ''
  return first.slice(0, 60)
}

/** 결과 머리줄 — 프롬프트가 요구하는 형식 그대로 */
export function artifactHeaderLine(type: ArtifactType, stage: StageKey, title: string): string {
  return `[ARTIFACT] type=${type} stage=${stage} title="${title.replace(/"/g, "'")}"`
}

/** 저장 제목 기본값 — "종류 v2" 처럼 */
export function defaultArtifactTitle(type: ArtifactType, version: number, given: string): string {
  const t = given.trim()
  if (t !== '') return t
  return `${artifactDef(type).label} v${version}`
}
