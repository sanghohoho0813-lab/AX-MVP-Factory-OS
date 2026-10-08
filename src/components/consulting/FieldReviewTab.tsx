/**
 * 예전 벤처 현장실사 · 결과 (D-179 · 읽기 전용) — S15 실사 준비 세트 · S16 결과.
 * LEGACY — 새 벤처 업무는 cert-os/venture 사용. 고치기 · 추가 · 결정 기록 없음(기록은 그대로).
 */

import { useEditor } from './editorContext'
import { EVIDENCE_PACK, findForbiddenPhrases } from '../../domain/consulting/qaRules'
import { FACTS } from '../../domain/consulting/factsheetSchema'
import { LegacyVentureNotice } from './LegacyVentureNotice'
import { ReadRow, ReadSection } from './legacyRead'

export function FieldReviewTab({ focus }: { focus?: string }) {
  void focus
  const { project: p } = useEditor()
  const fr = p.fieldReview
  const numbers = fr.numbersToMemorize.map((k) => `${FACTS.find((x) => x.key === k)?.label ?? k}: ${p.factsheet[k]?.value ?? ''}`).join('\n')
  const packDone = EVIDENCE_PACK.filter((e) => fr.evidencePackChecked[e.key]).length
  const forbidden = findForbiddenPhrases(`${fr.script}\n${fr.qa.map((q) => q.keyPoint).join('\n')}`)

  return (
    <div className="flex flex-col gap-4" data-testid="legacy-field-review">
      <LegacyVentureNotice clientId={p.clientId} variant="record" />
      {forbidden.length > 0 && (
        <p className="t-sub break-keep rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 text-warning-800" data-testid="legacy-forbidden">
          예전 기록에 금지 표현이 들어 있습니다: {forbidden.join(' · ')} — 다시 쓸 때는 증빙이 있는 말로 바꿔 주세요.
        </p>
      )}
      <ReadSection title="현장실사 준비 · 결과" meta="예전 벤처 기록">
        <dl className="flex flex-col divide-y divide-slate-100">
          <ReadRow label="실사 예정일" value={fr.reviewDate} />
          <ReadRow label="대표자 3분 Script" value={fr.script} />
          <ReadRow label="MVP 3분 Demo 동선" value={fr.demoFlow} />
          <ReadRow label={`예상질문 · 답변 Key Point (${fr.qa.length}개)`} value={fr.qa.map((q, i) => `${i + 1}. ${q.question}${q.keyPoint ? `\n   → ${q.keyPoint}` : ''}`).join('\n')} />
          <ReadRow label={`대표가 외울 숫자 (${fr.numbersToMemorize.length}개)`} value={numbers} />
          <ReadRow label="Evidence Pack" value={packDone ? `${packDone}/${EVIDENCE_PACK.length} 확인` : ''} />
          <ReadRow label="Mock Review" value={fr.mockReviewDone ? '1회 했음' : ''} />
          <ReadRow label="결과 · 후속" value={fr.result} />
        </dl>
      </ReadSection>
    </div>
  )
}
