/**
 * 홍보 글 만들기 (D-203) — 웹 스튜디오 안의 도구.
 *
 * /tools/content            누구 것을 만들지 고르기(보관함에 글이 있는 곳 먼저)
 * /tools/content/build      업체로 연 화면(?client=) — 업체 상세 '홍보 글 [만들기]' 가 여기로 온다
 *                           D-220: 가상 업체 · 컨설턴트로 연 화면(?trial=) — 고객 관리에 없어도 만들고, 마음에 들면 임시등록
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../shared/ModuleRoute'
import { useToolClient } from '../shared/toolClientContext'
import { listRows } from '../../services/moduleData'
import { CONTENT_MODULE, ITEMS_BUCKET } from '../../services/contentStudio'
import { rowSubjectId, trialRecord } from '../../services/marketingTrial'
import { ContentStudio } from './ContentStudio'
import { useContentStore } from './useContentStore'
import { SubjectPicker } from '../marketing/SubjectPicker'
import { TrialBanner } from '../marketing/TrialBanner'
import { useTrials } from '../marketing/trialStore'
import { MarketingTabs } from '../marketing/MarketingTabs'

const LIST = '/tools/content'
const BUILD = '/tools/content/build'

function ClientPicker() {
  const { workspaceId } = useToolClient()
  const [count, setCount] = useState<Map<string, { roots: Set<string>; last: string }>>(new Map())
  useEffect(() => {
    let alive = true
    void listRows(workspaceId, CONTENT_MODULE, ITEMS_BUCKET)
      .then((rows) => {
        if (!alive) return
        const m = new Map<string, { roots: Set<string>; last: string }>()
        for (const r of rows) {
          const id = rowSubjectId(r)
          if (!id) continue
          const cur = m.get(id) ?? { roots: new Set<string>(), last: '' }
          // D-220: 고친 판마다 한 줄이라 줄 수로 세면 '글 3편' 처럼 부풀었다 — 사슬(처음 글)로 센다
          cur.roots.add(typeof r.data.rootId === 'string' && r.data.rootId ? r.data.rootId : r.id)
          if (r.updatedAt > cur.last) cur.last = r.updatedAt
          m.set(id, cur)
        }
        setCount(m)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [workspaceId])
  const made = useMemo(() => new Map([...count].map(([id, v]) => [id, v.last] as const)), [count])
  return (
    <SubjectPicker
      buildPath={BUILD}
      made={made}
      madeLabel={(id) => `글 ${count.get(id)?.roots.size ?? 0}편`}
      icon={(on) => <PenLine className={`size-4 shrink-0 ${on ? 'text-violet-600' : 'text-slate-300'}`} aria-hidden="true" />}
      testPrefix="content-picker"
      tone="violet"
      headIcon={<PenLine className="size-5" />}
      title="누구 홍보 글인가요?"
      desc="계약 고객 · 잠재고객 · 컨설턴트를 고르면 그 기록으로 홍보 정보를 채우고, 먼저 만들 글 3개를 바로 골라 드려요. 업체 상세의 [홍보 글 만들기] 로 와도 같아요."
    />
  )
}

/** D-220: 가상 업체 · 컨설턴트로 만드는 화면 */
function TrialStudio({ trialId }: { trialId: string }) {
  const { workspaceId } = useToolClient()
  const trials = useTrials(workspaceId)
  const trial = trials.trials.find((t) => t.id === trialId) ?? null
  const record = useMemo(() => (trial ? trialRecord(trial) : null), [trial])
  const store = useContentStore(trialId, workspaceId)
  if (trials.status === 'loading' || store.status === 'loading') return <p className="t-sub text-slate-400">불러오는 중…</p>
  if (trials.status === 'error' || store.status === 'error') return <p className="t-body text-danger-700">홍보 글을 읽지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
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
      <TrialBanner trial={trial} store={trials} buildPath={BUILD} listPath={LIST} keepNote="보관함에 저장한 글 · 고친 홍보 정보를 그 업체로 옮겨요(저장하지 않은 글은 옮겨 가지 않아요)." />
      <ContentStudio key={trialId} record={record} store={store} />
    </div>
  )
}

function StudioScreen() {
  const { clientId, clientRecord, workspaceId } = useToolClient()
  const [params] = useSearchParams()
  const trialId = params.get('trial')
  const store = useContentStore(clientId, workspaceId)
  if (!clientId && trialId) return <TrialStudio key={trialId} trialId={trialId} />
  if (!clientId) return <ClientPicker />
  if (!clientRecord || store.status === 'loading') return <p className="t-sub text-slate-400">불러오는 중…</p>
  if (store.status === 'error') return <p className="t-body text-danger-700">홍보 글을 읽지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
  return <ContentStudio key={clientId} record={clientRecord} store={store} />
}

export function ContentPage() {
  const section = useModuleSection()
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="홍보 글 만들기"
        description="고객 · 잠재고객 · 동료 컨설턴트, 고객 관리에 없는 가상 업체까지 — 기록과 업종 견본으로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 소식 · 플레이스 소개 · 키워드를 바로 만들고 보관합니다. 규칙으로 채우며 'AI' 가 아닙니다."
        descriptionAsHint
      />
      {/* D-231 마케팅 · 브랜딩 목차 한 줄(콘텐츠 레이더 · 내 콘텐츠 · 홈페이지와 같은 줄) */}
      <MarketingTabs active="content" />
      {section === 'build' ? <StudioScreen /> : <ClientPicker />}
    </div>
  )
}
