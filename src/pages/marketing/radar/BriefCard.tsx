/**
 * D-241 채널 설계 기준 — AI 도우미가 이번 주 기획 · 대본을 쓸 때 늘 따르는 것.
 * 대표: "기획을 할 거면 정확히 내가 내 컨텐츠에 맞게 설계를 해줘야". 처음에는 김팀장의 경영노트 기본값 — 고치면 그것이 기준.
 * 저장은 레이더 설정(RadarPrefs.brief) 한 곳. 기본값으로 되돌리면 null 로 저장해 다음 기본값 개선을 그대로 받는다.
 */
import { useEffect, useRef, useState } from 'react'
import { Compass, RotateCcw, Save } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Fold } from '../../../components/ui/fold'
import { BRIEF_FIELDS, DEFAULT_BRIEF, normalizeBrief, type ChannelBrief } from '../../../services/marketing/radarStore'

export function BriefCard({ brief, custom, readOnly, onSave }: { brief: ChannelBrief; custom: boolean; readOnly: boolean; onSave: (next: ChannelBrief | null) => Promise<boolean> }) {
  const [draft, setDraft] = useState<ChannelBrief>(brief)
  const [busy, setBusy] = useState(false)
  // D-244 기준 값이 정말 바뀔 때만 따라간다 — 다른 레이더 설정을 저장해도 brief 묶음이 새로 와서 고치던 글이 지워졌다.
  // 고치던 것이 있으면(옛 기준과 다르면) 그대로 둔다. 저장 · 기본값으로는 아래 save 가 맞춘다
  const briefKey = JSON.stringify(brief)
  const base = useRef(brief)
  useEffect(() => {
    const was = base.current
    base.current = brief
    setDraft((d) => (BRIEF_FIELDS.some((f) => d[f.key].trim() !== was[f.key]) ? d : brief))
    // brief 는 briefKey 로 본다(같은 값의 새 묶음에는 반응하지 않게)
  }, [briefKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = BRIEF_FIELDS.some((f) => draft[f.key].trim() !== brief[f.key])
  const save = async (next: ChannelBrief | null) => {
    setBusy(true)
    const ok = await onSave(next)
    // 저장했으면 저장한 기준으로(빈 칸은 기본값이 채운 모양 — normalizeBrief)
    if (ok) setDraft(next ?? DEFAULT_BRIEF)
    setBusy(false)
  }
  return (
    <Fold
      panel
      id="radar.brief"
      icon={<Compass aria-hidden="true" className="size-4 text-violet-700" />}
      title="채널 설계 기준"
      hint="AI 도우미가 이번 주 기획 · 대본을 쓸 때 반드시 따르는 것 — 채널 · 화자 · 시청자 · 다루는 것 · 다루지 않는 것 · 말투 · 형식 · 끝맺음"
      summary={custom ? '직접 고친 기준' : '기본값 · 김팀장의 경영노트'}
      testId="radar-brief"
    >
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-600">여기 적은 대로 AI 가 기획 · 대본을 맞춥니다. 내 채널 최근 영상 · 잘 된 영상도 함께 보냅니다.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {BRIEF_FIELDS.map((f) => (
            <label key={f.key} className="flex min-w-0 flex-col gap-1">
              <span className="t-sub font-semibold break-keep text-slate-800">
                {f.label} <span className="t-meta font-normal text-slate-500">· {f.hint}</span>
              </span>
              <textarea
                rows={3}
                maxLength={300}
                value={draft[f.key]}
                readOnly={readOnly}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 break-keep"
                data-brief={f.key}
              />
            </label>
          ))}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {custom && (
              <Button variant="ghost" disabled={busy} onClick={() => void save(null)} data-testid="radar-brief-reset">
                <RotateCcw aria-hidden="true" className="size-4" /> 기본값으로
              </Button>
            )}
            <Button variant="primary" disabled={!dirty || busy} onClick={() => void save(normalizeBrief(draft))} data-testid="radar-brief-save">
              <Save aria-hidden="true" className="size-4" /> 기준 저장
            </Button>
          </div>
        )}
      </div>
    </Fold>
  )
}
