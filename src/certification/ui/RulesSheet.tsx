/**
 * '기준 확인일 ⓘ' (AX) — 화면 아래 긴 안내문 대신 작은 단추 하나. 누르면 시트에:
 *   공식 기준과 MIRAE 판단의 차이 · 공식 출처 · 아직 확인하지 못한 것 · 공식 안내끼리 다른 것.
 * 인증 하나(cert)를 넘기면 그 인증만, 없으면 전부.
 */
import { useState } from 'react'
import { Info } from 'lucide-react'
import { BottomSheet } from '../../components/ui/primitives'
import { CERT_RULES, rulesStale, RULES_CHECKED_AT } from '../rules/officialRules'
import { ruleChangesOf } from '../rules/ruleChanges'
import type { CertificationKey } from '../core/types'

export function RulesInfoButton({ cert, today }: { cert?: CertificationKey; today: string }) {
  const [open, setOpen] = useState(false)
  const rules = cert ? [CERT_RULES[cert]] : Object.values(CERT_RULES)
  const stale = rules.some((r) => rulesStale(r, today))
  const checked = cert ? CERT_RULES[cert].checkedAt : RULES_CHECKED_AT
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tap t-sub inline-flex items-center gap-1.5 self-start font-semibold ${stale ? 'text-warning-800' : 'text-slate-500 hover:text-slate-800'}`}
        data-testid="cert-freshness"
      >
        {stale ? '최신 기준 확인 필요 · ' : ''}기준 확인일 {checked}
        <Info aria-hidden="true" className="size-4" />
      </button>
      {open && (
        <BottomSheet title="판단 기준 · 출처" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4" data-testid="cert-rules-sheet">
            <section className="flex flex-col gap-1">
              <h3 className="t-body font-bold text-slate-900">공식 기준과 MIRAE 판단은 다릅니다</h3>
              <p className="t-sub break-keep text-slate-700">
                준비도(매우 높음 ~ 매우 낮음)와 사전진단은 MIRAE 가 업체 기록으로 만든 판단입니다. 공식 점수(이노비즈 650 · 700점, 메인비즈 600 · 700점)와 섞지 않고, 공식 점수는 인증 화면의 [판단 근거 · 공식 기준 보기] 에 따로 적었습니다.
              </p>
              <p className="t-sub break-keep text-slate-700">확인된 사실(서류 · 전문 모듈 기록)이 고른 값보다 먼저입니다. 확인되지 않은 것은 '확인 필요' 로 둡니다.</p>
            </section>
            {rules.map((r) => {
              const changes = ruleChangesOf(r.key)
              return (
                <section key={r.key} className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" data-testid="cert-sources">
                  <h3 className="t-body font-bold text-slate-900">
                    {r.label} <span className="t-sub font-normal text-slate-500">· 마지막 확인 {r.checkedAt}</span>
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {r.sources.map((s) => (
                      <li key={s.name} className="t-sub break-keep text-slate-700" data-testid="cert-source">
                        <b className="font-semibold text-slate-900">{s.name}</b> — {s.version} · 시행 {s.effective}{' '}
                        <a href={s.url} target="_blank" rel="noreferrer noopener" className="tap inline-flex items-center font-semibold text-brand-700 underline">
                          공식 출처
                        </a>
                      </li>
                    ))}
                    {(r.conflicts ?? []).map((u) => (
                      <li key={u} className="t-sub break-keep text-danger-700" data-testid="cert-conflict">
                        공식 안내 상이 — 제출 전 확인 필요: {u}
                      </li>
                    ))}
                    {r.unverified.map((u) => (
                      <li key={u} className="t-sub break-keep text-warning-800" data-testid="cert-unverified">
                        공식 기준 추가 확인 필요: {u}
                      </li>
                    ))}
                    {changes.map((c) => (
                      <li key={c.rule + c.checkedAt} className="t-sub break-keep text-slate-600" data-testid="cert-rule-changes">
                        기준 바뀐 기록 {c.checkedAt} · {c.rule} — {c.change}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </BottomSheet>
      )}
    </>
  )
}
