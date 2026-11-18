/**
 * D-241 채널 설계 기준 — AI 도우미가 이번 주 기획 · 대본을 쓸 때 늘 따르는 것.
 * 대표: "기획을 할 거면 정확히 내가 내 컨텐츠에 맞게 설계를 해줘야". 처음에는 김팀장의 경영노트 기본값 — 고치면 그것이 기준.
 * 저장은 레이더 설정(RadarPrefs.brief) 한 곳. 기본값으로 되돌리면 null 로 저장해 다음 기본값 개선을 그대로 받는다.
 * D-295 대표: "내 아이디에서는 그대로 두되 접어 두기로 · 다른 사람에게는 안 보이게(각자 알아서)" — 대표 계정만 · 열 때마다 접힌 채로.
 *   팀장 · 구독 고객은 이 카드를 보지 않는다(AI 는 그 사람의 설정 › 내 브랜드로 쓴다).
 * D-633 대표: "업인지만 이해하고 자율성 있게" — AI 는 위쪽 '내가 하는 일' 칸(AI_BRIEF_KEYS)만 읽고, 아래 칸은 규칙 초안(찍기 키트 · 1주일치)에만 쓴다.
 */
import { useEffect, useRef, useState } from 'react'
import { Compass, RotateCcw, Save } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Fold } from '../../../components/ui/fold'
import { AI_BRIEF_KEYS, BRIEF_FIELDS, BRIEF_MAX, defaultBrief, normalizeBrief, type ChannelBrief } from '../../../services/marketing/radarStore'
import { isMarketingCustomer } from '../../../services/marketing/persona'

export function BriefCard({ brief, custom, readOnly, onSave, plain = false }: { brief: ChannelBrief; custom: boolean; readOnly: boolean; onSave: (next: ChannelBrief | null) => Promise<boolean>; /** D-603 다른 판 안에 놓일 때 — 테두리 칸 없이 가는 선 위 한 줄(박스 안 박스 줄이기) */ plain?: boolean }) {
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
    if (ok) setDraft(next ?? defaultBrief())
    setBusy(false)
  }
  return (
    <Fold
      panel={!plain}
      className={plain ? 'border-t border-slate-100 pt-1' : ''}
      id="radar.brief"
      icon={<Compass aria-hidden="true" className="size-4 text-violet-700" />}
      title="채널 설계 기준"
      hint={`AI 는 여기서 '내가 하는 일'(채널 · 화자 · 시청자 · 다루는 것 · 본업 · 시청자 고민 · 실제 사례)만 읽고, 제목 · 말투 · 형식은 성공 공식대로 자유롭게 씁니다${custom ? '' : isMarketingCustomer() ? ' (지금은 기본값 · 설정 › 내 브랜드에서)' : ' (지금은 기본값 · 김팀장의 경영노트)'}`}
      // D-627 접힌 줄은 이름 하나 — 고쳐 둔 때만 짧게 표시(기본값 이름은 ?(hint) 안)
      summary={custom ? '직접 고친 기준' : undefined}
      testId="radar-brief"
      keepClosed
    >
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-600" data-testid="radar-brief-ai-note">
          AI 는 'AI 가 읽는 칸'(내가 하는 일)만 읽어요 — 주제 · 제목 · 말투 · 형식은 성공 공식대로 자유롭게 씁니다. 맨 아래 칸들은 규칙 초안에만 써요.
        </p>
        {[
          { key: 'ai', title: 'AI 가 읽는 칸 — 내가 하는 일', fields: BRIEF_FIELDS.filter((f) => AI_BRIEF_KEYS.includes(f.key)) },
          { key: 'rule', title: '규칙 초안에만 쓰는 칸(AI 에는 안 보냄)', fields: BRIEF_FIELDS.filter((f) => !AI_BRIEF_KEYS.includes(f.key)) },
        ].map((g) => (
          <div key={g.key} className="flex flex-col gap-2" data-brief-group={g.key}>
            <p className="t-sub font-semibold break-keep text-slate-900">{g.title}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((f) => (
                <label key={f.key} className="flex min-w-0 flex-col gap-1">
                  <span className="t-sub font-semibold break-keep text-slate-800">
                    {f.label} <span className="t-meta font-normal text-slate-500">· {f.hint}</span>
                  </span>
                  <textarea
                    rows={draft[f.key].length > 200 ? 6 : 3}
                    maxLength={BRIEF_MAX}
                    value={draft[f.key]}
                    readOnly={readOnly}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 break-keep"
                    data-brief={f.key}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
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
