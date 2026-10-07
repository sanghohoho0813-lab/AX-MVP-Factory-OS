/**
 * ISO (D-170) — 어떤 ISO 를 검토하면 좋은지 + 상담 요청. 인증 실행 시스템이 아니다.
 * 상담 요청은 업체 기록 활동에 남기고(업체명 · 업종 · 직원 수 · 관심 ISO · 보유 자료만), 문구를 복사해 대표에게 보낸다.
 */
import { useState } from 'react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { saveClient } from '../../services/clientOpsService'
import { withActivity } from '../../services/clientOpsActivity'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { brand } from '../../brand/brand.config'
import { CERT_RULES } from '../rules/officialRules'
import { isoConsultSummary } from '../iso/isoAdvice'
import type { CertificationAssessment, CertificationClientContext } from '../core/types'
import { ReasonList, RecBadge } from './certParts'

type IsoKey = 'iso9001' | 'iso14001' | 'iso45001'

export function IsoScreen({ list, ctx }: { list: CertificationAssessment[]; ctx: CertificationClientContext }) {
  const isos = list.filter((a): a is CertificationAssessment & { key: IsoKey } => a.key.startsWith('iso'))
  const [pick, setPick] = useState<IsoKey[]>(() => isos.filter((a) => a.recommendation === 'possible').map((a) => a.key))
  const [sent, setSent] = useState(false)
  const { clientRecord, replaceClient } = useToolClient()
  const { showToast } = useToast()
  const request = async () => {
    const text = isoConsultSummary(ctx, pick)
    try {
      await navigator.clipboard?.writeText(text).catch(() => undefined)
      if (clientRecord) {
        const saved = await saveClient(withActivity(clientRecord, 'tool', `${brand.ownerName} 대표에게 ISO 상담 요청 — ${pick.map((k) => CERT_RULES[k].label).join(' · ') || '종류 미정'}`))
        replaceClient(saved)
      }
      setSent(true)
      showToast(`상담 요청을 업체 기록에 남기고 문구를 복사했습니다 — ${brand.ownerName} 대표에게 보내 주세요`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '저장하지 못했습니다. 다시 눌러 주세요.')
    }
  }
  return (
    <div className="flex flex-col gap-3" data-testid="cert-iso">
      {isos.map((a) => {
        const rule = CERT_RULES[a.key]
        const on = pick.includes(a.key)
        return (
          <Surface key={a.key} as="section">
            <div className="flex flex-col gap-2" data-testid="cert-iso-card" data-key={a.key}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="t-section font-bold text-slate-900">{rule.label}</h3>
                <RecBadge rec={a.recommendation} />
              </div>
              <p className="t-body font-semibold break-keep text-slate-800">{a.oneLine}</p>
              <p className="t-sub break-keep text-slate-600">{rule.summary.split(' — ')[0]} · 현재판 {rule.sources[0].name.replace(/^ISO \d+:/, '')}</p>
              <ReasonList reasons={a.reasons} max={3} />
              {a.recommendation !== 'held' && (
                <label className="tap t-body inline-flex items-center gap-2 self-start text-slate-800">
                  <input type="checkbox" checked={on} onChange={(e) => setPick((p) => (e.target.checked ? [...p, a.key] : p.filter((k) => k !== a.key)))} className="size-5 accent-brand-600" data-testid={`cert-iso-pick-${a.key}`} />
                  상담에 넣기
                </label>
              )}
            </div>
          </Surface>
        )
      })}
      <Surface>
        <div className="flex flex-col gap-2" data-testid="cert-iso-consult">
          <h3 className="t-section font-bold text-slate-900">ISO 인증 진행이 필요하신가요?</h3>
          <p className="t-body break-keep text-slate-700">인증 종류와 준비 서류를 확인한 뒤 미래AI랩에서 진행 방법을 안내드립니다. ISO 인증은 한국인정평가원(KAB)이 인정한 인증기관이 심사해 발급합니다.</p>
          <Button variant="primary" className="self-start" onClick={() => void request()} disabled={sent} data-testid="cert-iso-request">
            {sent ? '상담 요청을 남겼습니다' : `${brand.ownerName} 대표에게 상담 요청`}
          </Button>
          <p className="t-sub break-keep text-slate-500">함께 보내는 것: 업체명 · 업종 · 직원 수 · 관심 ISO · 보유 자료(연락처 · 번호는 넣지 않습니다)</p>
        </div>
      </Surface>
    </div>
  )
}
