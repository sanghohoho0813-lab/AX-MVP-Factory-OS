/**
 * D-220: 홈페이지 만들기 · 홍보 글 만들기 — '누구 것을 만들까요?'
 *
 * 예전에는 '어느 업체' 목록 하나뿐이라 잠재고객 · 컨설턴트 고객이 섞여 있어도 구분이 없었고, 고객 관리에 없는 곳은 만들 수 없었다.
 * 이제 계약 고객 · 잠재고객 · 컨설턴트 · 가상(직접 넣은 업체 · 컨설턴트)으로 나눠 보고, 가상으로 바로 만들어 볼 수 있다.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, Plus, Search, Sparkles } from 'lucide-react'
import { useToolClient } from '../shared/toolClientContext'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { isContractClient } from '../../services/salesPipeline'
import { clientTypeOf } from '../../services/clientType'
import { emptyTrial, TRIAL_KIND_LABEL, type TrialKind, type TrialProfile } from '../../services/marketingTrial'
import type { ClientOpsRecord } from '../../types/clientOps'
import { useToast } from '../../components/ui/toastContext'
import { HelpHeading } from '../../components/ui/fold'
import { inputClass } from '../homepage/BlockFields'
import { josa } from '../../lib/josa'
import { TrialForm } from './TrialForm'
import { TONE } from './mkTheme'
import { useTrials } from './trialStore'

type Group = 'contract' | 'lead' | 'consultant' | 'trial'
type Filter = 'all' | Group

const GROUP_LABEL: Record<Group, string> = { contract: '계약 고객', lead: '잠재고객', consultant: '컨설턴트', trial: '가상' }
/** 한 번에 그리는 줄 수 — 넘으면 '몇 곳 더' 와 찾기 칸으로 */
const LIST_MAX = 60

function groupOf(c: ClientOpsRecord): Group {
  if (clientTypeOf(c) === 'consultant') return 'consultant'
  return isContractClient(c) ? 'contract' : 'lead'
}

interface Row {
  id: string
  name: string
  group: Group
  href: string
  provisional: boolean
  kindLabel?: string
  search: (q: string) => boolean
}

