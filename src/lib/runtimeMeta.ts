import {
  Ban,
  CheckCircle2,
  Clock3,
  FileEdit,
  MailQuestion,
  PencilLine,
  Send,
  TimerOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  SurveyDistributionStatus,
  SurveyResponseStatus,
} from '../types/surveyRuntime'

interface StatusMeta {
  label: string
  description: string
  tone: StatusTone
  icon: LucideIcon
  /** 정렬 우선순위 (작을수록 먼저) */
  order: number
}

export const DISTRIBUTION_STATUS_META: Record<
  SurveyDistributionStatus,
  StatusMeta
> = {
  draft: {
    label: '발급 준비',
    description: '아직 발급되지 않은 링크입니다.',
    tone: 'neutral',
    icon: FileEdit,
    order: 0,
  },
  issued: {
    label: '응답 대기',
    description: '링크가 발급되었고 아직 열람 전입니다.',
    tone: 'info',
    icon: MailQuestion,
    order: 1,
  },
  opened: {
    label: '링크 확인',
    description: '응답자가 링크를 열었습니다.',
    tone: 'info',
    icon: Clock3,
    order: 2,
  },
  in_progress: {
    label: '작성 중',
    description: '응답자가 설문을 작성하고 있습니다.',
    tone: 'warning',
    icon: PencilLine,
    order: 3,
  },
  submitted: {
    label: '제출 완료',
    description: '응답이 제출되었습니다.',
    tone: 'success',
    icon: CheckCircle2,
    order: 4,
  },
  expired: {
    label: '기간 만료',
    description: '응답 기간이 종료되었습니다.',
    tone: 'neutral',
    icon: TimerOff,
    order: 5,
  },
  revoked: {
    label: '사용 중지',
    description: '링크가 회수되었습니다.',
    tone: 'danger',
    icon: Ban,
    order: 6,
  },
}

export const DISTRIBUTION_STATUSES = Object.keys(
  DISTRIBUTION_STATUS_META,
) as SurveyDistributionStatus[]

export const RESPONSE_STATUS_META: Record<SurveyResponseStatus, StatusMeta> = {
  not_started: {
    label: '미시작',
    description: '아직 응답이 시작되지 않았습니다.',
    tone: 'neutral',
    icon: Clock3,
    order: 0,
  },
  in_progress: {
    label: '작성 중',
    description: '응답이 작성되고 있습니다.',
    tone: 'warning',
    icon: PencilLine,
    order: 1,
  },
  submitted: {
    label: '제출 완료',
    description: '응답이 제출되었습니다.',
    tone: 'success',
    icon: Send,
    order: 2,
  },
}
