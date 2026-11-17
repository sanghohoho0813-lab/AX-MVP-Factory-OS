/**
 * D-627 글자 수 한도 — 모듈 첫 화면(한눈에 보기) 아래 면책 문구는 한 줄('참고용 1차 검토예요') + ? 에 전문.
 * 결과(판정 · 금액)가 나오는 화면은 예전처럼 전문을 그대로 둔다 — 첫 화면에는 아직 결과가 없다.
 */
import { HintTip } from '../../components/ui/fold'

export function ShortDisclaimer({ text, short = '참고용 1차 검토예요', testId }: { text: string; short?: string; testId?: string }) {
  return (
    <HintTip tip={text} label="참고용 1차 검토" className="self-start">
      <p className="t-meta break-keep text-slate-500" data-testid={testId}>
        {short}
      </p>
    </HintTip>
  )
}
