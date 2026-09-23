/**
 * 연구소 고객사 — 업체를 연구소 눈으로 본다 (D-91).
 *
 * 업체 명단은 고객 운영 하나뿐이다. 이 화면은 그 명단 위에
 * 연구소 정보(유형·인정일·인정번호·연구전담요원)와 이번 달 연구노트 상태를 얹는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { currentMonth, type NoteStatus } from '../lib/noteDraft'
import { dedicatedCount, emptyLabInfo, researcherWarning, type LabInfoData, type LabType } from '../lib/labInfo'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

interface NoteData extends Record<string, unknown> {
  projectId: string
  month: string
  status: NoteStatus
}

export function LabClientsScreen() {
  const { loadClients, clientId } = useToolClient()
  const { showToast } = useToast()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const notes = useModuleBucket<NoteData>('labcare', 'notes')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(clientId)
  const [form, setForm] = useState<LabInfoData | null>(null)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const month = currentMonth()
  const infoOf = useMemo(() => {
    const map = new Map<string, { id: string; data: LabInfoData }>()
    for (const r of info.rows ?? []) map.set(r.clientId, { id: r.id, data: r.data })
    return map
  }, [info.rows])

  const notesThisMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of notes.rows ?? []) {
      if (n.data.month !== month) continue
      map.set(n.clientId, (map.get(n.clientId) ?? 0) + 1)
    }
    return map
  }, [notes.rows, month])

  if (clients === null || info.rows === null || notes.rows === null) {
    return <p className="t-sub text-slate-400">업체 기록을 읽는 중…</p>
  }

  const open = openId ? clients.find((c) => c.id === openId) : undefined

  if (open) {
    const cur = infoOf.get(open.id)
    const data = form ?? cur?.data ?? emptyLabInfo()
    const set = <K extends keyof LabInfoData>(k: K, v: LabInfoData[K]) => setForm({ ...data, [k]: v })
    const warn = researcherWarning(data)

    return (
      <div className="flex flex-col gap-5" data-testid="lab-client-detail" data-client={open.id}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpenId(null)
              setForm(null)
            }}
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 업체 목록
          </Button>
          <span className="t-card font-bold text-slate-900">{open.companyName}</span>
          <Link to={`/ops/clients/${open.id}`} className="t-meta text-brand-700 hover:underline">
            업체 기록 보기
          </Link>
        </div>

        <Surface>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">유형</span>
                <select aria-label="연구소 유형" value={data.labType} onChange={(e) => set('labType', e.target.value as LabType)} className={`mt-1 ${inputCls}`}>
                  <option value="기업부설연구소">기업부설연구소</option>
                  <option value="연구개발전담부서">연구개발전담부서</option>
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">연구소 이름</span>
                <input aria-label="연구소 이름" value={data.labName} onChange={(e) => set('labName', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">인정(신고)일</span>
                <input type="date" aria-label="인정일" value={data.certifiedDate} onChange={(e) => set('certifiedDate', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">인정번호</span>
                <input aria-label="인정번호" value={data.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} className={`mt-1 ${inputCls}`} />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="t-sub font-medium text-slate-600">연구전담요원</span>
              {data.researchers.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_9rem_5rem_2.5rem] items-center gap-2">
                  <input
                    aria-label={`${i + 1}번째 연구원 이름`}
                    value={r.name}
                    onChange={(e) => set('researchers', data.researchers.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)))}
                    className={inputCls}
                    placeholder="이름"
                  />
                  <input
                    aria-label={`${i + 1}번째 연구원 직책`}
                    value={r.role}
                    onChange={(e) => set('researchers', data.researchers.map((x, j) => (i === j ? { ...x, role: e.target.value } : x)))}
                    className={inputCls}
                    placeholder="연구소장 · 연구전담요원"
                  />
                  <input
                    type="date"
                    aria-label={`${i + 1}번째 연구원 입사일`}
                    value={r.joinDate}
                    onChange={(e) => set('researchers', data.researchers.map((x, j) => (i === j ? { ...x, joinDate: e.target.value } : x)))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    aria-pressed={r.dedicated}
                    onClick={() => set('researchers', data.researchers.map((x, j) => (i === j ? { ...x, dedicated: !x.dedicated } : x)))}
                    className={`tap rounded-(--radius-control) border px-2 py-2 t-meta font-medium ${
                      r.dedicated ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500'
                    }`}
                  >
                    {r.dedicated ? '전담' : '겸직'}
                  </button>
                  <Button variant="ghost" size="sm" aria-label={`${i + 1}번째 연구원 지우기`} onClick={() => set('researchers', data.researchers.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                data-testid="lab-researcher-add"
                onClick={() => set('researchers', data.researchers.concat([{ name: '', role: '연구전담요원', joinDate: '', dedicated: true }]))}
              >
                <Plus aria-hidden="true" className="size-4" /> 연구원 더하기
              </Button>
              {warn && <p className="t-meta break-keep text-amber-700" data-testid="lab-researcher-warn">{warn}</p>}
            </div>

            <label className="block">
              <span className="t-sub font-medium text-slate-600">메모</span>
              <textarea aria-label="연구소 메모" rows={2} value={data.memo} onChange={(e) => set('memo', e.target.value)} className={`mt-1 ${inputCls}`} />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="lab-info-save"
                onClick={async () => {
                  await info.save({ id: cur?.id, clientId: open.id, data })
                  setForm(null)
                  showToast('연구소 정보를 저장했습니다.')
                }}
              >
                저장
              </Button>
              <Link to={`/tools/labcare/notes?client=${open.id}`} className="t-sub self-center text-brand-700 hover:underline">
                이 업체 연구노트 쓰기
              </Link>
            </div>
            <p className="t-meta break-keep text-slate-400">신고관리시스템 비밀번호는 저장하지 않습니다.</p>
          </div>
        </Surface>
      </div>
    )
  }

  const withInfo = clients.filter((c) => infoOf.has(c.id))
  const noteDone = clients.filter((c) => (notesThisMonth.get(c.id) ?? 0) > 0)

  return (
    <div className="flex flex-col gap-5" data-testid="lab-clients">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="업체" value={`${clients.length}곳`} hint="고객 운영에 있는 업체" />
        <MetricTile label="연구소 정보 있음" value={`${withInfo.length}곳`} tone={withInfo.length > 0 ? 'brand' : 'neutral'} />
        <MetricTile label={`${month} 연구노트`} value={`${noteDone.length}곳`} tone={noteDone.length > 0 ? 'success' : 'warning'} />
        <MetricTile
          label="노트 안 쓴 업체"
          value={`${withInfo.length - noteDone.filter((c) => infoOf.has(c.id)).length}곳`}
          tone="warning"
        />
      </div>

      <Section title="업체" count={clients.length}>
        <ul className="flex flex-col gap-2">
          {clients.map((c) => {
            const d = infoOf.get(c.id)?.data
            const wrote = (notesThisMonth.get(c.id) ?? 0) > 0
            const tone: Tone = !d ? 'neutral' : wrote ? 'success' : 'warning'
            return (
              <li key={c.id}>
                <Surface as="div" edge={tone} showEdge={tone !== 'neutral'} padded={false}>
                  <button
                    type="button"
                    data-client={c.id}
                    onClick={() => {
                      setOpenId(c.id)
                      setForm(null)
                    }}
                    className="tap flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 text-left"
                  >
                    <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                    <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                    {d ? (
                      <>
                        <Badge tone="neutral">{d.labType}</Badge>
                        <span className="t-meta text-slate-500">전담 {dedicatedCount(d)}명</span>
                        {d.certifiedDate && <span className="t-meta text-slate-500">인정 {d.certifiedDate}</span>}
                      </>
                    ) : (
                      <span className="t-meta text-slate-400">연구소 정보 없음 — 눌러서 적기</span>
                    )}
                    <span className="ml-auto">
                      <Badge tone={wrote ? 'success' : 'warning'}>{wrote ? `${month} 노트 있음` : `${month} 노트 없음`}</Badge>
                    </span>
                  </button>
                </Surface>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
