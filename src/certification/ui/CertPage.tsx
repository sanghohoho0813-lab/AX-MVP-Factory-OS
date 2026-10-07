/**
 * 기업인증 (D-170) — 기업성장 › 기업인증. 목차는 toolRegistry 'cert-os' sections.
 *
 *   인증 한눈에 · 이노비즈 · 메인비즈 · 벤처기업 · 기업부설연구소 · ISO
 *
 * 판정은 전부 `src/certification/core` (OS 를 모르는 Core) — 이 화면은 어댑터(integration)로 업체를 넘기고 결과를 보여 줄 뿐.
 */
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../../tools/shared/ModuleRoute'
import { toolOf } from '../../config/toolRegistry'
import type { CertificationKey } from '../core/types'
import { factPatchOf, useCertData } from '../integration/useCertData'
import { readFact } from '../../services/customerFacts'
import { CertOverview, PickClient } from './CertOverview'
import { CertWorkspace } from './CertWorkspace'
import { IsoScreen } from './IsoScreen'

export default function CertPage() {
  const section = useModuleSection()
  const meta = toolOf('cert-os')?.sections?.find((s) => s.key === section)
  const d = useCertData()
  const head = <PageHeader title={d.clientName ? `${d.clientName} 기업인증` : '기업인증'} description={meta?.hint ? `${meta.label} — ${meta.hint}` : '어떤 인증을 왜 · 언제 · 무엇을 준비해서'} />

  if (!d.clientId) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <PickClient />
      </div>
    )
  }
  if (!d.ctx) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <p className="t-sub text-slate-500" role="status">
          업체 기록을 읽는 중…
        </p>
      </div>
    )
  }
  // P1: 칩으로 고른 특허 · 연구소 중 회사 정보(확인)와 다른 것 — [회사 정보에 확인된 사실로 저장] 대상
  const pendingFacts = d.clientRecord ? factPatchOf(d.profile).filter((f) => { const cur = readFact(d.clientRecord!, f.key); return !cur || cur.status !== 'confirmed' || cur.value !== f.value }) : []
  const key = section as CertificationKey
  const a = d.list.find((x) => x.key === key)
  const work = a ? d.workOf(key) : null
  return (
    <div className="flex flex-col gap-5" data-testid="cert-page">
      {head}
      {section === 'overview' && <CertOverview ctx={d.ctx} list={d.list} roadmap={d.roadmap} profile={d.profile} onProfile={(p) => void d.saveProfile(p)} clientId={d.clientId} pendingFacts={pendingFacts} onConfirmFacts={d.confirmFacts} />}
      {section === 'iso' && <IsoScreen list={d.list} ctx={d.ctx} />}
      {a && work && (
        <CertWorkspace
          key={a.key}
          a={a}
          ctx={d.ctx}
          clientId={d.clientId}
          answers={work.answers}
          prep={work.prep}
          notes={work.notes}
          onAnswer={(id, v) => void d.saveWork(a.key, { answers: { ...work.answers, [id]: v } })}
          onPrep={(id, p) => void d.saveWork(a.key, { prep: { ...work.prep, [id]: p } })}
          onNote={(k, text) => d.saveWork(a.key, { notes: { ...work.notes, [k]: text } })}
          life={d.lifeOf(a.key).life}
          onStatus={(s) => d.setStatus(a.key, s)}
          onComplete={(input, toProfile) => d.complete(a.key, input, { toProfile })}
          onPatchLife={(patch) => d.patchLife(a.key, patch)}
          onRequestDocs={(labels) => d.requestDocs(labels)}
        />
      )}
    </div>
  )
}
