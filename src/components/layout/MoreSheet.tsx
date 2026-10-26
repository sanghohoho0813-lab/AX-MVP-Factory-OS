/**
 * D-295 휴대폰 '더보기' — 아래에서 올라오는 전체 메뉴 판.
 *
 * 대표(2026-10-26): "더보기 누르면 PC 왼쪽 창이 그대로 나오는데 — 아래에서 올라오는 방식으로. 오늘 · 고객 · 영업 · 전문 모듈 순서는 같게,
 *   대신 오늘 아래 '오늘 · 확인할 것 · 일정' 세 개는 가로로 나열, 고객 아래 네 개도 세로 말고 가로로. 맨 아래에는 설정 · PC/Mobile 보기 ·
 *   누구 아이디로 들어왔는지 · MIRAE AI LAB OS. 그리고 커스터마이징 할 수 있게."
 *  - 묶음 · 줄은 왼쪽 메뉴와 같은 메뉴 표(moduleRegistry — 계정마다 보이는 줄 · 고급 기능 · 권한 그대로). 칸마다 아이콘 + 이름(4칸씩).
 *  - 전문 모듈 분야(기업성장 · 절세 · 재무 …)는 분야 이름 줄 + 그 안 기능 칸.
 *  - [아래 메뉴 바꾸기] — 아래 칸(최대 5개)을 고르고 순서를 바꾼다(이 기기에 기억 · 기본으로 되돌리기).
 *  - 왼쪽 위 ☰ 서랍 메뉴는 그대로 둔다(같은 메뉴 표).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, RotateCcw, Settings2, X, type LucideIcon } from 'lucide-react'
import { brand } from '../../brand/brand.config'
import { BrandLogo } from '../brand/BrandLogo'
import { enabledModulesByGroup, moduleMatchLength, navPathForSidebar, type ModuleDefinition } from '../../config/moduleRegistry'
import { groupTone, moduleTone, toneClass } from '../../config/featureVisual'
import { FUTURE_ITEMS, type FutureItem } from '../../config/capabilityStatus'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { useNavPath } from '../../lib/navFrom'
import { useBackToClose } from '../../lib/backToClose'
import { MOBILE_NAV_DEFAULT, MOBILE_NAV_MAX, navCandidates, resolveMobileNav, saveMobileNavKeys, shortLabel, useMobileNavKeys } from '../../lib/mobileNavPrefs'
import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { useEntitlements } from '../../lib/entitlementsStore'
import { useCurrentUser } from './useCurrentUser'
import { useNavCounts, type NavCounts } from './useNavCounts'
import { SignOutButton } from './AccountSwitch'
import { DeviceSwitch } from './DeviceView'
import { FutureItemDialog } from './FutureItemDialog'
import { futureIcon } from './futureIcons'

function badgeOf(m: ModuleDefinition, counts: NavCounts): { n: number; red: boolean } | null {
  if (!m.badge) return null
  const n = m.badge === 'clients' ? counts.clients : m.badge === 'requests' ? counts.requests : counts.firstMeetings
  if (n === null) return null
  if (m.badge === 'clients') return { n, red: false }
  return n > 0 ? { n, red: true } : null
}

/** 칸 하나 — 아이콘(기능 색 옅은 바탕) + 이름 두 줄까지 */
function Tile({ icon: Icon, label, toneKey, active, badge, soon, locked }: { icon: LucideIcon; label: string; toneKey: string; active: boolean; badge?: { n: number; red: boolean } | null; soon?: boolean; locked?: boolean }) {
  const t = toneClass(moduleTone(toneKey))
  return (
    <>
      <span aria-hidden="true" className={`relative flex size-12 items-center justify-center rounded-2xl ${active ? 'bg-brand-600 text-white ring-2 ring-brand-200' : `${t.soft} ${t.icon}`}`}>
        <Icon className="size-6" />
        {badge && badge.red && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[0.8125rem] leading-none font-bold text-white tabular-nums ring-2 ring-white">
            {badge.n > 99 ? '99+' : badge.n}
          </span>
        )}
      </span>
      <span className={`t-meta line-clamp-2 w-full text-center leading-tight break-keep ${active ? 'font-bold text-brand-800' : 'font-medium text-slate-700'}`}>
        {label}
        {badge && !badge.red && <span className="ml-0.5 font-normal text-slate-400 tabular-nums">{badge.n > 999 ? '999+' : badge.n}</span>}
      </span>
      {(soon || locked) && <span className="t-meta -mt-0.5 text-[0.75rem] leading-none text-slate-400">{locked ? '잠김' : '준비 중'}</span>}
    </>
  )
}

