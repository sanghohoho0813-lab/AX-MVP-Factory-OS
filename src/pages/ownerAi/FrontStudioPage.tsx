/**
 * AX 화면 스튜디오 — AI 가 준 화면 명세(UI spec)를 OS 가 실제 화면(React)으로 그린다. 이미지 생성 없음.
 * 미래AI랩 AX Front 원칙: PC 핵심 대시보드 1 · 모바일 핵심 화면 2 · 큰 글자 · KPI 3~4 · 정보 과다 금지.
 * 글은 오른쪽에서 고치고 저장(수정 이력 새 번호) · PNG(화면마다) · 인쇄.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DraftTextarea } from './parts/DraftTextarea'
import { tidyLines, titledLines } from './parts/draftLines'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Printer } from 'lucide-react'
import { frontFrom, frontIsEmpty, type FrontMobile, type FrontSpec } from '../../services/ownerAi/front'
import { useToast } from '../../components/ui/toastContext'
import { ScreenTitle, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { OwnerAiGate } from './shared'
import { PrintSheet, STUDIO_FONT, downloadBlob, safeFileName, useStudioRun } from './studioShared'

export default function FrontStudioPage() {
  const { runId = '' } = useParams()
  return (
    <OwnerAiGate>
      <Studio key={runId} />
    </OwnerAiGate>
  )
}

const PC = { w: 1280, h: 800 }
const MO = { w: 390, h: 844 }

/** 큰 화면을 칸 폭에 맞게 줄여 보이기 */
function Scaled({ w, h, children, testId }: { w: number; h: number; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / w)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={ref} className="w-full" data-testid={testId}>
      <div style={{ width: w * scale, height: h * scale }} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}

const T = { ink: '#0f172a', sub: '#334155', mute: '#64748b', line: '#e2e8f0', soft: '#f8fafc', accent: '#9a7b4f', accentSoft: '#f6f1e8', side: '#111827' }

