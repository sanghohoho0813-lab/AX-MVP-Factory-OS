/**
 * D-564 마케팅 · 브랜딩 첫 화면 — 대표가 아닌 계정(팀장 · 구독 고객)이 처음 들어왔을 때 '내 채널부터 알려 주기' 한 칸.
 * 대표(2026-11-10): "마케팅 · 브랜딩을 팀장과 새로 가입하는 사람들에게도 보이게. 대신 김팀장의 경영노트 채널이나 AX 같은 내 기본값은 없이 —
 *                    아예 처음부터 본인이 원하는 것으로 바꿀 수 있게."
 *
 *  - 이름 · 회사 · 분야(설정 › 내 브랜드의 핵심 세 칸)와 관심 분야(이번 주 뜨는 주제)를 한 번에 적는다 — 저장하면 주제 추천 · 글 · 대본 · AI 지시가 그 사람 것으로.
 *  - 아무것도 적지 않은 동안에도 대표 이름 · 채널 · 사실은 나오지 않는다(services/marketing/persona) — 이 칸은 '내 것으로 채우는' 빠른 길이다.
 *  - AI 쪽 관심 분야(AI 도구 · 업무 자동화)는 여기서 스스로 골라야만 주제에 나온다(interests.AI_INTEREST_IDS).
 *  - 브랜드를 한 칸이라도 적었거나 관심 분야를 골랐으면 다시 보이지 않는다. [나중에 할게요] 는 이 기기에서만 기억한다.
 * 규칙 화면이다 — AI 를 부르지 않는다.
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/toastContext'
import { BRAND_FIELDS, isBrandEmpty, saveBrand, useBrandProfile } from '../../../services/brandProfile'
import { INTEREST_GROUPS } from '../../../services/marketing/interests'

const FIELDS = (['name', 'company', 'industry'] as const).map((k) => BRAND_FIELDS.find((f) => f.key === k)!)
const skipKey = (workspaceId: string | null) => `axmvp.mk.start.skip.${workspaceId ?? 'local'}`

function skipped(workspaceId: string | null): boolean {
  try {
    return window.localStorage.getItem(skipKey(workspaceId)) === '1'
  } catch {
    return false
  }
}

export function MkStart({
  workspaceId,
  picked,
  prefsReady,
  onSaveInterests,
}: {
  workspaceId: string | null
  /** 이미 고른 관심 분야(레이더 설정) */
  picked: readonly string[]
  /** 레이더 설정을 다 읽었는가 — 읽기 전에는 그리지 않는다(이미 고른 사람에게 깜빡이지 않게) */
  prefsReady: boolean
  onSaveInterests: (ids: string[]) => Promise<boolean>
}) {
  const brand = useBrandProfile()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<Record<'name' | 'company' | 'industry', string>>({ name: '', company: '', industry: '' })
  const [ids, setIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [hidden, setHidden] = useState(() => skipped(workspaceId))

  if (hidden || !prefsReady || !brand.loaded || brand.workspaceId !== workspaceId) return null
  if (!isBrandEmpty(brand.profile) || picked.length > 0) return null

  const later = () => {
    try {
      window.localStorage.setItem(skipKey(workspaceId), '1')
    } catch {
      /* 기억하지 못해도 닫는다 */
    }
    setHidden(true)
  }

  const save = async () => {
    if (saving) return
    const text = { name: draft.name.trim(), company: draft.company.trim(), industry: draft.industry.trim() }
    if (!text.name && !text.company && !text.industry && ids.length === 0) {
      setHint('이름이나 분야를 하나만 적어도 돼요 — 아래 주제만 골라도 돼요.')
      return
    }
    setHint('')
    setSaving(true)
    try {
      if (text.name || text.company || text.industry) await saveBrand(workspaceId, { ...brand.profile, ...text })
      if (ids.length) {
        const ok = await onSaveInterests(ids)
        if (!ok) throw new Error('interests')
      }
      showToast('저장했어요 — 이제 내 분야 · 내 이름으로 추천해요.')
    } catch {
      // 적은 것은 그대로 둔다(D-160) — 다시 누르면 된다
      setHint('저장하지 못했어요 — 잠시 뒤 다시 눌러 주세요. 적은 것은 그대로 있어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="mk-start-title" data-testid="mk-start">
      <div className="flex flex-col gap-1">
        <h2 id="mk-start-title" className="t-section text-slate-900">
          먼저 내 채널을 알려 주세요
        </h2>
        <p className="t-sub break-keep text-slate-700">한 번만 적으면 주제 추천 · 글 · 대본이 내 분야 · 내 이름으로 나와요. 나중에 설정 › 내 브랜드에서 고칠 수 있어요.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex min-w-0 flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">{f.label}</span>
            <input
              value={draft[f.key as 'name' | 'company' | 'industry']}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              maxLength={f.max}
              placeholder={f.placeholder}
              className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              data-testid={`mk-start-${f.key}`}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="t-sub font-semibold text-slate-800">
          어떤 주제로 올리세요? <span className="font-normal text-slate-600">여러 개 골라도 돼요 — 고른 분야의 주제부터 보여 드려요.</span>
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="올릴 주제">
          {INTEREST_GROUPS.map((g) => {
            const on = ids.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => setIds((d) => (on ? d.filter((x) => x !== g.id) : [...d, g.id]))}
                className={`tap t-sub inline-flex min-h-11 flex-col items-start rounded-xl border px-3 py-1 text-left ${on ? 'border-brand-500 bg-white text-brand-800 ring-1 ring-brand-300' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}
                data-testid="mk-start-chip"
                data-id={g.id}
              >
                <span className="inline-flex items-center gap-1 font-bold">
                  {on && <Check aria-hidden="true" className="size-4" />}
                  {g.label}
                </span>
                <span className="text-slate-600">{g.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {hint && (
        <p role="status" className="t-sub break-keep text-danger-700" data-testid="mk-start-hint">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" className="min-h-12 justify-center" onClick={() => void save()} disabled={saving} data-testid="mk-start-save">
          {saving ? '저장하는 중…' : '저장하고 시작'}
        </Button>
        <Button variant="ghost" className="min-h-12 justify-center" onClick={later} data-testid="mk-start-later">
          나중에 할게요
        </Button>
      </div>
    </section>
  )
}
