/**
 * SAAS-1 설정 › 내 브랜드 · AI 설정 — 이 작업공간의 AI 가 누구의 말투 · 업종 · 사실로 쓰는가.
 *
 *  - 대표가 아닌 계정(팀장 · 구독 고객 · 대표가 팀장 화면으로 볼 때): 칸을 채우고 저장 → 다음 AI 답부터 이 설정으로.
 *  - 대표 계정: AI 는 지금 '미래AI랩 · 김팀장' 기준을 그대로 쓴다 — 바꾸는 칸을 보여 주지 않는다(작동하지 않는 칸을 두지 않는다).
 * 저장이 실패해도 적은 것은 그대로 둔다(D-160 튼튼하게).
 */
import { useContext, useEffect, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { AuthContext } from '../../auth/authContext'
import { useIsPilot } from '../../auth/osAccess'
import { BRAND_FIELDS, brandFilled, brandSummary, emptyBrand, loadBrand, saveBrand, useBrandProfile, type BrandProfile } from '../../services/brandProfile'

export function BrandSettingsPanel() {
  const customer = useIsPilot()
  if (!customer) {
    return (
      <Panel title="내 브랜드 · AI 설정">
        <p className="t-sub break-keep text-slate-600" data-testid="brand-owner-note">
          대표 계정의 AI 는 지금 쓰는 기준(미래AI랩 · 김팀장 · 채널 설정)을 그대로 씁니다. 이 설정은 팀장 · 고객 계정의 AI 가 그 사람의 업종 · 말투 ·
          사실로 쓰게 하는 칸입니다 — 위 '보는 화면' 에서 팀장 화면으로 바꾸면 팀장 설정을 고칠 수 있습니다.
        </p>
      </Panel>
    )
  }
  return <BrandForm />
}

function BrandForm() {
  const workspaceId = useContext(AuthContext)?.currentWorkspaceId ?? null
  const stored = useBrandProfile()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<BrandProfile>(emptyBrand())
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [more, setMore] = useState(false)

  useEffect(() => {
    let alive = true
    loadBrand(workspaceId)
      .then((p) => {
        if (!alive) return
        setDraft(p)
        setMore(Boolean(p.intro || p.facts || p.avoid || p.ending || p.benchmarks))
        setReady(true)
      })
      .catch(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [workspaceId])

  const changed = BRAND_FIELDS.some((f) => draft[f.key] !== stored.profile[f.key])
  const filled = brandFilled(draft)
  const save = async () => {
    setSaving(true)
    try {
      const p = await saveBrand(workspaceId, draft)
      setDraft(p)
      showToast('저장했어요 — 다음 AI 답부터 이 설정으로 씁니다.')
    } catch {
      // 적은 것은 그대로 둔다
      showToast('저장하지 못했습니다 — 적은 내용은 그대로 있어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setSaving(false)
    }
  }
  const input = 'mt-1 w-full min-w-0 rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]'
  const field = (f: (typeof BRAND_FIELDS)[number]) => (
    <label key={f.key} className={`min-w-0 text-[0.875rem] text-slate-600 ${f.long ? 'md:col-span-2' : ''}`}>
      <span className="font-semibold text-slate-700">{f.label}</span>
      {f.long ? (
        <textarea value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.slice(0, f.max) })} placeholder={f.placeholder} rows={2} className={`${input} resize-y`} data-testid={`brand-${f.key}`} />
      ) : (
        <input value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.slice(0, f.max) })} placeholder={f.placeholder} className={input} data-testid={`brand-${f.key}`} />
      )}
    </label>
  )

  return (
    <Panel title="내 브랜드 · AI 설정">
      <div className="flex flex-col gap-4" data-testid="brand-settings" data-ready={ready ? '1' : '0'}>
        <p className="t-sub break-keep text-slate-600">
          AI 가 내 업종 · 말투 · 고객에 맞춰 씁니다. <b className="font-semibold text-slate-800">확인된 사실</b> 칸에 적은 숫자 · 경력만 사실로 쓰고, 적지 않은 실적은 만들지 않습니다.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{BRAND_FIELDS.filter((f) => f.core).map(field)}</div>
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="tap t-sub self-start font-semibold text-brand-700 underline-offset-2 hover:underline" data-testid="brand-more">
          {more ? '자세한 칸 접기' : '더 자세히(선택) — 하는 일 · 확인된 사실 · 쓰지 않는 말 · 끝인사 · 참고 채널'}
        </button>
        {more && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{BRAND_FIELDS.filter((f) => !f.core).map(field)}</div>}
        <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="brand-preview">
          <p className="t-meta font-semibold text-slate-500">AI 는 이렇게 씁니다 · 핵심 {filled.done}/{filled.total}칸</p>
          <p className="t-sub mt-0.5 break-keep text-slate-800">{brandSummary(draft)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void save()} disabled={saving || !ready || !changed} data-testid="brand-save">
            {saving ? '저장 중…' : changed ? '저장' : '저장됨'}
          </Button>
          {!workspaceId && <span className="t-meta text-slate-500">이 브라우저에만 저장됩니다(로그인하면 작업공간에 저장)</span>}
        </div>
      </div>
    </Panel>
  )
}
