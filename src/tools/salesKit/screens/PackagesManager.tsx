/**
 * 컨설팅 상품 관리 — 원본 Packages 화면 (D-92).
 *
 * 기본 상품 40종 위에 대표가 직접 더하고·고치고·지운다. 지운 것은 '샘플 복원' 으로 되살린다.
 * 고친 목록은 모듈 기록 `sales-kit/profile` 의 packages 에 둔다 — 영업 카드의 추천·제안서·업무범위서가 이 목록을 쓴다.
 * '제안하기' 는 업체를 골라 그 업체 영업 카드의 제안서로 바로 간다.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Badge, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { ConfirmModal } from '../../../components/ui/ConfirmModal'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { DEFAULT_PACKAGES, PKG_CATEGORIES, type SalesPackage } from '../lib/salesData.js'
import type { SalesDocsData } from '../lib/salesDocs.js'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

type Form = Omit<SalesPackage, 'docs' | 'fee'> & { docs: string; fee: string }

function emptyForm(): Form {
  return { id: '', name: '', cat: PKG_CATEGORIES[0], fee: '', strat: '', desc: '', fit: '', docs: '', caution: '', simple: '', kakao: '', point: '', sample: '' }
}

export function PackagesManager() {
  const { showToast } = useToast()
  const [toDelete, setToDelete] = useState<SalesPackage | null>(null)
  const { loadClients } = useToolClient()
  const bucket = useModuleBucket<SalesDocsData>('sales-kit', 'profile')
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [cat, setCat] = useState('전체')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [pick, setPick] = useState<{ pkg: SalesPackage; clientId: string } | null>(null)

  useEffect(() => {
    let alive = true
    void loadClients().then((l) => {
      if (alive) setClients(l.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  if (bucket.rows === null) return <p className="t-sub text-slate-400">상품 목록을 읽는 중…</p>
  const row = bucket.rows[0]
  const cur: SalesDocsData = row?.data ?? {}
  const base: SalesPackage[] = cur.packages && cur.packages.length ? cur.packages : DEFAULT_PACKAGES
  const list = base.filter((p) => (cat === '전체' || p.cat === cat) && (!q.trim() || `${p.name} ${p.cat} ${p.fit} ${p.desc}`.includes(q.trim())))
  const persist = (arr: SalesPackage[]) => bucket.save({ id: row?.id, clientId: '', data: { ...cur, packages: arr } })

  const saveForm = () => {
    if (!form) return
    if (!form.name.trim()) {
      showToast('상품명을 입력해주세요.')
      return
    }
    const item: SalesPackage = {
      ...form,
      id: form.id || `pkg${Date.now().toString(36)}`,
      fee: Number(form.fee) || 0,
      docs: form.docs.split(',').map((s) => s.trim()).filter(Boolean),
    }
    const exists = base.some((p) => p.id === item.id)
    void persist(exists ? base.map((p) => (p.id === item.id ? item : p)) : [...base, item]).then(() => {
      showToast(exists ? '상품을 고쳤습니다.' : '상품을 더했습니다.')
      setForm(null)
    })
  }
  const del = (p: SalesPackage) => {
    void persist(base.filter((x) => x.id !== p.id)).then(() => showToast('지웠습니다.'))
    setToDelete(null)
  }
  const restore = () => {
    const names = new Set(base.map((p) => p.name))
    const add = DEFAULT_PACKAGES.filter((p) => !names.has(p.name))
    void persist([...base, ...add]).then(() => showToast(add.length ? `샘플 상품 ${add.length}건을 복원했습니다.` : '이미 모두 들어가 있습니다.'))
  }

  return (
    <Section title="상품 관리" count={base.length} action={<span className="t-meta text-slate-500">더하기·고치기·지우기 · 영업 카드가 이 목록을 씁니다</span>}>
      <div className="flex flex-col gap-3" data-testid="sales-packages-manager">
        <p className="t-meta break-keep text-slate-500">상품 카드에는 고정 금액을 약속하지 않습니다. 제안 금액은 업체를 고른 뒤 월납 보험료 기준으로 협의 후 정리합니다(영업 카드 → 견적·업무범위서).</p>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="상품 찾기" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명·분류·적합 고객 검색" className={`${inputCls} min-w-0 flex-1`} />
          <Button size="sm" variant="primary" onClick={() => setForm(emptyForm())} data-testid="sales-package-add">
            ＋ 상품 더하기
          </Button>
          <Button size="sm" variant="ghost" onClick={restore}>
            샘플 복원
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['전체', ...PKG_CATEGORIES].map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`tap t-meta rounded-full border px-2.5 py-1 ${cat === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              {c}
            </button>
          ))}
        </div>

        {form && (
          <Surface edge="brand" showEdge className="grid gap-2 sm:grid-cols-2" data-testid="sales-package-form">
            <label className="block">
              <span className="t-meta text-slate-500">상품명</span>
              <input aria-label="상품명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="t-meta text-slate-500">분류</span>
              <select aria-label="상품 분류" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} className={inputCls}>
                {PKG_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="t-meta text-slate-500">기준가 (만원)</span>
              <input aria-label="기준가" inputMode="numeric" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="t-meta text-slate-500">준비 자료 (쉼표로)</span>
              <input aria-label="준비 자료" value={form.docs} onChange={(e) => setForm({ ...form, docs: e.target.value })} className={inputCls} />
            </label>
            {(
              [
                ['desc', '설명'],
                ['fit', '적합 고객'],
                ['caution', '유의'],
                ['simple', '쉬운 설명'],
                ['kakao', '카톡 문구'],
                ['point', '영업 포인트'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block sm:col-span-2">
                <span className="t-meta text-slate-500">{label}</span>
                <input aria-label={label} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
              </label>
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" variant="primary" onClick={saveForm} data-testid="sales-package-save">
                저장
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
                닫기
              </Button>
            </div>
          </Surface>
        )}

        {pick && (
          <Surface edge="brand" showEdge className="flex flex-wrap items-center gap-2">
            <span className="t-sub font-bold">{pick.pkg.name} — 어느 업체에 제안할까요?</span>
            <select aria-label="제안할 업체" value={pick.clientId} onChange={(e) => setPick({ ...pick, clientId: e.target.value })} className={`${inputCls} w-auto`}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
            <Link to={`/tools/sales-kit/reports?card=${pick.clientId}`} className="t-sub font-bold text-brand-700 hover:underline">
              그 업체 영업 카드에서 제안서 만들기 →
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setPick(null)}>
              닫기
            </Button>
          </Surface>
        )}

        <ConfirmModal
          open={toDelete !== null}
          title="이 상품을 지울까요?"
          message={`${toDelete?.name ?? ''} — 샘플 복원으로 되살릴 수 있습니다.`}
          confirmLabel="지우기"
          danger
          onConfirm={() => toDelete && del(toDelete)}
          onCancel={() => setToDelete(null)}
        />
        <ul className="grid gap-2 lg:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <Surface className="flex flex-col gap-1.5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="t-body">{p.name}</b>
                  <Badge tone="brand">{p.cat}</Badge>
                  <span className="t-meta text-slate-500">{p.fee ? `${p.fee.toLocaleString()}만원` : ''}</span>
                </div>
                <p className="t-sub break-keep text-slate-600">{p.desc}</p>
                <p className="t-meta break-keep text-slate-500">적합: {p.fit}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => setPick({ pkg: p, clientId: clients[0]?.id ?? '' })}>
                    🎁 제안하기
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...p, fee: String(p.fee ?? ''), docs: (p.docs ?? []).join(', ') })}>
                    수정
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(p)}>
                    삭제
                  </Button>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
