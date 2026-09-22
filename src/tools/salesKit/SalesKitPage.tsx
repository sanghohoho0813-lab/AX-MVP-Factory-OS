/**
 * 영업 도구 모음 — 도입 검토중 (D-88).
 *
 * 기업컨설팅 세일즈 OS(corp-consult-sales-os · main)에서 표와 규칙만 그대로 떼어 온 것.
 * 그 OS 는 고객 관리·파이프라인·오늘 할 일까지 다 갖고 있지만 이 OS 에 이미 있으니 가져오지 않았다.
 * 가져온 것은 이 OS 에 없는 네 덩어리다:
 *   1) 1차·2차·3차 미팅 대본 (테마 8종 × 질문 8개, 반론 대응)
 *   2) 절세·컨설팅 전략 17종 추천 (관심사·업종·대표 나이로 점수)
 *   3) 컨설팅 상품 가격표 40종 (8분류, 만원 단위) + 제안 주제 34종
 *   4) 고객 플래그 17종 → 관심사 자동 파생 · 메모 붙여넣기 자동 인식 · 리드 점수
 *
 * 대표가 "이건 쓰겠다" 하면 toolRegistry 에서 status 를 'live' 로 바꾸는 것으로 끝난다.
 */

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import {
  CRETOP_WEAPONS,
  CUST_FLAGS,
  CUST_SECTIONS,
  HOLD_REASONS,
  MEETING_THEMES,
  PKG_CATEGORIES,
  STRATEGY_LIBRARY,
  buildDefaultPackages,
  buildLeadPlan,
  buildMeetingPlan,
  deriveInterests,
  detectTheme,
  financeSignal,
  holdReasonAdvice,
  missedConsultItems,
  parseMemo,
  recommendedStrategiesFor,
  scoreBand,
  scoreLead,
} from './lib/salesData.js'
import type { SalesItem } from './lib/salesData.js'

const STORAGE_KEY = 'axmvp.tools.salesKit'
type Tab = 'meeting' | 'strategy' | 'packages' | 'weapons'
const TABS: { key: Tab; label: string }[] = [
  { key: 'meeting', label: '미팅 대본' },
  { key: 'strategy', label: '전략 추천' },
  { key: 'packages', label: '상품 가격표' },
  { key: 'weapons', label: '제안 주제 34' },
]

interface KitForm {
  name: string
  industry: string
  ceoAge: string
  estYears: string
  empCount: string
  revenue: string
  memo: string
  flags: Record<string, boolean>
}

const EMPTY: KitForm = { name: '', industry: '', ceoAge: '', estYears: '', empCount: '', revenue: '', memo: '', flags: {} }

function loadForm(): KitForm {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<KitForm>) } : EMPTY
  } catch {
    return EMPTY
  }
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

const INDUSTRIES = ['제조업', 'IT/소프트웨어', '도소매업', '건설업', '운송업', '음식/숙박', '병의원', '서비스업', '기타']

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1800)
        } catch {
          /* 손으로 */
        }
      }}
    >
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {copied ? '복사됨' : '복사'}
    </Button>
  )
}

