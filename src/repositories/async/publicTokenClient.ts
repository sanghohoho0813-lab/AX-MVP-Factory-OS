/**
 * 공개 토큰(설문/로컬 테스트) 접근 클라이언트.
 *
 * 공개 페이지(로그인 없음)는 이 클라이언트를 통해서만 서버에 접근한다.
 * 원문 토큰은 서버로 전달되어 서버에서 sha256 해시로 조회되며, DB 에는 해시만 저장된다.
 * 반환 데이터는 렌더링에 필요한 화이트리스트 필드로 제한된다(RPC 에서 강제).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PublicSurveyView {
  distributionId: string
  available: boolean
  status: string
  surveyTitle?: string
  respondentRole?: string
  blueprintSnapshot?: unknown
  introMessage?: string
  privacyNotice?: string
  consentRequired?: boolean
  recipientName?: string
  recipientPosition?: string
  expiresAt?: string | null
}

export interface PublicTestSessionView {
  sessionId: string
  available: boolean
  status: string
  title?: string
  instructions?: string
  scenario?: unknown
  tasks?: unknown
  questions?: unknown
  expiresAt?: string | null
}

export class PublicTokenClient {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async getSurvey(token: string): Promise<PublicSurveyView | null> {
    const { data, error } = await this.client.rpc('get_public_survey', { survey_token: token })
    if (error) throw new Error('설문을 불러오지 못했습니다.')
    return (data as PublicSurveyView | null) ?? null
  }

  async submitSurveyResponse(
    token: string,
    responsePayload: Record<string, unknown>,
    isFinal: boolean,
  ): Promise<{ responseId: string; status: string }> {
    const { data, error } = await this.client.rpc('submit_public_survey_response', {
      survey_token: token,
      response_payload: responsePayload,
      is_final: isFinal,
    })
    if (error) throw new Error('응답을 저장하지 못했습니다.')
    return data as { responseId: string; status: string }
  }

  async getTestSession(token: string): Promise<PublicTestSessionView | null> {
    const { data, error } = await this.client.rpc('get_public_test_session', { test_token: token })
    if (error) throw new Error('테스트 세션을 불러오지 못했습니다.')
    return (data as PublicTestSessionView | null) ?? null
  }

  async submitTestFeedback(
    token: string,
    feedbackPayload: Record<string, unknown>,
    isFinal: boolean,
  ): Promise<{ sessionId: string; status: string }> {
    const { data, error } = await this.client.rpc('submit_public_test_feedback', {
      test_token: token,
      feedback_payload: feedbackPayload,
      is_final: isFinal,
    })
    if (error) throw new Error('피드백을 저장하지 못했습니다.')
    return data as { sessionId: string; status: string }
  }
}

/** 클라이언트에서 토큰 해시가 필요할 때(예: 중복 확인) 사용하는 sha256 hex. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
