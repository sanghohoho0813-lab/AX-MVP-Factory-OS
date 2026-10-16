/**
 * 홍보 글 만들기 (D-203) — 웹 스튜디오 안의 도구.
 *
 * /tools/content            업체 고르기(보관함에 글이 있는 업체 먼저)
 * /tools/content/build      업체로 연 화면(?client=) — 업체 상세 '홍보 글 [만들기]' 가 여기로 온다
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Search } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useModuleSection } from '../shared/ModuleRoute'
import { useToolClient } from '../shared/toolClientContext'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { listRows } from '../../services/moduleData'
import { CONTENT_MODULE, ITEMS_BUCKET } from '../../services/contentStudio'
import type { ClientOpsRecord } from '../../types/clientOps'
import { inputClass } from '../homepage/BlockFields'
import { ContentStudio } from './ContentStudio'
import { useContentStore } from './useContentStore'

const BUILD = '/tools/content/build'

function ClientPicker() {
  const { loadClients, workspaceId } = useToolClient()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [count, setCount] = useState<Map<string, { n: number; last: string }>>(new Map())
  const [q, setQ] = useState('')
  useEffect(() => {
    let alive = true
    void loadClients().then((list) => alive && setClients(list.filter((c) => !c.archivedAt)))
    void listRows(workspaceId, CONTENT_MODULE, ITEMS_BUCKET)
      .then((rows) => {
        if (!alive) return
        const m = new Map<string, { n: number; last: string }>()
        for (const r of rows) {
          if (!r.clientId) continue
          const cur = m.get(r.clientId) ?? { n: 0, last: '' }
          m.set(r.clientId, { n: cur.n + 1, last: r.updatedAt > cur.last ? r.updatedAt : cur.last })
        }
        setCount(m)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId])
  const list = useMemo(() => {
    const all = (clients ?? []).filter((c) => !q.trim() || matchesClientSearch(c, q))
    return all.sort((a, b) => (count.get(b.id)?.last ?? '').localeCompare(count.get(a.id)?.last ?? '') || a.companyName.localeCompare(b.companyName, 'ko'))
  }, [clients, q, count])

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5" data-testid="content-picker">
      <div>
        <h2 className="t-section text-slate-900">어느 업체 홍보 글인가요?</h2>
        <p className="t-sub mt-1 break-keep text-slate-600">업체를 고르면 업체 기록으로 홍보 정보를 채우고, 먼저 만들 글 3개를 바로 골라 드려요. 업체 상세의 [홍보 글 만들기] 로 와도 같아요.</p>
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} pl-9`} placeholder="업체 이름 · 대표 · 전화로 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="업체 찾기" data-testid="content-picker-search" />
      </label>
      {clients === null ? (
        <p className="t-sub text-slate-400">업체 기록을 읽는 중…</p>
      ) : list.length === 0 ? (
        <p className="t-sub text-slate-500">맞는 업체가 없어요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {list.slice(0, 40).map((c) => (
            <li key={c.id}>
              <Link to={`${BUILD}?client=${encodeURIComponent(c.id)}`} className="tap flex min-h-12 items-center gap-3 py-2 hover:bg-slate-50" data-testid="content-picker-item">
                <PenLine className={`size-4 shrink-0 ${count.has(c.id) ? 'text-brand-600' : 'text-slate-300'}`} aria-hidden="true" />
                <span className="t-body min-w-0 flex-1 truncate font-medium text-slate-800">{c.companyName}</span>
                {count.has(c.id) && <span className="t-meta shrink-0 text-brand-700">글 {count.get(c.id)?.n}편</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StudioScreen() {
  const { clientId, clientRecord, workspaceId } = useToolClient()
  const store = useContentStore(clientId, workspaceId)
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
        description="업체 기록과 업종 견본으로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 소식 · 플레이스 소개 · 키워드를 바로 만들고 업체별로 보관합니다. 규칙으로 채우며 'AI' 가 아닙니다."
        descriptionAsHint
      />
      {section === 'build' ? <StudioScreen /> : <ClientPicker />}
    </div>
  )
}
