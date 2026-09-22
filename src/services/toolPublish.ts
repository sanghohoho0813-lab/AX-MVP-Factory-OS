/**
 * 도구 결과를 고객 플랫폼으로 내보낼 때 나가는 것을 한곳에서 정한다 (D-89).
 *
 * 왜 따로 뺐나: "고객에게 무엇이 나가는가" 는 화면 안에 묻어 두면 안 된다.
 * 여기 한 함수만 보면 되고, 시험이 이 함수를 직접 붙든다.
 *
 * 나가는 것: 도구가 만든 제목과 요약 글뿐이다.
 * 나가지 않는 것: 입력값(`data`) · 기한 · 판정 키 · 내부 메모 · 수수료 · 업무 일기.
 */

import type { PublishUpdateInput } from './customerBridgeService'
import type { ToolResult } from '../types/clientOps'

export interface ToolPublishSource {
  /** 도구 결과 이름 (예: "창업감면 판정") */
  title: string
  /** 고객에게 보여 줘도 되는 요약 글 */
  summary: string
}

/**
 * 고객 플랫폼에 올릴 글 한 장.
 * 고객이 해야 할 일은 없다 — 도구 결과는 알림이지 요청이 아니다.
 */
export function buildToolPublishInput(linkId: string, source: ToolPublishSource): PublishUpdateInput {
  return {
    linkId,
    category: 'result',
    title: `${source.title.trim()} 결과`,
    body: source.summary.trim(),
    customerActionRequired: false,
  }
}

/** 이미 발행한 결과인가 — 두 번 보내지 않기 위해 */
export function isToolResultPublished(result: Pick<ToolResult, 'publishedUpdateId'>): boolean {
  return typeof result.publishedUpdateId === 'string' && result.publishedUpdateId !== ''
}
