/** [D-119] 전략별 미팅 질문 5단계(meetingFlow.js)를 TS 에서 부를 때의 모양 */
export interface MeetingFlowStep {
  step: 'A' | 'B' | 'C' | 'D' | 'E'
  label: string
  q: string
}
type StrategyLike = { name: string; questions?: string[]; docs?: string[]; why?: string; effects?: string[] }
export function meetingQuestionFlow(strategy: StrategyLike): MeetingFlowStep[]
export function meetingDocs(strategy: StrategyLike): string[]
export function meetingShort(strategy: StrategyLike): string
export function meetingEffect(strategy: StrategyLike): string