function Lines({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((t, i) => (
        <li key={`${i}-${t}`} className="flex gap-2 t-sub break-keep text-slate-700">
          <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-slate-300" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

const LEVEL_TONE: Record<string, Tone> = { 낮음: 'success', 보통: 'warning', 높음: 'danger' }

export function SalesKitPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('t'))?.key ?? 'meeting') as Tab
  const [form, setForm] = useState<KitForm>(() => loadForm())
  const [stage, setStage] = useState<'m1' | 'm2' | 'm3'>('m1')
  const [pkgCat, setPkgCat] = useState<string>('전체')
  const [weaponQ, setWeaponQ] = useState('')

  const save = (next: KitForm) => {
    setForm(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* 저장 못 해도 된다 */
    }
  }
  const set = <K extends keyof KitForm>(k: K, v: KitForm[K]) => save({ ...form, [k]: v })

  const item: SalesItem = useMemo(() => {
    const interests = deriveInterests({ flags: form.flags })
    return {
      name: form.name,
      industry: form.industry,
      ceoAge: form.ceoAge,
      estYears: form.estYears,
      empCount: form.empCount,
      revenue: form.revenue,
      memo: form.memo,
      interests,
      flags: form.flags,
    }
  }, [form])

  const theme = detectTheme(item)
  const plan = useMemo(() => (stage === 'm1' ? buildMeetingPlan(item, 'm1') : stage === 'm2' ? buildMeetingPlan(item, 'm2') : buildMeetingPlan(item, 'm3')), [item, stage])
  const strategies = useMemo(() => recommendedStrategiesFor(item), [item])
  const lead = useMemo(() => buildLeadPlan(item), [item])
  const score = scoreLead(item)
  const band = scoreBand(score)
  const signal = financeSignal(item)
  const missed = missedConsultItems(item)
  const packages = useMemo(() => buildDefaultPackages(), [])
  const shownPackages = pkgCat === '전체' ? packages : packages.filter((p) => p.cat === pkgCat)

  const applyMemo = () => {
    const parsed = parseMemo(form.memo) as Partial<KitForm> & { flags?: Record<string, boolean> }
    save({
      ...form,
      industry: typeof parsed.industry === 'string' ? parsed.industry : form.industry,
      revenue: parsed.revenue != null ? String(parsed.revenue) : form.revenue,
      empCount: parsed.empCount != null ? String(parsed.empCount) : form.empCount,
      ceoAge: parsed.ceoAge != null ? String(parsed.ceoAge) : form.ceoAge,
      estYears: parsed.estYears != null ? String(parsed.estYears) : form.estYears,
      flags: { ...form.flags, ...(parsed.flags ?? {}) },
    })
  }

  const planText = useMemo(() => {
    const p = plan as unknown as Record<string, unknown>
    const lines: string[] = [`[${String(p.title)}] ${form.name || ''}`.trim()]
    for (const [k, v] of Object.entries(p)) {
      if (k === 'title') continue
      if (Array.isArray(v)) lines.push(`${k}:`, ...v.map((x) => (Array.isArray(x) ? `  - ${x[0]} → ${x[1]}` : `  - ${String(x)}`)))
      else lines.push(`${k}: ${String(v)}`)
    }
    return lines.join('\n')
  }, [plan, form.name])

  const weaponsFiltered = useMemo(() => {
    const q = weaponQ.trim()
    if (!q) return CRETOP_WEAPONS
    return CRETOP_WEAPONS.map((c) => ({ ...c, items: c.items.filter((w) => `${w.name} ${w.p} ${w.r} ${w.q} ${w.d}`.includes(q)) })).filter((c) => c.items.length)
  }, [weaponQ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="영업 도구 모음"
        description="기업컨설팅 OS 에서 골라 온 네 가지 — 미팅 대본, 절세전략 추천, 상품 가격표, 제안 주제. 도입 검토중이라 사이드바에는 '도입 검토중' 아래에만 있습니다."
      />

      <Surface className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-section text-slate-900">이 고객</span>
          <span className="t-meta text-slate-500">한 번 적으면 네 탭이 모두 이 고객 기준으로 바뀝니다</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">회사명</span>
            <input aria-label="회사명" value={form.name} onChange={(e) => set('name', e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">업종</span>
            <select aria-label="업종" value={form.industry} onChange={(e) => set('industry', e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">선택</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">매출 (백만원)</span>
            <input aria-label="매출" inputMode="numeric" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} className={`mt-1 ${inputCls} text-right tabular-nums`} placeholder="2500 = 25억" />
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">직원 수</span>
            <input aria-label="직원 수" inputMode="numeric" value={form.empCount} onChange={(e) => set('empCount', e.target.value)} className={`mt-1 ${inputCls} text-right tabular-nums`} />
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">대표 나이</span>
            <input aria-label="대표 나이" inputMode="numeric" value={form.ceoAge} onChange={(e) => set('ceoAge', e.target.value)} className={`mt-1 ${inputCls} text-right tabular-nums`} />
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">업력 (년)</span>
            <input aria-label="업력" inputMode="numeric" value={form.estYears} onChange={(e) => set('estYears', e.target.value)} className={`mt-1 ${inputCls} text-right tabular-nums`} />
          </label>
        </div>
        <label className="block">
          <span className="t-sub font-medium text-slate-600">메모 붙여넣기 → 자동 인식</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <textarea aria-label="메모" rows={2} value={form.memo} onChange={(e) => set('memo', e.target.value)} className={inputCls} placeholder="예: 제조업 매출 25억 직원 12명 대표 58세 업력 18년 가지급금 있음" />
            <Button size="sm" onClick={applyMemo} className="shrink-0 self-start">
              메모에서 읽기
            </Button>
          </div>
        </label>
        <div className="flex flex-col gap-2">
          {CUST_SECTIONS.map((sec) => (
            <fieldset key={sec}>
              <legend className="t-meta font-medium text-slate-500">{sec}</legend>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {CUST_FLAGS.filter((f) => f[2] === sec).map(([key, label]) => {
                  const on = !!form.flags[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('flags', { ...form.flags, [key]: !on })}
                      className={`tap rounded-(--radius-control) border px-2.5 py-1.5 t-meta font-medium break-keep ${
                        on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Badge tone="brand">관심사 {item.interests?.length ? item.interests.join(' · ') : '없음'}</Badge>
          <Badge>테마 {MEETING_THEMES[theme]?.label ?? theme}</Badge>
          <Badge tone={signal.level === 'red' ? 'danger' : signal.level === 'yellow' ? 'warning' : 'success'}>{String(signal.label ?? signal.level)}</Badge>
          <Badge tone={score >= 70 ? 'success' : score >= 55 ? 'warning' : 'neutral'} >
            리드 점수 {score} · {band.label}
          </Badge>
          {missed.length > 0 && <span className="t-meta text-slate-500">놓치기 쉬운 점검 {missed.length}건</span>}
        </div>
      </Surface>

      <div role="tablist" aria-label="영업 도구" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams({ t: t.key }, { replace: true })}
            className={`tap shrink-0 rounded-(--radius-control) border px-3 py-2 t-sub font-medium ${
              tab === t.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meeting' && (
        <Section title="미팅 대본" action={<CopyButton text={planText} />}>
          <div className="flex flex-wrap gap-1.5">
            {(['m1', 'm2', 'm3'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stage === s}
                onClick={() => setStage(s)}
                className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium ${stage === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {s === 'm1' ? '1차 미팅' : s === 'm2' ? '2차 미팅' : '3차 클로징'}
              </button>
            ))}
          </div>
          <Surface className="flex flex-col gap-4 p-4">
            <div data-testid="sales-plan" className="contents">
            {Object.entries(plan as unknown as Record<string, unknown>).map(([k, v]) => {
              if (k === 'title') return <span key={k} className="t-card font-bold text-slate-900">{String(v)}</span>
              const LABEL: Record<string, string> = {
                goal: '목표', opening: '오프닝', questions: '질문', avoid: '조심할 주제', next: '다음 단계', kakao: '카톡 문구', docs: '요청 자료',
                topIssues: '핵심 이슈', approach: '제안 순서', objections: '반론 대응', close: '클로징', fee: '수임료 범위',
                strategy: '전략', proposal: '제안', priceTalk: '가격 저항', holdTalk: '보류 대응', contractKakao: '계약 카톡',
              }
              return (
                <div key={k} className="flex flex-col gap-1">
                  <span className="t-meta font-medium text-slate-500">{LABEL[k] ?? k}</span>
                  {Array.isArray(v) ? (
                    <Lines items={v.map((x) => (Array.isArray(x) ? `"${x[0]}" → ${x[1]}` : String(x)))} />
                  ) : (
                    <p className="t-sub break-keep whitespace-pre-wrap text-slate-700">{String(v)}</p>
                  )}
                </div>
              )
            })}
            </div>
          </Surface>
          <Disclosure title="콜드콜 스크립트 · 후킹" hint={`리드 ${score}점 · ${band.label}`}>
            <div className="flex flex-col gap-3">
              <p className="t-sub break-keep text-slate-600"><b>대상</b> {String(lead.target)}</p>
              <p className="t-sub break-keep text-slate-700"><b>후킹</b> {String(lead.hook)}</p>
              <pre className="t-sub break-keep whitespace-pre-wrap text-slate-600">{String(lead.phone)}</pre>
              <pre className="t-sub break-keep whitespace-pre-wrap rounded-(--radius-control) bg-slate-50 p-3 text-slate-600">{String(lead.kakao)}</pre>
              <Lines items={(lead.objections as Array<[string, string]>).map((o) => `"${o[0]}" → ${o[1]}`)} />
            </div>
          </Disclosure>
          <Disclosure title="보류 사유별 대응" hint={`${HOLD_REASONS.length}가지`}>
            <Lines items={HOLD_REASONS.map((r) => `${r} — ${holdReasonAdvice(r)}`)} />
          </Disclosure>
          <div className="flex">
            <ToolResultAttach toolKey="sales-kit" title="미팅 대본" verdict={theme} verdictLabel={MEETING_THEMES[theme]?.label ?? theme} summary={planText} data={{ form, stage }} />
          </div>
        </Section>
      )}

      {tab === 'strategy' && (
        <Section title="추천 전략 TOP 3" count={strategies.length}>
          <div className="grid gap-2.5 xl:grid-cols-3" data-testid="sales-strategies">
            {strategies.map((s, i) => (
              <Surface key={s.id} edge={i === 0 ? 'brand' : 'neutral'} showEdge={i === 0} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="t-card font-bold text-slate-900">{s.name}</span>
                  <Badge tone={LEVEL_TONE[s.level] ?? 'neutral'}>난도 {s.level}</Badge>
                </div>
                <p className="t-sub break-keep text-slate-600"><b>맞는 곳</b> {s.fit}</p>
                <p className="t-sub break-keep text-slate-700">{s.pitch}</p>
                <Lines items={s.questions} />
                <p className="t-meta break-keep text-slate-500">자료: {s.docs.join(' · ')}</p>
                <p className="t-meta break-keep text-warning-700">주의: {s.risk}</p>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span className="t-sub font-medium text-slate-800">수임료 {s.fee}</span>
                  {s.needTaxPro && <Badge>세무사 검토 권장</Badge>}
                </div>
                <p className="t-sub break-keep text-slate-600">{s.close}</p>
              </Surface>
            ))}
          </div>
          <Disclosure title="전략 라이브러리 전체" hint={`${STRATEGY_LIBRARY.length}종`}>
            <ul className="flex flex-col divide-y divide-slate-100">
              {STRATEGY_LIBRARY.map((s) => (
                <li key={s.id} className="flex flex-col gap-0.5 py-2">
                  <span className="t-body font-medium text-slate-800">
                    {s.name} <span className="t-meta text-slate-500">{s.fields.join(' · ')}</span>
                  </span>
                  <span className="t-meta break-keep text-slate-500">{s.fit} · {s.fee}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        </Section>
      )}

      {tab === 'packages' && (
        <Section title="컨설팅 상품 가격표" count={shownPackages.length}>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {['전체', ...PKG_CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={pkgCat === c}
                onClick={() => setPkgCat(c)}
                className={`tap shrink-0 rounded-(--radius-control) border px-3 py-1.5 t-meta font-medium ${pkgCat === c ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <Surface className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left" data-testid="sales-packages">
              <thead>
                <tr className="t-meta text-slate-500">
                  <th className="px-4 py-2 font-medium">상품</th>
                  <th className="px-4 py-2 font-medium">분류</th>
                  <th className="px-4 py-2 text-right font-medium">기준가</th>
                  <th className="px-4 py-2 font-medium">설명</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownPackages.map((p) => (
                  <tr key={p.id} className="t-sub">
                    <td className="px-4 py-2 font-medium break-keep text-slate-800">{p.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{p.cat}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-900 tabular-nums">{p.fee.toLocaleString()}만원</td>
                    <td className="px-4 py-2 break-keep text-slate-600">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
          <p className="t-meta break-keep text-slate-400">가격은 원본 OS 의 기준가(만원)입니다. 실제 견적은 범위에 따라 달라집니다.</p>
        </Section>
      )}

      {tab === 'weapons' && (
        <Section title="제안 주제 34종" action={<input aria-label="주제 찾기" placeholder="찾기" value={weaponQ} onChange={(e) => setWeaponQ(e.target.value)} className={`${inputCls} w-40`} />}>
          <div className="flex flex-col gap-2.5" data-testid="sales-weapons">
            {weaponsFiltered.map((c) => (
              <Disclosure key={c.cat} title={c.cat} hint={`${c.items.length}개`} defaultOpen={weaponQ.trim() !== ''}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {c.items.map((w) => (
                    <Surface key={w.name} className="flex flex-col gap-1 p-3">
                      <span className="t-body font-bold text-slate-900">{w.name}</span>
                      <p className="t-sub break-keep text-slate-600"><b>왜 관심</b> {w.p}</p>
                      <p className="t-sub break-keep text-slate-600"><b>확인할 것</b> {w.r}</p>
                      <p className="t-sub break-keep text-slate-700"><b>질문</b> {w.q}</p>
                      <p className="t-meta break-keep text-slate-500">자료: {w.d}</p>
                    </Surface>
                  ))}
                </div>
              </Disclosure>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