const tileCls = 'tap flex min-h-[5.5rem] min-w-0 flex-col items-center justify-start gap-1 rounded-xl px-0.5 py-1.5 hover:bg-slate-50'

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackToClose(open, onClose)
  useStoreVersion()
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  const { ent } = useEntitlements()
  const counts = useNavCounts()
  const navPath = navPathForSidebar(useNavPath())
  const me = useCurrentUser()
  const saved = useMobileNavKeys()
  const [editing, setEditing] = useState(false)
  const [future, setFuture] = useState(false)
  const [picked, setPicked] = useState<FutureItem | null>(null)
  useEffect(() => {
    if (!open) {
      setEditing(false)
      setFuture(false)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const groups = enabledModulesByGroup({ advanced: isAdvancedVisible(), pilot, caps })
  const candidates = navCandidates(groups)
  const current = resolveMobileNav(saved, candidates)
  const currentKeys = current.map((m) => m.key)
  const setKeys = (keys: string[]) => saveMobileNavKeys(keys)
  const move = (i: number, d: -1 | 1) => {
    const next = [...currentKeys]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setKeys(next)
  }
  const isDefault = saved === null || JSON.stringify(currentKeys) === JSON.stringify(resolveMobileNav(null, candidates).map((m) => m.key))
  const locked = (m: ModuleDefinition) => (m.moduleKey ? !ent.module(m.moduleKey).usable : false)

  const link = (m: ModuleDefinition) => (
    <li key={m.key} className="min-w-0">
      <Link to={m.path} onClick={onClose} className={tileCls} data-testid="more-tile" data-key={m.key} aria-current={moduleMatchLength(m, navPath) > 0 ? 'page' : undefined}>
        <Tile icon={m.icon} label={m.label} toneKey={m.key} active={moduleMatchLength(m, navPath) > 0} badge={badgeOf(m, counts)} soon={m.status === 'soon' || m.status === 'next'} locked={locked(m)} />
      </Link>
    </li>
  )

  return (
    <div className="fixed inset-0 z-50 lg:hidden" data-testid="more-sheet-wrap">
      <button type="button" aria-label="메뉴 배경 닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-navy-950/50" />
      <div role="dialog" aria-modal="true" aria-label="전체 메뉴" data-testid="more-sheet" className="more-sheet-up absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white shadow-(--shadow-overlay)">
        <div className="flex shrink-0 flex-col items-center px-4 pt-2">
          <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-300" />
          <div className="flex w-full items-center gap-2 py-2">
            <h2 className="t-section min-w-0 flex-1 text-slate-900">{editing ? '아래 메뉴 바꾸기' : '전체 메뉴'}</h2>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} data-testid="more-edit-nav" className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-200 px-3 font-semibold text-slate-700 hover:bg-slate-50">
                <Settings2 aria-hidden="true" className="size-4" /> 아래 메뉴 바꾸기
              </button>
            )}
            <button type="button" aria-label="메뉴 닫기" onClick={onClose} className="tap flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        <div className="pb-safe flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {editing ? (
            <div className="flex flex-col gap-4" data-testid="more-nav-editor">
              <p className="t-sub break-keep text-slate-600">휴대폰 아래 칸에 둘 메뉴를 최대 {MOBILE_NAV_MAX}개 고르세요. 맨 끝 '더보기' 는 늘 있어요. 이 기기에만 기억해요.</p>
              <section className="flex flex-col gap-2">
                <h3 className="t-meta font-bold text-slate-500">지금 아래 칸 ({current.length}/{MOBILE_NAV_MAX})</h3>
                <ol className="flex flex-col gap-1.5" data-testid="more-nav-current">
                  {current.map((m, i) => (
                    <li key={m.key} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5" data-key={m.key}>
                      <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">{i + 1}</span>
                      <m.icon aria-hidden="true" className={`size-5 shrink-0 ${toneClass(moduleTone(m.key)).icon}`} />
                      <span className="t-sub min-w-0 flex-1 truncate font-semibold text-slate-800">
                        {shortLabel(m)} <span className="t-meta font-normal text-slate-500">· {m.label}</span>
                      </span>
                      <button type="button" aria-label={`${m.label} 앞으로`} disabled={i === 0} onClick={() => move(i, -1)} className="tap flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowLeft aria-hidden="true" className="size-4" />
                      </button>
                      <button type="button" aria-label={`${m.label} 뒤로`} disabled={i === current.length - 1} onClick={() => move(i, 1)} className="tap flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </button>
                      <button type="button" aria-label={`${m.label} 빼기`} disabled={current.length <= 1} onClick={() => setKeys(currentKeys.filter((k) => k !== m.key))} className="tap flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-30" data-testid="more-nav-remove">
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="t-meta font-bold text-slate-500">더할 수 있는 메뉴</h3>
                <ul className="grid grid-cols-2 gap-1.5" data-testid="more-nav-candidates">
                  {candidates
                    .filter((m) => !currentKeys.includes(m.key))
                    .map((m) => (
                      <li key={m.key} className="min-w-0">
                        <button
                          type="button"
                          disabled={current.length >= MOBILE_NAV_MAX}
                          onClick={() => setKeys([...currentKeys, m.key])}
                          className="tap flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left hover:border-brand-300 disabled:opacity-40"
                          data-testid="more-nav-add"
                          data-key={m.key}
                        >
                          <Plus aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
                          <span className="t-sub min-w-0 truncate text-slate-800">{m.label}</span>
                        </button>
                      </li>
                    ))}
                </ul>
                {current.length >= MOBILE_NAV_MAX && <p className="t-meta text-slate-500">{MOBILE_NAV_MAX}개가 다 찼어요 — 위에서 하나를 빼면 더할 수 있어요.</p>}
              </section>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(false)} data-testid="more-nav-done" className="tap t-sub inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
                  <Check aria-hidden="true" className="size-4" /> 다 됐어요
                </button>
                <button type="button" disabled={isDefault} onClick={() => saveMobileNavKeys(null)} data-testid="more-nav-reset" className="tap t-sub inline-flex min-h-11 items-center justify-center gap-1 rounded-(--radius-control) border border-slate-200 px-4 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                  <RotateCcw aria-hidden="true" className="size-4" /> 기본으로({MOBILE_NAV_DEFAULT.length}개)
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups
                .filter((g) => g.group.key !== 'settings')
                .map(({ group, items }) => {
                  const top = items.filter((m) => !m.parent)
                  const plain = top.filter((m) => m.kind !== 'category' && !m.expand)
                  const cats = top.filter((m) => m.kind === 'category')
                  const futureRow = top.find((m) => m.expand === 'future-items')
                  if (!plain.length && !cats.length && !futureRow) return null
                  return (
                    <section key={group.key} aria-label={group.title} data-testid="more-group" data-group={group.key}>
                      <h3 className="t-meta mb-1 flex items-center gap-1.5 font-bold text-slate-600">
                        <span aria-hidden="true" className={`h-3 w-1 rounded-full ${toneClass(groupTone(group.key)).bar}`} />
                        {group.title}
                      </h3>
                      {(plain.length > 0 || futureRow) && (
                        <ul className="grid grid-cols-4 gap-x-1">
                          {plain.map(link)}
                          {futureRow && (
                            <li className="min-w-0">
                              <button type="button" onClick={() => setFuture((v) => !v)} aria-expanded={future} className={tileCls} data-testid="more-tile" data-key={futureRow.key}>
                                <Tile icon={futureRow.icon} label={futureRow.label} toneKey={futureRow.key} active={false} />
                              </button>
                            </li>
                          )}
                        </ul>
                      )}
                      {futureRow && future && (
                        <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="more-future">
                          {FUTURE_ITEMS.map((f) => {
                            const FIcon = futureIcon(f.key)
                            return (
                              <li key={f.key}>
                                <button type="button" onClick={() => setPicked(f)} className="tap t-meta inline-flex min-h-10 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-700">
                                  <FIcon aria-hidden="true" className="size-3.5" /> {f.short}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {cats.map((c) => {
                        const kids = items.filter((m) => m.parent === c.key)
                        return (
                          <div key={c.key} className="mt-1 rounded-2xl bg-slate-50 px-1.5 pt-1.5 pb-0.5" data-testid="more-category" data-key={c.key}>
                            <Link to={c.path} onClick={onClose} className="tap t-sub flex min-h-10 items-center gap-2 px-1.5 font-bold text-slate-800">
                              <c.icon aria-hidden="true" className={`size-5 ${toneClass(moduleTone(c.key)).icon}`} />
                              <span className="min-w-0 flex-1 truncate">{c.label}</span>
                              {locked(c) && <span className="t-meta font-normal text-slate-400">잠김</span>}
                              <span className="t-meta inline-flex items-center gap-0.5 font-semibold text-brand-700">
                                전체 <ArrowRight aria-hidden="true" className="size-3.5" />
                              </span>
                            </Link>
                            {kids.length > 0 && <ul className="grid grid-cols-4 gap-x-1">{kids.map(link)}</ul>}
                          </div>
                        )
                      })}
                    </section>
                  )
                })}

              {/* 맨 아래 — 설정 · 보기 방식 · 누구로 들어왔는지 · 제품 이름(대표 지시) */}
              <section aria-label="설정 · 계정" className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3" data-testid="more-settings">
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/settings" onClick={onClose} className="tap t-sub flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="more-settings-link">
                    <Settings2 aria-hidden="true" className="size-4" /> 설정
                  </Link>
                  <button type="button" onClick={() => setEditing(true)} className="tap t-sub flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50">
                    아래 메뉴 바꾸기
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="t-meta font-semibold text-slate-500">보기 방식</span>
                  <DeviceSwitch stacked />
                </div>
                <div className="flex min-h-12 items-center gap-2.5 rounded-xl bg-white px-3 py-2" data-testid="more-account">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[0.9rem] font-bold text-white">
                    {me.initial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-meta block text-slate-500">지금 로그인</span>
                    <span className="t-sub block truncate text-slate-800">
                      <b className="font-bold text-slate-900">{me.name}</b> {me.title}
                    </span>
                  </span>
                </div>
                <SignOutButton tone="light" testId="account-signout" />
                <div className="flex items-center justify-center gap-2 pt-1 opacity-80">
                  <BrandLogo tone="light" imgClassName="h-7 max-w-[120px]" />
                  <span className="t-meta font-semibold tracking-wide text-slate-500">{brand.productName}</span>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
      <FutureItemDialog item={picked} onClose={() => setPicked(null)} onPick={setPicked} />
    </div>
  )
}