export function SubjectPicker({
  buildPath,
  made,
  madeLabel,
  icon,
  testPrefix,
  title,
  desc,
  tone = 'violet',
  headIcon,
}: {
  buildPath: string
  /** 만든 것이 있는 곳(id → 마지막으로 고친 때) — 먼저 보이고 표시가 붙는다 */
  made: Map<string, string>
  madeLabel: (id: string) => string
  icon: (on: boolean) => ReactNode
  testPrefix: string
  title: string
  desc: string
  /** D-226 도구 색 — 홍보 글 보라 · 홈페이지 초록 */
  tone?: 'violet' | 'emerald'
  /** 제목 앞 색 아이콘 */
  headIcon?: ReactNode
}) {
  const t = TONE[tone]
  const { loadClients, workspaceId } = useToolClient()
  const trialsStore = useTrials(workspaceId)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [form, setForm] = useState<TrialProfile | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => alive && setClients(list.filter((c) => !c.archivedAt)))
    return () => {
      alive = false
    }
  }, [loadClients])

  // D-231 콘텐츠 레이더 › 내 콘텐츠 [홍보 글로] — 주제(kw)를 고른 업체 화면까지 들고 간다
  const [sp] = useSearchParams()
  const kw = (sp.get('kw') ?? '').trim().slice(0, 40)
  const carry = kw ? `&kw=${encodeURIComponent(kw)}` : ''
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = (clients ?? []).map((c) => ({
      id: c.id,
      name: c.companyName,
      group: groupOf(c),
      href: `${buildPath}?client=${encodeURIComponent(c.id)}${carry}`,
      provisional: !!c.provisional,
      search: (s: string) => matchesClientSearch(c, s),
    }))
    // 임시등록까지 마친 가상은 이제 고객 관리에 있다 — 여기서는 뺀다
    for (const t of trialsStore.trials.filter((x) => !x.registeredAt)) {
      const hay = [t.name, t.person, t.industry, t.phone, t.region].join(' ').toLowerCase()
      out.push({ id: t.id, name: t.name, group: 'trial', href: `${buildPath}?trial=${encodeURIComponent(t.id)}${carry}`, provisional: false, kindLabel: TRIAL_KIND_LABEL[t.kind], search: (s: string) => hay.includes(s.trim().toLowerCase()) })
    }
    return out
  }, [clients, trialsStore.trials, buildPath, carry])

  const counts = useMemo(() => {
    const n: Record<Filter, number> = { all: rows.length, contract: 0, lead: 0, consultant: 0, trial: 0 }
    for (const r of rows) n[r.group] += 1
    return n
  }, [rows])

  const list = useMemo(() => {
    const shown = rows.filter((r) => (filter === 'all' || r.group === filter) && (!q.trim() || r.search(q)))
    // 만든 곳 먼저(최근 고친 순), 그다음 가나다
    return shown.sort((a, b) => (made.get(b.id) ?? '').localeCompare(made.get(a.id) ?? '') || a.name.localeCompare(b.name, 'ko'))
  }, [rows, filter, q, made])

  const openForm = (kind: TrialKind) => setForm(emptyTrial(kind))

  const saveTrial = async (p: TrialProfile) => {
    if (saving) return
    setSaving(true)
    const saved = await trialsStore.save(p)
    setSaving(false)
    if (!saved) return showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    setForm(null)
    navigate(`${buildPath}?trial=${encodeURIComponent(saved.id)}${carry}`)
  }

  const loading = clients === null || trialsStore.status === 'loading'

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 shadow-sm" data-testid={testPrefix}>
      <div>
        <HelpHeading label={title} className="t-section flex items-center gap-2.5 text-slate-900">
          {headIcon && <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${t.solid}`}>{headIcon}</span>}
          {title}
        </HelpHeading>
        <p className="t-sub mt-1 break-keep text-slate-600">{desc}</p>
      </div>

      {/* D-238: 콘텐츠 레이더에서 들고 온 주제가 있으면 먼저 보여 준다 — 업체를 고르면 그 화면까지 같이 간다 */}
      {kw && (
        <p className={`t-sub flex items-start gap-1.5 rounded-(--radius-control) border px-3 py-2 break-keep [overflow-wrap:anywhere] ${t.line} ${t.soft} ${t.deep}`} data-testid="subject-carry-kw">
          <Sparkles className={`mt-0.5 size-4 shrink-0 ${t.text}`} aria-hidden="true" />
          <span className="min-w-0">
            콘텐츠 레이더에서 가져온 주제 <b className="font-bold">‘{kw}’</b> — 아래에서 업체를 고르면 이 주제로 바로 써요.
          </span>
        </p>
      )}

      {/* 고객 관리에 없어도 — 가상 업체 · 컨설턴트로 바로 */}
      <div className={`flex flex-col gap-2 rounded-(--radius-control) border p-3 ${t.line} ${t.soft}`} data-testid="trial-start">
        <p className={`t-sub flex items-start gap-1.5 break-keep font-semibold ${t.deep}`}>
          <Sparkles className={`mt-0.5 size-4 shrink-0 ${t.text}`} aria-hidden="true" />
          고객 관리에 없어도 돼요 — 잠재고객 · 동료 컨설턴트 · 가상의 업체로 먼저 만들어 보고, 마음에 들면 임시등록하세요.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openForm('company')} className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border bg-white px-3 font-semibold ${t.line} ${t.deep} ${t.hover}`} data-testid="trial-new-company">
            <Plus className="size-4" aria-hidden="true" /> 가상 업체로 만들기
          </button>
          <button type="button" onClick={() => openForm('consultant')} className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border bg-white px-3 font-semibold ${t.line} ${t.deep} ${t.hover}`} data-testid="trial-new-consultant">
            <BriefcaseBusiness className="size-4" aria-hidden="true" /> 컨설턴트로 만들기
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="누구 것인지 거르기">
        {(['all', 'contract', 'lead', 'consultant', 'trial'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`tap t-sub min-h-11 rounded-full border px-3 ${filter === f ? `border-transparent font-semibold shadow-sm ${t.solid}` : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            data-testid="subject-filter"
            data-filter={f}
          >
            {f === 'all' ? '전체' : GROUP_LABEL[f]} {counts[f]}
          </button>
        ))}
      </div>

      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputClass} pl-9`} placeholder="이름 · 대표 · 전화로 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="찾기" data-testid={`${testPrefix}-search`} />
      </label>

      {loading ? (
        <p className="t-sub text-slate-400">목록을 읽는 중…</p>
      ) : list.length === 0 ? (
        <p className="t-sub break-keep text-slate-500" data-testid={`${testPrefix}-empty`}>
          {filter === 'trial' ? (
            '아직 가상으로 만든 곳이 없어요. 위의 [가상 업체로 만들기] 를 눌러 보세요.'
          ) : q.trim() || counts[filter] > 0 ? (
            '맞는 곳이 없어요.'
          ) : (
            // D-236: 업체가 하나도 없을 때 무엇을 하면 되는지
            <>
              {filter === 'all' ? '아직 등록한 업체가 없어요.' : `아직 ${josa(GROUP_LABEL[filter], '이/가')} 없어요.`}{' '}
              <Link to="/ops/clients" className={`font-semibold underline underline-offset-2 ${t.text}`}>
                고객 관리
              </Link>
              에서 업체를 먼저 등록하거나, 위의 [가상 업체로 만들기] 로 먼저 만들어 보세요.
            </>
          )}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {list.slice(0, LIST_MAX).map((r) => (
            <li key={r.id}>
              <Link to={r.href} className="tap flex min-h-12 items-center gap-3 py-2 hover:bg-slate-50" data-testid={`${testPrefix}-item`} data-group={r.group}>
                {icon(made.has(r.id))}
                {/* 휴대폰에서는 '만든 것' 표시를 이름 아래 줄로 — 오른쪽에 두면 이름이 '한솔정…' 처럼 잘린다 */}
                <span className="min-w-0 flex-1">
                  <span className="t-body block truncate font-medium text-slate-800">{r.name}</span>
                  {made.has(r.id) && <span className={`t-meta block font-semibold sm:hidden ${t.text}`}>{madeLabel(r.id)}</span>}
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {made.has(r.id) && <span className={`t-meta hidden rounded-full px-2 py-0.5 font-semibold sm:inline ${t.icon}`}>{madeLabel(r.id)}</span>}
                  {r.provisional && <span className="t-meta rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">임시등록</span>}
                  <span className={`t-meta rounded-full border px-2 py-0.5 ${r.group === 'trial' ? `${t.line} ${t.soft} ${t.text}` : 'border-slate-200 text-slate-600'}`}>{r.kindLabel ?? GROUP_LABEL[r.group]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* D-236: 60곳에서 말없이 잘렸다 */}
      {!loading && list.length > LIST_MAX && (
        <p className="t-meta break-keep text-slate-500" data-testid={`${testPrefix}-more`}>
          {list.length - LIST_MAX}곳 더 있어요 — 위 찾기 칸에 이름을 적어 찾으세요.
        </p>
      )}

      {form && <TrialForm initial={form} busy={saving} onClose={() => setForm(null)} onSave={(p) => void saveTrial(p)} />}
    </section>
  )
}