export function PcDashboard({ s }: { s: FrontSpec }) {
  return (
    <div style={{ width: PC.w, height: PC.h, fontFamily: STUDIO_FONT, display: 'flex', background: T.soft, color: T.ink }}>
      <aside style={{ width: 220, background: T.side, color: '#fff', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>{s.appName}</div>
        {(s.navigation.length ? s.navigation : ['대시보드']).map((n, i) => (
          <div key={i} style={{ fontSize: 17, fontWeight: i === 0 ? 700 : 500, padding: '10px 12px', borderRadius: 10, background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent', opacity: i === 0 ? 1 : 0.8 }}>{n}</div>
        ))}
      </aside>
      <main style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{s.dashboardTitle}</div>
            {s.oneLine && <div style={{ fontSize: 17, color: T.mute, marginTop: 4 }}>{s.oneLine}</div>}
          </div>
          <div style={{ fontSize: 14, color: T.mute, background: T.accentSoft, padding: '6px 12px', borderRadius: 999 }}>예시 데이터 · {s.userType || '사용자'}</div>
        </header>
        {s.kpis.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${s.kpis.length}, 1fr)`, gap: 16 }}>
            {s.kpis.map((k, i) => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ fontSize: 16, color: T.mute, fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>{k.value}</div>
                {k.hint && <div style={{ fontSize: 14, color: T.mute, marginTop: 4 }}>{k.hint}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          {s.sections.slice(0, s.table.columns.length ? 2 : 4).map((sec, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: '18px 20px', overflow: 'hidden' }}>
              <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>{sec.title}</div>
              {sec.kind === 'chart' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sec.items.slice(0, 5).map((it, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 120, fontSize: 15, color: T.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it}</div>
                      <div style={{ height: 14, borderRadius: 7, background: T.accent, width: `${90 - j * 14}%`, opacity: 0.85 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sec.items.slice(0, 6).map((it, j) => (
                    <div key={j} style={{ fontSize: 16, color: T.sub, display: 'flex', gap: 8 }}>
                      <span style={{ color: T.accent, fontWeight: 800 }}>•</span>
                      <span>{it}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {s.table.columns.length > 0 && (
            <div style={{ gridColumn: '1 / span 2', background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: '18px 20px', overflow: 'hidden' }}>
              <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{s.table.title || '목록'}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr>{s.table.columns.map((c, i) => <th key={i} style={{ textAlign: 'left', color: T.mute, fontWeight: 600, padding: '8px 10px', borderBottom: `1px solid ${T.line}` }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {s.table.rows.slice(0, 4).map((r, i) => (
                    <tr key={i}>{s.table.columns.map((_, j) => <td key={j} style={{ padding: '8px 10px', borderBottom: `1px solid ${T.line}`, color: T.sub }}>{r[j] ?? ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export function MobileScreen({ s, m }: { s: FrontSpec; m: FrontMobile }) {
  const tabs = (s.navigation.length ? s.navigation : ['홈']).slice(0, 4)
  return (
    <div style={{ width: MO.w, height: MO.h, fontFamily: STUDIO_FONT, background: T.soft, color: T.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontSize: 15, fontWeight: 600 }}>
        <span>9:41</span>
        <span style={{ color: T.mute }}>예시 데이터</span>
      </div>
      <div style={{ padding: '8px 20px 14px' }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{m.title}</div>
        {m.purpose && <div style={{ fontSize: 16, color: T.mute, marginTop: 4 }}>{m.purpose}</div>}
      </div>
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
        {m.blocks.map((b, i) => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{b.title}</div>
            {b.lines.map((l, j) => (
              <div key={j} style={{ fontSize: 16, color: T.sub, lineHeight: 1.5 }}>{l}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ height: 76, borderTop: `1px solid ${T.line}`, background: '#fff', display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, alignItems: 'center', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
        {tabs.map((t, i) => (
          <div key={i} style={{ color: i === 0 ? T.accent : T.mute }}>{t}</div>
        ))}
      </div>
    </div>
  )
}

type Frame = 'pc' | 'm1' | 'm2'

function Studio() {
  const { caseId = '', runId = '' } = useParams()
  const { showToast } = useToast()
  const { state, save } = useStudioRun(caseId, runId, 'AX_FRONT')
  const [spec, setSpec] = useState<FrontSpec | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<Frame | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  // D-219: 고친 글을 저장하지 않고 나가면 한 번 묻는다 — 예전엔 말없이 사라졌다
  const { blocker } = useUnsavedChangesGuard(dirty && !saving)

  if (state.kind === 'ready' && spec === null) {
    const rev = state.bundle.latestRevision.get(state.run.id)?.content
    setSpec(frontFrom(rev && typeof rev === 'object' ? rev : state.run.structured))
  }

  useEffect(() => {
    if (!exporting || !exportRef.current || !spec) return
    let alive = true
    void (async () => {
      try {
        const mod = await import('html2canvas')
        const h2c = (mod as unknown as { default: (el: HTMLElement, o: object) => Promise<HTMLCanvasElement> }).default
        // 화면 틀은 모두 인라인 스타일이다 — 복제본에서 화면 스타일시트(oklch 색 · html2canvas 가 못 읽음)를 빼고 그린다
        const canvas = await h2c(exportRef.current as HTMLElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (doc: Document) => doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => n.remove()),
        })
        const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'))
        if (blob) downloadBlob(blob, `${safeFileName(spec.appName)}_${exporting === 'pc' ? 'PC' : exporting === 'm1' ? '모바일1' : '모바일2'}.png`)
      } catch {
        showToast('그림을 만들지 못했습니다.')
      } finally {
        if (alive) setExporting(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [exporting, spec, showToast])

  if (state.kind === 'loading') return <p className="t-sub text-slate-500" role="status">화면 기획을 여는 중…</p>
  if (state.kind !== 'ready' || !spec)
    return (
      <Surface>
        <p className="t-body text-slate-700">{state.kind === 'db_setup' ? 'AI 전략실 DB 설정이 필요합니다.' : state.kind === 'error' ? state.message : '이 화면 기획 결과를 찾지 못했습니다.'}</p>
        <Link to={`/ai/cases/${caseId}`} className="t-body tap mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700">업체 작업실로</Link>
      </Surface>
    )

  const set = (next: FrontSpec) => {
    setSpec(next)
    setDirty(true)
  }
  const persist = async () => {
    if (saving) return
    setSaving(true)
    try {
      await save(spec, '화면 글 고침')
      setDirty(false)
      showToast('저장했습니다 — 고친 판이 새 번호로 남습니다.')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="front-studio">
      <Link to={`/ai/cases/${caseId}`} className="t-sub tap inline-flex min-h-11 items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900">
        <ChevronLeft aria-hidden="true" className="size-4" />
        {state.bundle.c.companyName} 작업실
      </Link>
      <ScreenTitle
        title="AX 화면 스튜디오"
        sub={`${spec.appName} · PC 대시보드 1 + 모바일 2 · 글자는 OS 가 그립니다(예시 데이터)`}
        actions={
          <Button variant="primary" onClick={() => window.print()} data-testid="front-print">
            <Printer aria-hidden="true" className="size-4" />
            인쇄 · PDF
          </Button>
        }
      />
      {frontIsEmpty(spec) && <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-warning-700">그릴 내용이 거의 없습니다 — 오른쪽에서 채우거나 화면 기획을 다시 만들어 주세요.</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="t-section text-slate-900">PC 핵심 대시보드</h2>
              <Button size="sm" variant="ghost" disabled={!!exporting} onClick={() => setExporting('pc')} data-testid="front-png-pc">
                <Download aria-hidden="true" className="size-4" />
                PNG
              </Button>
            </div>
            <Scaled w={PC.w} h={PC.h} testId="front-pc">
              <PcDashboard s={spec} />
            </Scaled>
          </section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['m1', 'm2'] as const).map((k) => (
              <section key={k} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="t-section text-slate-900">모바일 {k === 'm1' ? 1 : 2}</h2>
                  <Button size="sm" variant="ghost" disabled={!!exporting} onClick={() => setExporting(k)} data-testid={`front-png-${k}`}>
                    <Download aria-hidden="true" className="size-4" />
                    PNG
                  </Button>
                </div>
                <div className="mx-auto w-full max-w-[22rem]">
                  <Scaled w={MO.w} h={MO.h} testId={`front-${k}`}>
                    <MobileScreen s={spec} m={k === 'm1' ? spec.mobile1 : spec.mobile2} />
                  </Scaled>
                </div>
              </section>
            ))}
          </div>
        </div>
        <Surface className="flex flex-col gap-3">
          <h2 className="t-section text-slate-900">글 고치기</h2>
          <SpecEditor spec={spec} onChange={set} />
          <Button variant="primary" disabled={!dirty || saving} onClick={() => void persist()} data-testid="front-save">
            {saving ? '저장 중…' : '저장'}
          </Button>
        </Surface>
      </div>

      {exporting && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0 }}>
          <div ref={exportRef}>{exporting === 'pc' ? <PcDashboard s={spec} /> : <MobileScreen s={spec} m={exporting === 'm1' ? spec.mobile1 : spec.mobile2} />}</div>
        </div>
      )}

      <PrintSheet pageCss="size: 1280px 800px; margin: 0;">
        <div style={{ breakAfter: 'page' }}>
          <PcDashboard s={spec} />
        </div>
        <div style={{ display: 'flex', gap: 40, padding: 40, width: PC.w, height: PC.h, boxSizing: 'border-box', alignItems: 'flex-start', justifyContent: 'center' }}>
          <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}><MobileScreen s={spec} m={spec.mobile1} /></div>
          <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}><MobileScreen s={spec} m={spec.mobile2} /></div>
        </div>
      </PrintSheet>
      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="고친 글을 아직 저장하지 않았습니다"
        message="이 화면을 나가면 저장하지 않은 고친 글이 사라집니다. 나갈까요?"
        confirmLabel="저장하지 않고 나가기"
        cancelLabel="계속 고치기"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}

function SpecEditor({ spec, onChange }: { spec: FrontSpec; onChange: (s: FrontSpec) => void }) {
  const input = 't-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3'
  const area = 't-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2'
  const mobile = (key: 'mobile1' | 'mobile2', label: string) => {
    const m = spec[key]
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="t-sub font-semibold text-slate-700">{label}</legend>
        <input value={m.title} onChange={(e) => onChange({ ...spec, [key]: { ...m, title: e.target.value } })} className={input} placeholder="화면 이름" />
        <input value={m.purpose} onChange={(e) => onChange({ ...spec, [key]: { ...m, purpose: e.target.value } })} className={input} placeholder="이 화면에서 하는 일" />
        {m.blocks.map((b, i) => (
          <DraftTextarea
            key={i}
            rows={3}
            value={{ title: b.title, lines: b.lines }}
            toText={(v) => [v.title, ...v.lines].join('\n')}
            fromText={(t) => titledLines(t, 4)}
            onValue={(v) => onChange({ ...spec, [key]: { ...m, blocks: m.blocks.map((x, j) => (j === i ? v : x)) } })}
            className={area}
            aria-label={`${label} 칸 ${i + 1}(첫 줄 제목)`}
          />
        ))}
      </fieldset>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">서비스 이름</span>
        <input value={spec.appName} onChange={(e) => onChange({ ...spec, appName: e.target.value })} className={input} data-testid="front-app-name" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">대시보드 제목</span>
        <input value={spec.dashboardTitle} onChange={(e) => onChange({ ...spec, dashboardTitle: e.target.value })} className={input} />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="t-sub font-semibold text-slate-700">KPI(최대 4)</legend>
        {spec.kpis.map((k, i) => (
          <div key={i} className="grid grid-cols-2 gap-1.5">
            <input value={k.label} onChange={(e) => onChange({ ...spec, kpis: spec.kpis.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={input} placeholder="이름" />
            <input value={k.value} onChange={(e) => onChange({ ...spec, kpis: spec.kpis.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className={input} placeholder="값(예시)" />
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">메뉴(한 줄에 하나)</span>
        <DraftTextarea rows={4} value={spec.navigation} toText={(v) => v.join('\n')} fromText={(t) => tidyLines(t, 7)} onValue={(v) => onChange({ ...spec, navigation: v })} className={area} data-testid="front-nav" />
      </label>
      {spec.sections.map((sec, i) => (
        <label key={i} className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">구역 {i + 1}(첫 줄 제목)</span>
          <DraftTextarea
            rows={4}
            value={{ title: sec.title, lines: sec.items }}
            toText={(v) => [v.title, ...v.lines].join('\n')}
            fromText={(t) => titledLines(t, 6)}
            onValue={(v) => onChange({ ...spec, sections: spec.sections.map((x, j) => (j === i ? { ...x, title: v.title, items: v.lines } : x)) })}
            className={area}
          />
        </label>
      ))}
      {mobile('mobile1', '모바일 1')}
      {mobile('mobile2', '모바일 2')}
    </div>
  )
}
