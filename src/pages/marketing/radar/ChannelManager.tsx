/**
 * 벤치마킹 채널 (D-194) — 채널을 네 묶음(직접 경쟁 · AI 실무 · AX · 포맷)으로 보고, 묶음 바꾸기 · 끄기 · [채널 추가].
 *  - 끄면 계산(후보 · 신호 · 순위)에서 빠진다. 데이터는 그대로 받는다(정해 둔 채널은 서버가 함께 받는다).
 *  - [채널 추가]: youtube.com/@주소 · 채널 주소 · UC… 를 넣으면 서버가 채널 정보 한 번(1~2단위)으로 확인 → 묶음 골라 더하기.
 *    검색(search.list · 100단위)은 쓰지 않는다. 화면을 열 때는 유튜브를 부르지 않는다(누를 때만).
 */
import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/primitives'
import { Fold } from '../../../components/ui/fold'
import { fmt, shortNum, type YtChannel } from '../../../services/marketing/ytBench'
import { GROUPS, GROUP_LABEL, GROUP_PURPOSE, groupOf, type BenchmarkChannelGroup } from '../../../services/marketing/ytRadar'
import { MAX_ADDED, type RadarPrefs } from '../../../services/marketing/radarStore'
import { resolveChannel, type ResolvedChannel } from '../../../services/marketing/ytExtra'

