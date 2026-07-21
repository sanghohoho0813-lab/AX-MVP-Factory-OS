import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ban, Plus, X } from 'lucide-react'
import type { WebsiteDesign } from '../../types/websiteDesign'
import { BRAND_PERSONALITIES, BRAND_PERSONALITY_META } from '../../lib/websiteDesignMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignEditError,
  togglePersonality,
  updateProhibitedStyles,
} from '../../services/websiteDesignService'
import { WebsiteSectionFrame } from './websiteShared'

function DesignBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const d = design.designDirection
  const [newProhibited, setNewProhibited] = useState('')
  const run = (fn: () => void, ok: string) => {
    try { fn(); showToast(ok) } catch (error) { showToast(error instanceof WebsiteDesignEditError ? error.message : '처리 실패') }
  }

  const addProhibited = () => {
    if (!newProhibited.trim()) return
    run(() => updateProhibitedStyles(design.id, [...d.prohibitedStyles, newProhibited.trim()]), '추가했습니다.')
    setNewProhibited('')
  }
  const removeProhibited = (s: string) => run(() => updateProhibitedStyles(design.id, d.prohibitedStyles.filter((x) => x !== s)), '삭제했습니다.')

  return (
    <>
      <Panel title="브랜드 성격 (최대 4개)">
        <div className="flex flex-wrap gap-2">
          {BRAND_PERSONALITIES.map((p) => {
            const on = d.personalities.includes(p)
            return (
              <button key={p} type="button" onClick={() => run(() => togglePersonality(design.id, p), '변경했습니다.')}
                className={`rounded-(--radius-control) border px-3 py-1.5 text-[0.9rem] font-medium transition-colors ${on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                aria-pressed={on}>
                {BRAND_PERSONALITY_META[p].label}
              </button>
            )
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="색상·배경 방향">
          <dl className="flex flex-col gap-2 text-[0.9rem]">
            <Row label="전체 분위기" value={d.moodDescription} />
            <Row label="메인 색상" value={d.primaryColorDirection} />
            <Row label="보조 색상" value={d.secondaryColorDirection} />
            <Row label="포인트 색상" value={d.accentColorDirection} />
            <Row label="배경" value={d.backgroundDirection} />
          </dl>
          <p className="mt-3 text-[0.85rem] break-keep text-slate-400">근거 없는 브랜드 색상은 확정하지 않고 방향만 제시합니다. 실제 로고·브랜드 컬러가 확인되면 반영하세요.</p>
        </Panel>
        <Panel title="타이포·레이아웃·모바일">
          <dl className="flex flex-col gap-2 text-[0.9rem]">
            <Row label="타이포그래피" value={d.typographyDirection} />
            <Row label="본문 스타일" value={d.bodyStyle} />
            <Row label="정보 밀도" value={d.spacingDensity} />
            <Row label="모서리" value={d.cornerStyle} />
            <Row label="애니메이션" value={d.motionStyle} />
          </dl>
          <div className="mt-3">
            <p className="mb-1 text-[0.85rem] font-semibold text-slate-500">모바일 원칙</p>
            <ul className="flex flex-col gap-0.5">{d.mobilePrinciples.map((m) => <li key={m} className="text-[0.85rem] break-keep text-slate-600">• {m}</li>)}</ul>
          </div>
        </Panel>
      </div>

      <Panel title="금지할 디자인">
        <ul className="flex flex-wrap gap-2">
          {d.prohibitedStyles.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 rounded-md border border-danger-200 bg-danger-50 px-2 py-1 text-[0.85rem] text-danger-700">
              <Ban aria-hidden="true" className="size-3" />
              {s}
              <button type="button" aria-label={`${s} 삭제`} onClick={() => removeProhibited(s)} className="text-danger-400 hover:text-danger-700"><X className="size-3" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex max-w-[520px] items-end gap-2">
          <label className="min-w-0 flex-1 text-[0.85rem] font-semibold text-slate-500">금지 항목 추가
            <input value={newProhibited} onChange={(e) => setNewProhibited(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addProhibited()} className="mt-0.5 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none" placeholder="예: 자동재생 배경 영상" />
          </label>
          <Button variant="secondary" onClick={addProhibited}><Plus aria-hidden="true" className="size-4" />추가</Button>
        </div>
      </Panel>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

export function WebsiteDesignDirectionPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <DesignBody design={design} />} />
}
