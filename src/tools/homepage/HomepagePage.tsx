/**
 * 홈페이지 만들기 (D-202) — 웹 스튜디오 안의 도구.
 *
 * /tools/homepage            만든 홈페이지 목록 · 누구 것을 만들지 고르기
 * /tools/homepage/build      업체로 연 편집 화면(?client=) — 업체 상세 '홈페이지 [만들기]' 가 여기로 온다
 *                            D-220: 가상 업체 · 컨설턴트로 연 화면(?trial=) — 고객 관리에 없어도 만들고, 마음에 들면 임시등록
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../shared/ModuleRoute'
import { useToolClient } from '../shared/toolClientContext'
import { listRows } from '../../services/moduleData'
import { rowSubjectId, trialRecord } from '../../services/marketingTrial'
import { HomepageBuilder } from './HomepageBuilder'
import { SITE_BUCKET, SITE_MODULE, useSiteDoc } from './useSiteDoc'
import { SubjectPicker } from '../marketing/SubjectPicker'
import { TrialBanner } from '../marketing/TrialBanner'
import { useTrials } from '../marketing/trialStore'

const LIST = '/tools/homepage'
const BUILD = '/tools/homepage/build'

function ClientPicker() {
  const { workspaceId } = useToolClient()
  const [made, setMade] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let alive = true
    void listRows(workspaceId, SITE_MODULE, SITE_BUCKET)
      .then((rows) => alive && setMade(new Map(rows.map((r) => [rowSubjectId(r), r.updatedAt] as const).filter(([id]) => !!id))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [workspaceId])
  return (
    <SubjectPicker
      buildPath={BUILD}
      made={made}
      madeLabel={() => '만든 홈페이지 있음'}
      icon={(on) => <Globe className={`size-4 shrink-0 ${on ? 'text-brand-600' : 'text-slate-300'}`} aria-hidden="true" />}
      testPrefix="site-picker"
      title="누구 홈페이지인가요?"
      desc="계약 고객 · 잠재고객 · 컨설턴트를 고르면 그 기록으로 초안을 바로 만들어요. 업체 상세의 [홈페이지 만들기] 로 와도 같아요."
    />
  )
}

/** D-220: 가상 업체 · 컨설턴트로 만드는 화면 */
function TrialBuild({ trialId }: { trialId: string }) {
  const { workspaceId } = useToolClient()
  const trials = useTrials(workspaceId)
  const trial = trials.trials.find((t) => t.id === trialId) ?? null
  const record = useMemo(() => (trial ? trialRecord(trial) : null), [trial])
  const store = useSiteDoc(trialId, workspaceId)
  if (trials.status === 'loading' || store.status === 'loading') return <p className="t-sub text-slate-400">불러오는 중…</p>
  if (trials.status === 'error' || store.status === 'error') return <p className="t-body text-danger-700">홈페이지를 읽지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
  // 이미 임시등록까지 마쳤으면 그 업체 화면으로
  if (trial?.registeredAt && trial.registeredClientId) return <Navigate to={`${BUILD}?client=${encodeURIComponent(trial.registeredClientId)}`} replace />
  if (!trial || !record)
    return (
      <p className="t-body text-slate-600" data-testid="trial-missing">
        가상 업체를 찾지 못했어요(지웠거나 다른 작업공간이에요).{' '}
        <Link to={LIST} className="tap font-semibold text-brand-700 hover:underline">
          목록으로
        </Link>
      </p>
    )
  return (
    <div className="flex flex-col gap-4">
      <TrialBanner trial={trial} store={trials} buildPath={BUILD} listPath={LIST} flush={store.flush} keepNote="만든 홈페이지를 그 업체로 옮겨요." />
      <HomepageBuilder key={trialId} record={record} store={store} />
    </div>
  )
}

function BuildScreen() {
  const { clientId, clientRecord, workspaceId } = useToolClient()
  const [params] = useSearchParams()
  const trialId = params.get('trial')
  const store = useSiteDoc(clientId, workspaceId)
  if (!clientId && trialId) return <TrialBuild key={trialId} trialId={trialId} />
  if (!clientId) return <ClientPicker />
  if (!clientRecord || store.status === 'loading') return <p className="t-sub text-slate-400">불러오는 중…</p>
  if (store.status === 'error') return <p className="t-body text-danger-700">홈페이지를 읽지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
  return <HomepageBuilder key={clientId} record={clientRecord} store={store} />
}

export function HomepagePage() {
  const section = useModuleSection()
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="홈페이지 만들기"
        description="고객 · 잠재고객 · 동료 컨설턴트, 고객 관리에 없는 가상 업체까지 — 기록으로 업종 견본 홈페이지를 만들고, 블록을 고쳐 PC · 휴대폰으로 확인한 뒤 HTML 한 장으로 내려받습니다. 규칙으로 채우며 'AI' 가 아닙니다."
        descriptionAsHint
      />
      {section === 'build' ? <BuildScreen /> : <ClientPicker />}
    </div>
  )
}