export function ChannelManager({
  channels,
  prefs,
  readOnly,
  failed,
  onPrefs,
  notify,
}: {
  channels: readonly (YtChannel & { group?: string; note?: string })[]
  prefs: RadarPrefs
  readOnly: boolean
  failed: readonly string[]
  onPrefs: (p: RadarPrefs) => void
  notify: (msg: string) => void
}) {
  const addedIds = useMemo(() => new Set(prefs.added.map((a) => a.id)), [prefs.added])
  // 받아 온 채널 + 더했는데 아직 못 받은 채널(이름만)
  const rows = useMemo(() => {
    const got = new Set(channels.map((c) => c.id))
    const pending = prefs.added
      .filter((a) => !got.has(a.id))
      .map((a) => ({ id: a.id, handle: a.handle, title: a.title, customUrl: a.handle, thumb: '', subs: a.subs, videoCount: 0, views: 0, mine: false, group: a.group, note: a.note, pending: true }))
    return [...channels.map((c) => ({ ...c, pending: false })), ...pending]
  }, [channels, prefs.added])
  const byGroup = useMemo(() => {
    const m = new Map<BenchmarkChannelGroup, typeof rows>()
    for (const g of GROUPS) m.set(g, [])
    for (const c of rows) m.get(groupOf(c, prefs.overrides))?.push(c)
    for (const list of m.values()) list.sort((a, b) => b.subs - a.subs)
    return m
  }, [rows, prefs.overrides])

  const setOverride = (id: string, patch: { group?: BenchmarkChannelGroup; enabled?: boolean }) => {
    if (addedIds.has(id) && patch.group) {
      onPrefs({ ...prefs, added: prefs.added.map((a) => (a.id === id ? { ...a, group: patch.group as BenchmarkChannelGroup } : a)) })
      return
    }
    onPrefs({ ...prefs, overrides: { ...prefs.overrides, [id]: { ...prefs.overrides[id], ...patch } } })
  }
  const removeAdded = (id: string) => {
    const { [id]: _drop, ...rest } = prefs.overrides
    void _drop
    onPrefs({ ...prefs, added: prefs.added.filter((a) => a.id !== id), overrides: rest })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="yt-channels">
      <AddChannel readOnly={readOnly} full={prefs.added.length >= MAX_ADDED} known={new Set(rows.map((r) => r.id))} onAdd={(c, group) => {
        onPrefs({ ...prefs, added: [...prefs.added, { id: c.id, title: c.title, handle: c.handle, group, note: '', subs: c.subs, addedAt: new Date().toISOString() }] })
        notify(`'${c.title}' 를 ${GROUP_LABEL[group]} 묶음에 더했습니다 — 영상은 곧 받아 옵니다.`)
      }} />
      {failed.length > 0 && <p className="t-meta break-keep text-warning-700">이번에 못 받은 채널: {failed.join(' · ')}</p>}
      <div className="flex flex-col gap-3" data-testid="yt-channel-table">
        {GROUPS.map((g) => {
          const list = byGroup.get(g) ?? []
          const on = list.filter((c) => prefs.overrides[c.id]?.enabled !== false).length
          return (
            <Fold key={g} panel id={`radar.ch.${g}`} title={GROUP_LABEL[g]} count={list.length} defaultOpen={list.length > 0} summary={list.length ? `사용 중 ${on}곳` : '아직 채널이 없습니다'} testId={`radar-group-${g}`}>
              <p className="t-meta mb-1 break-keep text-slate-500">{GROUP_PURPOSE[g]}</p>
              {list.length === 0 ? (
                <p className="t-sub break-keep text-slate-500">이 묶음에 채널이 없습니다{g === 'ai' || g === 'ax' ? ' — 위 [채널 추가] 로 더할 수 있습니다' : ''}.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {list.map((c) => {
                    const enabled = prefs.overrides[c.id]?.enabled !== false
                    const vps = c.subs > 0 ? Math.round((c.views / c.subs) * 10) / 10 : 0
                    return (
                      <li key={c.id} className={`flex flex-col gap-1.5 py-2.5 ${enabled ? '' : 'opacity-60'}`} data-testid="yt-channel-row" data-group={g} data-enabled={enabled ? '1' : '0'}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="t-body min-w-0 flex-[1_1_10rem] font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{c.title}</span>
                          {c.mine && <Badge tone="warning">내 채널</Badge>}
                          {addedIds.has(c.id) && <Badge tone="brand">대표가 더함</Badge>}
                          {c.pending && <Badge>영상 받는 중</Badge>}
                        </div>
                        {!c.pending && (
                          <p className="t-sub flex flex-wrap gap-x-3 text-slate-600">
                            <span>구독자 {shortNum(c.subs)}</span>
                            <span>영상 {fmt(c.videoCount)}</span>
                            <span className="font-semibold text-slate-800">구독자당 {vps.toFixed(1)}회</span>
                          </p>
                        )}
                        {c.note && <p className="t-meta break-keep text-slate-500">{c.note}</p>}
                        {!c.mine && (
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5">
                              <span className="t-meta text-slate-500">묶음</span>
                              <select value={g} disabled={readOnly} onChange={(e) => setOverride(c.id, { group: e.target.value as BenchmarkChannelGroup })} className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5 text-slate-800" aria-label={`${c.title} 묶음`} data-testid="radar-ch-group">
                                {GROUPS.map((x) => (
                                  <option key={x} value={x}>
                                    {GROUP_LABEL[x]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              aria-pressed={enabled}
                              disabled={readOnly}
                              onClick={() => setOverride(c.id, { enabled: !enabled })}
                              className={`tap t-sub rounded-(--radius-control) border px-3 py-1.5 font-semibold disabled:opacity-50 ${enabled ? 'border-success-300 bg-success-50 text-success-800' : 'border-slate-300 bg-white text-slate-600'}`}
                              data-testid="radar-ch-toggle"
                            >
                              {enabled ? '사용 중' : '꺼 둠'}
                            </button>
                            {addedIds.has(c.id) && (
                              <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => removeAdded(c.id)} aria-label={`${c.title} 빼기`}>
                                <X aria-hidden="true" className="size-4" /> 빼기
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Fold>
          )
        })}
      </div>
    </div>
  )
}

function AddChannel({ readOnly, full, known, onAdd }: { readOnly: boolean; full: boolean; known: ReadonlySet<string>; onAdd: (c: ResolvedChannel, g: BenchmarkChannelGroup) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<ResolvedChannel | null>(null)
  const [msg, setMsg] = useState('')
  const [group, setGroup] = useState<BenchmarkChannelGroup>('ai')
  const check = async () => {
    setBusy(true)
    setMsg('')
    setFound(null)
    const r = await resolveChannel(text)
    setBusy(false)
    if (!r.ok) return setMsg(r.message)
    if (r.channel.already || known.has(r.channel.id)) return setMsg(`'${r.channel.title}' 은 이미 목록에 있습니다.`)
    setFound(r.channel)
  }
  return (
    <Fold panel id="radar.ch.add" title="채널 추가" defaultOpen={false} summary={full ? `더한 채널 ${MAX_ADDED}곳 — 가득 참` : 'youtube.com/@주소 를 붙여 넣기'} testId="radar-add-channel" icon={<Plus aria-hidden="true" className="size-4" />}>
      <div className="flex flex-col gap-2">
        <p className="t-meta break-keep text-slate-500">유튜브 채널 화면 주소를 넣으면 채널 정보만 한 번 확인합니다(검색하지 않습니다 · 로그인한 OS 에서만). 더한 채널은 {MAX_ADDED}곳까지.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && text.trim() && !busy && !readOnly && !full && void check()}
            placeholder="예: youtube.com/@채널주소"
            className="tap t-sub min-w-0 flex-[1_1_14rem] rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2"
            aria-label="채널 주소"
            disabled={readOnly || full}
            data-testid="radar-add-input"
          />
          <Button variant="secondary" onClick={() => void check()} disabled={readOnly || full || busy || !text.trim()} data-testid="radar-add-check">
            <Search aria-hidden="true" className="size-4" /> {busy ? '확인 중…' : '확인'}
          </Button>
        </div>
        {msg && (
          <p className="t-sub break-keep text-warning-700" data-testid="radar-add-msg">
            {msg}
          </p>
        )}
        {found && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3" data-testid="radar-add-found">
            <p className="t-body font-semibold break-keep text-slate-900">
              {found.title} <span className="t-meta font-normal text-slate-500">{found.handle}</span>
            </p>
            <p className="t-sub text-slate-600">
              구독자 {shortNum(found.subs)} · 영상 {fmt(found.videoCount)}편
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={group} onChange={(e) => setGroup(e.target.value as BenchmarkChannelGroup)} className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1.5" aria-label="넣을 묶음">
                {GROUPS.map((x) => (
                  <option key={x} value={x}>
                    {GROUP_LABEL[x]}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                onClick={() => {
                  onAdd(found, group)
                  setFound(null)
                  setText('')
                }}
                data-testid="radar-add-confirm"
              >
                <Plus aria-hidden="true" className="size-4" /> 더하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </Fold>
  )
}
