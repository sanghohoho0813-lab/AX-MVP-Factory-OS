/**
 * 예전 벤처 기록 (D-179 · 읽기 전용) — 사업계획서 7항목 · 신청 정보 · 제출서류 · Red Flag · Judge · 기준 확인.
 * LEGACY — 새 벤처 업무는 cert-os/venture 사용. 여기서는 고치지 않고 보여 주기만 한다(입력칸 없음).
 * 기록은 지우지 않는다 — 기업인증의 LEGACY 어댑터가 사업계획 초안 칸 수 · 신청일 · 특허 기록을 계속 읽는다.
 */

import { Badge } from '../ui/primitives'
import { useEditor } from './editorContext'
import { JUDGE_AXES, PLAN_SECTIONS, RED_FLAGS, judgeTotal, judgeVerdict } from '../../domain/consulting/qaRules'
import { VENTURE_DOCUMENTS } from '../../domain/consulting/projectModel'
import { LegacyVentureNotice } from './LegacyVentureNotice'
import { ReadRow, ReadSection, ReadValue } from './legacyRead'

export function VentureTab({ focus }: { focus?: string }) {
  void focus
  const { project: p } = useEditor()
  const v = p.venture
  const done = PLAN_SECTIONS.filter((s) => v.sections[s.no]?.done).length
  const docsDone = VENTURE_DOCUMENTS.filter((d) => v.documents[d.key]).length
  const cleared = RED_FLAGS.filter((f) => v.redFlagsCleared[f.no]).length
  const total = judgeTotal(v.judgeScores)
  const scored = JUDGE_AXES.filter((a) => typeof v.judgeScores[a.key] === 'number')
  const fresh = p.freshness.filter((f) => f.scope === 'venture_application').sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0]

  return (
    <div className="flex flex-col gap-4" data-testid="legacy-venture-record">
      <LegacyVentureNotice clientId={p.clientId} variant="record" />

      <ReadSection title="사업계획서 7항목" meta={`초안 ${done}/7 · 예전 기록`} testid="legacy-plan">
        <dl className="flex flex-col divide-y divide-slate-100">
          {PLAN_SECTIONS.map((s) => {
            const st = v.sections[s.no]
            return (
              <div key={s.no} data-testid="legacy-plan-section" data-no={s.no}>
                <ReadRow label={`${s.no}. ${s.title}`} value={st?.outline} extra={st?.done ? <Badge tone="success">초안 완료</Badge> : undefined} />
              </div>
            )
          })}
        </dl>
      </ReadSection>

      <ReadSection title="신청 정보" meta="예전 기록" testid="legacy-venture-application">
        <dl className="flex flex-col divide-y divide-slate-100">
          <ReadRow label="신청일" value={v.submittedAt} testid="legacy-submitted-at" />
          <ReadRow label="제출 메모" value={v.submissionNote} />
        </dl>
        <p className="t-sub break-keep text-slate-500">현재 진행상태는 기업인증에서 확인하세요.</p>
      </ReadSection>

      <details className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="legacy-venture-more">
        <summary className="tap t-sub cursor-pointer px-4 py-3 font-semibold text-slate-700">
          그 밖의 예전 기록 — 제출서류 {docsDone}/8 · Red Flag 확인 {cleared}/12 · Judge {total !== null ? `${total}/100` : scored.length ? `${scored.length}축 기록` : '기록 없음'}
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-700">기본 제출서류 8종</p>
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {VENTURE_DOCUMENTS.map((d) => (
                <li key={d.key} className={`t-sub break-keep ${v.documents[d.key] ? 'text-slate-800' : 'text-slate-400'}`}>
                  {v.documents[d.key] ? '✓' : '–'} {d.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-700">P0 Red Flag — 문제 없음 확인 {cleared}/12</p>
            <ul className="flex flex-col gap-0.5">
              {RED_FLAGS.map((f) => (
                <li key={f.no} className={`t-sub break-keep ${v.redFlagsCleared[f.no] ? 'text-slate-800' : 'text-slate-400'}`}>
                  {v.redFlagsCleared[f.no] ? '✓' : '–'} #{f.no} {f.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-700">Judge Scorecard {total === null ? '' : `— ${total}/100 · ${judgeVerdict(total)}`}</p>
            {scored.length === 0 ? (
              <p className="t-sub text-slate-400">기록 없음</p>
            ) : (
              <ul className="grid gap-0.5 sm:grid-cols-2">
                {scored.map((a) => (
                  <li key={a.key} className="t-sub break-keep text-slate-800">
                    {a.key}. {a.label} — {v.judgeScores[a.key]}점
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-700">신청 직전 기준 확인</p>
            <p className="t-sub">
              <ReadValue value={fresh ? `${fresh.checkedAt} · ${fresh.source}${fresh.differences ? ` · 달랐던 점: ${fresh.differences}` : ''}` : ''} />
            </p>
          </div>
        </div>
      </details>
    </div>
  )
}
