/**
 * 업무 항목 관리 — 기본 6종 외에 대표가 직접 항목을 만든다.
 *
 * 만든 항목은 워크스페이스 전체(모든 업체)에 적용된다. 현황표의 열이 업체마다
 * 달라지면 한눈에 비교할 수 없기 때문이다. 특정 업체에 해당하지 않으면 그 업체에서
 * 상태를 '보류' 로 두면 된다.
 *
 * 내린 항목은 지우지 않고 보관한다 — 이미 그 항목으로 적어 둔 기록이 사라지지
 * 않게 하기 위함이다.
 */

import { useEffect, useState } from 'react'
import { Archive, Plus, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { ACCENT_CLASS, BUILTIN_SERVICES, type ServiceAccent } from '../../content/clientOpsCatalog'
import {
  archiveCustomService,
  createCustomService,
  listCustomServices,
  restoreCustomService,
  type CustomService,
} from '../../services/customServiceService'
import { useBackToClose } from '../../lib/backToClose'
import { DEFAULT_PACKAGES, PKG_CATEGORIES } from '../../services/salesProposal'

/**
 * D-171 대표: "항목 추가는 웬만하면 클릭으로 — 모듈 · 상품표에 있는 40개 정도에서 골라 바로 만들게, 직접 쓰기도 되게".
 * 상품표(영업 제안 40종) 이름에서 '패키지' 꼬리만 떼어 항목 이름으로 쓴다. 분류 → 색 구분.
 */
const CAT_ACCENT: Record<string, ServiceAccent> = {
  '인증/연구소': 'doc',
  '자금/지원금': 'money',
  '세무/정관': 'plan',
  '승계/지분': 'plan',
  '복지/노무': 'client',
  '보험/퇴직금': 'money',
  '지식재산/브랜딩': 'doc',
  '신용/보증/성장지원': 'fund',
}
const pkgItemLabel = (name: string) => name.replace(/\s*패키지$/, '').trim()
const PKG_ITEMS = DEFAULT_PACKAGES.map((p) => ({ label: pkgItemLabel(p.name), cat: p.cat, description: p.desc }))

const ACCENTS: { key: ServiceAccent; label: string }[] = [
  { key: 'neutral', label: '기본' },
  { key: 'plan', label: '설립·계획' },
  { key: 'doc', label: '서류·인증' },
  { key: 'money', label: '자금' },
  { key: 'client', label: '고객' },
  { key: 'fund', label: '정책자금' },
]

const inputClass =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]'

