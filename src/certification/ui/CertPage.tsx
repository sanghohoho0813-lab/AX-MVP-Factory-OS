/**
 * 기업인증 (D-170) — 기업성장 › 기업인증. 목차는 toolRegistry 'cert-os' sections.
 *
 *   인증 한눈에 · 이노비즈 · 메인비즈 · 벤처기업 · 기업부설연구소 · ISO
 *
 * 판정은 전부 `src/certification/core` (OS 를 모르는 Core) — 이 화면은 어댑터(integration)로 업체를 넘기고 결과를 보여 줄 뿐.
 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../../tools/shared/ModuleRoute'
import { toolOf } from '../../config/toolRegistry'
import type { CertificationKey } from '../core/types'
import { factPatchOf, useCertData } from '../integration/useCertData'
import { readFact } from '../../services/customerFacts'
import { CertOverview, PickClient } from './CertOverview'
import { CertWorkspace } from './CertWorkspace'
import { IsoScreen } from './IsoScreen'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { VenturePlanWorkbench } from './VenturePlanWorkbench'
import { sectionHref } from './certNav'

export default function CertPage() {
  const section = useModuleSection()
  const meta = toolOf('cert-os')?.sections?.find((s) => s.key === section)
  const d = useCertData()
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // D-246 벤처 사업계획서 쓰기 — 같은 벤처 기록(notes) 위에서
  const planOpen = section === 'venture' && params.get('plan') === '1'
  // D-225 저장이 안 되면 알린다 — 예전에는 칩 · 답 저장 실패를 삼켜 '✓ 확인했습니다' 만 보였다
  const saveFailed = (e: unknown) => {
    const why = e instanceof Error && e.message ? e.message : '연결을 확인하세요'
    // 저장소 오류 문구에 이미 '저장하지 못했…' 이 있으면 같은 말을 두 번 쓰지 않는다
    showToast(`${/저장하지 못했/.test(why) ? why : `저장하지 못했습니다: ${why}`} — 고른 것은 화면에 있지만 다시 열면 사라질 수 있어요. 다시 눌러 주세요.`)
  }
  const head = <PageHeader title={d.clientName ? `${d.clientName} 기업인증` : '기업인증'} description={meta?.hint ? `${meta.label} — ${meta.hint}` : '어떤 인증을 왜 · 언제 · 무엇을 준비해서'} />

  if (!d.clientId) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <PickClient />
      </div>
    )
  }
  // D-214: 모듈 기록(칩 · 답 · 진행 기록)을 다 읽은 뒤에 보여 준다 — 읽기 전에 누르면 같은 업체 줄이 하나 더 생겨 원래 줄을 가렸다
  if (!d.ctx || !d.loaded) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        {d.loadError ? (
          <div role="alert" data-testid="cert-load-error" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
            <p className="t-sub min-w-0 flex-1 break-keep font-semibold text-amber-900">기업인증 기록을 읽지 못했습니다. 저장해 둔 기록은 그대로 있고, 다시 읽기 전에는 바꾸지 않습니다.</p>
            <Button variant="secondary" size="sm" onClick={() => void d.reloadAll()}>
              다시 읽기
            </Button>
          </div>
        ) : (
          <p className="t-sub text-slate-500" role="status">
            업체 기록을 읽는 중…
          </p>
        )}
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
      {section === 'overview' && <CertOverview ctx={d.ctx} list={d.list} roadmap={d.roadmap} profile={d.profile} onProfile={(p) => void d.saveProfile(p).catch(saveFailed)} clientId={d.clientId} pendingFacts={pendingFacts} onConfirmFacts={d.confirmFacts} />}
      {section === 'iso' && <IsoScreen list={d.list} ctx={d.ctx} />}
      {a && work && planOpen && <VenturePlanWorkbench ctx={d.ctx} notes={work.notes} onSave={(patch) => d.saveWork(a.key, { notes: patch })} onBack={() => navigate(sectionHref('venture', d.clientId))} />}
      {a && work && !planOpen && (
        <CertWorkspace
          key={a.key}
          a={a}
          ctx={d.ctx}
          clientId={d.clientId}
          answers={work.answers}
          prep={work.prep}
          notes={work.notes}
          onAnswer={(id, v) => void d.saveWork(a.key, { answers: { [id]: v } }).catch(saveFailed)}
          onPrep={(id, p) => void d.saveWork(a.key, { prep: { [id]: p } }).catch(saveFailed)}
          onNote={(k, text) => d.saveWork(a.key, { notes: { [k]: text } })}
          life={d.lifeOf(a.key).life}
          onStatus={(s, seed) => d.setStatus(a.key, s, seed)}
          onComplete={(input, toProfile) => d.complete(a.key, input, { toProfile })}
          onPatchLife={(patch) => d.patchLife(a.key, patch)}
          onRequestDocs={(labels) => d.requestDocs(labels)}
        />
      )}
    </div>
  )
}
