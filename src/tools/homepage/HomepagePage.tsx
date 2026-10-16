/**
 * 홈페이지 만들기 (D-202) — 웹 스튜디오 안의 도구.
 *
 * /tools/homepage            만든 홈페이지 목록 · 업체 고르기
 * /tools/homepage/build      업체로 연 편집 화면(?client=) — 업체 상세 '홈페이지 [만들기]' 가 여기로 온다
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, Search } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../shared/ModuleRoute'
import { useToolClient } from '../shared/toolClientContext'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { listRows } from '../../services/moduleData'
import type { ClientOpsRecord } from '../../types/clientOps'
import { HomepageBuilder } from './HomepageBuilder'
import { inputClass } from './BlockFields'
import { SITE_BUCKET, SITE_MODULE, useSiteDoc } from './useSiteDoc'

const BUILD = '/tools/homepage/build'

function ClientPicker() {
  const { loadClients, workspaceId } = useToolClient()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [made, setMade] = useState<Map<string, string>>(new Map())
  const [q, setQ] = useState('')
  useEffect(() => {
    let alive = true
    void loadClients().then((list) => alive && setClients(list.filter((c) => !c.archivedAt)))
    void listRows(workspaceId, SITE_MODULE, SITE_BUCKET)
      .then((rows) => alive && setMade(new Map(rows.filter((r) => r.clientId).map((r) => [r.clientId, r.updatedAt]))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId])
  const list = useMemo(() => {
    const all = (clients ?? []).filter((c) => !q.trim() || matchesClientSearch(c, q))
    // 만든 곳 먼저(최근 고친 순), 그다음 가나다
    return all.sort((a, b) => (made.get(b.id) ?? '').localeCompare(made.get(a.id) ?? '') || a.companyName.localeCompare(b.companyName, 'ko'))
  }, [clients, q, made])

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white flex flex-col gap-3 p-5" data-testid="site-picker">
      <div>
        <h2 className="t-section text-slate-900">어느 업체 홈페이지인가요?</h2>
        <p className="t-sub mt-1 break-keep text-slate-600">업체를 고르면 업체 기록으로 초안을 바로 만들어요. 업체 상세의 [홈페이지 만들기] 로 와도 같아요.</p>
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} pl-9`} placeholder="업체 이름 · 대표 · 전화로 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="업체 찾기" data-testid="site-picker-search" />
      </label>
      {clients === null ? (
        <p className="t-sub text-slate-400">업체 기록을 읽는 중…</p>
      ) : list.length === 0 ? (
        <p className="t-sub text-slate-500">맞는 업체가 없어요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {list.slice(0, 40).map((c) => (
            <li key={c.id}>
              <Link to={`${BUILD}?client=${encodeURIComponent(c.id)}`} className="tap flex min-h-12 items-center gap-3 py-2 hover:bg-slate-50" data-testid="site-picker-item">
                <Globe className={`size-4 shrink-0 ${made.has(c.id) ? 'text-brand-600' : 'text-slate-300'}`} aria-hidden="true" />
                <span className="t-body min-w-0 flex-1 truncate font-medium text-slate-800">{c.companyName}</span>
                {made.has(c.id) && <span className="t-meta shrink-0 text-brand-700">만든 홈페이지 있음</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BuildScreen() {
  const { clientId, clientRecord, workspaceId } = useToolClient()
  const store = useSiteDoc(clientId, workspaceId)
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
        description="업체 기록으로 업종 견본 홈페이지를 만들고, 블록을 고쳐 PC · 휴대폰으로 확인한 뒤 HTML 한 장으로 내려받습니다. 규칙으로 채우며 'AI' 가 아닙니다."
        descriptionAsHint
      />
      {section === 'build' ? <BuildScreen /> : <ClientPicker />}
    </div>
  )
}