export function ServiceCatalogModal({
  workspaceId,
  onClose,
  onChanged,
}: {
  workspaceId: string | null
  onClose: () => void
  /** 목록이 바뀌면 화면을 다시 그리도록 알린다 */
  onChanged: () => void
}) {
  useBackToClose(true, onClose)
  const [list, setList] = useState<CustomService[]>([])
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState<ServiceAccent>('neutral')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // D-122: 여기서는 목록만 읽는다 — 업무 칸 목록(카탈로그)은 화면이 업체를 다시 읽을 때 함께 올린다(어긋나는 틈이 없게)
  const reload = async () => setList(await listCustomServices(workspaceId))

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const add = async () => {
    setError('')
    setBusy(true)
    try {
      await createCustomService(workspaceId, { label, description, accent })
      setLabel('')
      setDescription('')
      setAccent('neutral')
      await reload()
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '항목을 추가하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async (svc: CustomService) => {
    setError('')
    try {
      await (svc.archived ? restoreCustomService(svc) : archiveCustomService(svc))
      await reload()
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '바꾸지 못했습니다.')
    }
  }

  // 상품표에서 한 번 눌러 바로 만든다(이미 있는 이름이면 되살리기만)
  const addFromCatalog = async (item: { label: string; cat: string; description: string }) => {
    setError('')
    const same = list.find((c) => c.label === item.label)
    if (same) {
      if (same.archived) await toggleArchive(same)
      return
    }
    setBusy(true)
    try {
      await createCustomService(workspaceId, { label: item.label, description: item.description, accent: CAT_ACCENT[item.cat] ?? 'neutral' })
      await reload()
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '항목을 추가하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const live = list.filter((c) => !c.archived)
  const liveLabels = new Set([...live.map((c) => c.label), ...BUILTIN_SERVICES.map((s) => s.label)])
  const archived = list.filter((c) => c.archived)

  return (
    <div className="ax-fade fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-4 sm:items-center">
      <div className="ax-pop max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-(--radius-panel) bg-white p-6 shadow-(--shadow-overlay)">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.3rem] font-bold text-slate-900">업무 항목 관리</h2>
          <button
            type="button"
            className="tap text-[0.95rem] text-slate-500 hover:text-slate-800"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <p className="mt-1 text-[0.95rem] break-keep text-slate-500">
          여기서 만든 항목은 <b className="font-semibold text-slate-700">내 작업공간</b>의 모든 업체 현황표에 열로 추가됩니다(다른 사람
          화면에는 보이지 않습니다). 해당 없는 업체에서는 상태를 &lsquo;보류&rsquo;로 두면 경고에서 빠집니다.
        </p>

        {/* 기본 항목 — 지울 수 없다 */}
        <div className="mt-5">
          <p className="text-[0.9rem] font-semibold text-slate-500">기본 항목 (고정)</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {BUILTIN_SERVICES.map((s) => (
              <li
                key={s.key}
                className={`rounded-full border px-2.5 py-1 text-[0.875rem] font-medium ${ACCENT_CLASS[s.accent].chip}`}
              >
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        {/* 직접 만든 항목 */}
        <div className="mt-5">
          <p className="text-[0.9rem] font-semibold text-slate-500">직접 만든 항목 {live.length}개</p>
          {live.length === 0 ? (
            <p className="mt-2 text-[0.95rem] text-slate-400">아직 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {live.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="text-[1rem] font-semibold text-slate-800">{c.label}</span>
                    {c.description && (
                      <span className="block text-[0.88rem] break-keep text-slate-500">{c.description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleArchive(c)}
                    className="tap flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-2.5 py-1.5 text-[0.88rem] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Archive aria-hidden="true" className="size-3.5" />
                    내리기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {archived.length > 0 && (
          <div className="mt-4">
            <p className="text-[0.9rem] font-semibold text-slate-500">내려둔 항목 {archived.length}개</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {archived.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-[0.98rem] text-slate-500">{c.label}</span>
                  <button
                    type="button"
                    onClick={() => void toggleArchive(c)}
                    className="tap flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-1.5 text-[0.88rem] font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                    되살리기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 상품표에서 골라 추가 — 누르면 바로 만들어진다 */}
        <div className="mt-6 border-t border-slate-200 pt-5" data-testid="service-pkg-picker">
          <p className="text-[1rem] font-bold text-slate-900">상품표에서 골라 추가</p>
          <p className="mt-1 text-[0.92rem] break-keep text-slate-500">누르면 바로 항목이 생깁니다. 이미 있는 항목은 회색입니다.</p>
          <div className="mt-3 flex flex-col gap-3">
            {PKG_CATEGORIES.map((cat) => {
              const items = PKG_ITEMS.filter((i) => i.cat === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <p className="text-[0.88rem] font-semibold text-slate-600">{cat}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {items.map((i) => {
                      const have = liveLabels.has(i.label)
                      return (
                        <button
                          key={i.label}
                          type="button"
                          disabled={have || busy}
                          title={i.description}
                          onClick={() => void addFromCatalog(i)}
                          className={`tap inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-[0.9rem] font-medium break-keep ${
                            have ? 'border-slate-200 bg-slate-100 text-slate-400' : `${ACCENT_CLASS[CAT_ACCENT[cat] ?? 'neutral'].chip} hover:ring-2 hover:ring-brand-300`
                          }`}
                          data-testid="service-pkg"
                          data-have={have}
                        >
                          {!have && <Plus aria-hidden="true" className="size-3.5 shrink-0" />}
                          {i.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 새 항목 */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-[1rem] font-bold text-slate-900">직접 써서 추가</p>
          <div className="mt-3 grid gap-3">
            <label className="text-[0.95rem] font-medium text-slate-700">
              항목 이름
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: ISO 인증"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <label className="text-[0.95rem] font-medium text-slate-700">
              설명 (선택)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어떤 업무인지 한 줄로"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <div>
              <span className="text-[0.95rem] font-medium text-slate-700">색 구분</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    aria-pressed={accent === a.key}
                    onClick={() => setAccent(a.key)}
                    className={`tap rounded-full border px-2.5 py-1 text-[0.88rem] font-medium ${ACCENT_CLASS[a.key].chip} ${
                      accent === a.key ? 'ring-2 ring-brand-400' : ''
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[0.92rem] font-medium text-danger-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || label.trim().length === 0}
              onClick={() => void add()}
            >
              {busy ? '추가 중…' : '항목 추가'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
