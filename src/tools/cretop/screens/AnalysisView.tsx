/**
 * 크레탑 분석 결과 — 원본 영업 OS 의 '크레탑 핵심지표 점검' 화면을 그대로 세운 것 (D-92).
 *
 * 원본: corp-consult-sales-os/src/App.jsx 1739~1990 `CretopCoreCheck`.
 * 색이 중요하다 — 대표가 한눈에 '좋아졌다/나빠졌다' 를 읽는 화면이기 때문이다.
 *  - 핵심지표 칸은 **칸 전체**가 색으로 찬다 (위험 빨강 · 양호 초록 · 우수 파랑/보라 · 주의 노랑) + 꼬리표.
 *  - 3개년 추이의 연도 사이 변화 칸은 좋아지면 초록, 나빠지면 빨강으로 **칸 전체**가 칠해진다.
 *  - 추이 한 줄 평은 **글상자 전체**가 빨강/초록 바탕이다.
 * 색 값은 원본의 것을 한 글자도 바꾸지 않았다 (C 팔레트 · CRETOP_PREVIEW_TONES).
 */

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  cretopCashflowGradeInfo,
  cretopPreviewTone,
  cretopTrendCommentRich,
  CORE_LABELS,
  CORE_PREVIEW_ORDER,
  CRETOP_PREVIEW_TONES,
  CRETOP_UF,
} from '../engine/index.js'
import type { CretopAmount, CretopDetailItem, CretopDetailStatement, CretopParsedForUi, CretopTrend, CretopTrendRow, CretopTrendStep } from '../engine/index.js'
import type { MeetingPoints } from '../lib/meetingPoints'
import { CRETOP_WEAPONS, CRETOP_WEAPON_MAP } from '../../salesKit/lib/salesData.js'
import { changeColor, CRETOP_C, transColor, TREND_COMMENT_TONE } from '../lib/tones'

const C = CRETOP_C

/* ------------------------------------------------------------------ */
/* 작은 조각                                                             */
/* ------------------------------------------------------------------ */

function fmt(v: unknown, u: string): string {
  if (v == null) return '—'
  if (typeof v !== 'number') return String(v)
  return `${(Math.round(v * 100) / 100).toLocaleString()}${u === '억원' ? '억' : u || ''}`
}
const y2 = (y: unknown) => String(y == null ? '?' : y).slice(-2)
const round2 = (v: number) => Math.round(v * 100) / 100

function YearBox({ yr, body, neg }: { yr: unknown; body: string; neg: boolean }) {
  return (
    <div className="shrink-0 rounded-[9px] border bg-white px-3 py-1.5 text-center" style={{ borderColor: C.bdr, minWidth: 72 }}>
      <div className="t-meta font-bold" style={{ color: C.textM }}>
        {yr == null ? '?' : `${String(yr)}년`}
      </div>
      <div className="t-sub font-black whitespace-nowrap" style={{ color: neg ? C.err : C.text }}>
        {body}
      </div>
    </div>
  )
}

/** 연도 사이 변화 칸 — 칸 전체가 색으로 찬다 */
function ChangeChip({ fromY, toY, main, sub, col }: { fromY: unknown; toY: unknown; main: string; sub: string; col: string }) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center self-center rounded-[7px] border px-2 py-1"
      style={{ background: `${col}24`, borderColor: `${col}66`, minWidth: 58 }}
      data-change-color={col}
    >
      <span className="text-[0.72rem] font-bold" style={{ color: C.textM }}>
        {y2(fromY)}→{y2(toY)}
      </span>
      <span className="text-[0.86rem] font-extrabold whitespace-nowrap" style={{ color: col }}>
        {main}
      </span>
      {sub && (
        <span className="text-[0.72rem] font-bold whitespace-nowrap" style={{ color: col }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function StepChip({ st, t, k }: { st: CretopTrendStep; t: CretopTrend; k: string }) {
  const u = t.unit
  const dAbs = st.deltaAbs ?? 0
  if (!t.isRatio) {
    const main = `${dAbs > 0 ? '+' : ''}${fmt(st.deltaAbs, u)}`
    // 부호가 바뀐 구간(흑자전환·적자전환…)은 % 가 오해를 준다 — 전환 문구를 보조로
    const sub = st.transition ? st.transition : st.deltaPct != null ? `${st.deltaPct > 0 ? '+' : ''}${st.deltaPct}%` : '비교 불가'
    return <ChangeChip fromY={st.fromYear} toY={st.toYear} main={main} sub={sub} col={st.transition ? transColor(st.transition) : changeColor(k, st.dir)} />
  }
  const diffUnit = u === '%' ? '%p' : u || ''
  return <ChangeChip fromY={st.fromYear} toY={st.toYear} main={`${dAbs > 0 ? '+' : ''}${round2(dAbs).toLocaleString()}${diffUnit}`} sub="" col={changeColor(k, st.dir)} />
}

function SeriesRow({ t, k }: { t: CretopTrend; k: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {t.series.map((s, i) => (
        <span key={i} className="contents">
          <YearBox yr={s.year} body={fmt(s.val, t.unit)} neg={typeof s.val === 'number' && s.val < 0} />
          {t.steps[i] && <StepChip st={t.steps[i]} t={t} k={k} />}
        </span>
      ))}
    </div>
  )
}

/** 접었다 펴는 칸 — 원본의 ▸/▾ 머리 */
function Fold({
  title,
  meta,
  color = C.text,
  open,
  onToggle,
  children,
  testId,
  big,
}: {
  title: ReactNode
  meta?: ReactNode
  color?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  testId?: string
  big?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: C.bdr }} data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`tap flex w-full items-center gap-1.5 px-3 py-2.5 text-left font-extrabold ${big ? 't-card' : 't-sub'}`}
        style={{ color, background: open ? '#F5F7FA' : '#fff' }}
      >
        <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="min-w-0 break-keep">{title}</span>
        {meta && <span className="t-meta font-bold" style={{ color: C.textM }}>{meta}</span>}
      </button>
      {open && (
        <div className="border-t p-2" style={{ borderColor: C.bdr }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 회사 카드                                                             */
/* ------------------------------------------------------------------ */

const GRADE_LOWER = ['aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'ccc 이하']
const GRADE_UPPER = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC 이하']

function CompanyCard({ ui, manualGrade, setManualGrade, reportName }: { ui: CretopParsedForUi; manualGrade: string; setManualGrade: (g: string) => void; reportName: string }) {
  const co = ui.companyInfo as Record<string, unknown>
  const s = (k: string) => (co[k] == null ? '' : String(co[k]))
  const cg = manualGrade || s('creditGrade')
  const needGrade = !manualGrade && (!s('creditGrade') || s('creditGrade') === '이미지 원문 확인 필요')
  const cfG = ui.companyInfo.cashflowGrade
  const cfInfo = cfG?.latest ? cretopCashflowGradeInfo(cfG.latest) : null
  const rows: Array<[string, string]> = []
  const add = (k: string, v: string) => {
    if (v) rows.push([k, v])
  }
  add('사업자번호', s('businessNo'))
  add('법인번호', s('corpRegNo'))
  add('대표자', s('ceoName'))
  add('종업원', s('employees') ? `${s('employees')}명` : '')
  add('설립일', s('established'))
  add('결산월', s('settleMonth') ? `${s('settleMonth')}월` : '')
  add('기업유형', s('corpType'))
  add('기업규모', s('scale'))
  add('주소', s('address'))
  add('표준산업분류 10차', s('industry10') || s('stdIndustry10'))
  add('표준산업분류 11차', s('industry11') || s('stdIndustry11'))
  if (!(s('industry10') || s('stdIndustry10') || s('industry11') || s('stdIndustry11'))) add('표준산업분류', s('standardIndustry') || s('industry'))
  add('주요제품', s('mainProduct'))
  const certRows: Array<[string, string]> = [
    ['벤처', 'venture'],
    ['이노비즈', 'innobiz'],
    ['메인비즈', 'mainbiz'],
    ['연구개발전담부서', 'rndDept'],
    ['부설연구소', 'rndLab'],
  ]
  const ipRows: Array<[string, string]> = [
    ['특허', 'patent'],
    ['실용신안', 'utility'],
    ['디자인', 'design'],
    ['상표권', 'trademark'],
  ]
  const bid = co.bid as { tenders?: number; wins?: number } | null | undefined

  return (
    <div className="rounded-xl border bg-white p-3 sm:p-4" style={{ borderColor: C.bdr }}>
      <p className="t-card font-black break-keep" style={{ color: C.text }} data-testid="cretop-company">
        🏢 {s('companyName') || reportName || '(기업명 원문 확인 필요)'}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 t-meta">
        {cg && cg !== '이미지 원문 확인 필요' ? (
          <span className="rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: C.purple }} data-testid="cretop-credit-grade">
            신용등급 {cg}
          </span>
        ) : (
          <span className="rounded-md px-2 py-0.5" style={{ color: C.textM, background: C.bg }}>
            신용등급 이미지 원문 확인 필요
          </span>
        )}
        {needGrade && (
          <>
            <select
              value=""
              aria-label="신용등급 직접 입력"
              data-testid="cretop-manual-grade"
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                setManualGrade(v === '미확인' ? '' : v)
              }}
              className="rounded-md border bg-white px-1 py-0.5"
              style={{ borderColor: `${C.purple}66`, color: C.purple, maxWidth: 190 }}
            >
              <option value="">＋ 신용등급 직접 입력</option>
              <optgroup label="모의평가 등급(소문자)">
                {GRADE_LOWER.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </optgroup>
              <optgroup label="정식 신용평가 등급(대문자)">
                {GRADE_UPPER.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </optgroup>
              <option value="미확인">미확인</option>
            </select>
            <span style={{ color: C.textM }}>소문자=모의평가 · 대문자=정식 신용평가</span>
          </>
        )}
        {manualGrade && (
          <button type="button" onClick={() => setManualGrade('')} className="rounded-md border bg-white px-1.5 py-0.5" style={{ borderColor: C.bdr, color: C.textM }}>
            ↺ 직접입력 해제
          </button>
        )}
        {cfInfo && cfG && (
          <span className="rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: cfInfo.color }}>
            현금흐름 {cfG.latest} · {cfInfo.level}
          </span>
        )}
        {s('ewGrade') && (
          <span className="rounded-md border px-2 py-0.5 font-extrabold" style={{ color: C.textS, background: C.bg, borderColor: C.bdr }}>
            EW등급 {s('ewGrade')}
          </span>
        )}
        {s('techEval') && (
          <span className="rounded-md px-2 py-0.5 font-extrabold" style={{ color: C.blue, background: C.blueBg }}>
            기술력 {s('techEval')}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <div className="mt-2 grid gap-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="t-sub break-keep" style={{ color: C.textS }}>
              <span className="inline-block" style={{ color: C.textM, minWidth: 110 }}>
                {k}
              </span>{' '}
              {v}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2.5">
        <div className="t-meta mb-1 font-extrabold" style={{ color: C.textS }}>
          기업인증 <span className="font-semibold" style={{ color: C.textM }}>(인증 표 기준)</span>
        </div>
        <div className="flex flex-wrap gap-1.5 t-meta">
          {certRows.map(([nm, key]) => {
            const st = ui.certInfo[key] as string | undefined
            const col = st === '인증' ? C.ok : st === '미인증' ? C.textM : C.warn
            return (
              <span key={key} className="rounded-md px-2 py-0.5 font-bold text-white" style={{ background: col }}>
                {nm} {st || '확인 필요'}
              </span>
            )
          })}
        </div>
        <div className="t-meta mt-2 mb-1 font-extrabold" style={{ color: C.textS }}>
          산업재산권
        </div>
        <div className="flex flex-wrap gap-1.5 t-meta">
          {ipRows.map(([nm, key]) => {
            const c = ui.ipInfo[key]
            const has = typeof c === 'number' && c >= 1
            return (
              <span
                key={key}
                className="rounded-md border px-2 py-0.5"
                style={{ fontWeight: has ? 800 : 700, color: has ? '#fff' : C.textS, background: has ? C.purple : C.bg, borderColor: has ? C.purple : C.bdr }}
              >
                {nm} {c != null ? `${String(c)}건` : '원문 확인 필요'}
              </span>
            )
          })}
        </div>
        {bid && (bid.tenders || bid.wins) ? (
          <div className="t-meta mt-1.5" style={{ color: C.textS }}>
            나라장터{' '}
            {bid.tenders ? (
              <b className="font-black" style={{ color: C.blue }}>
                입찰 {bid.tenders.toLocaleString()}건
              </b>
            ) : null}
            {bid.wins ? (
              <>
                {' '}
                ·{' '}
                <b className="font-black" style={{ color: C.gold }}>
                  낙찰 {bid.wins.toLocaleString()}건
                </b>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 핵심지표 미리보기 — 칸 전체 색                                          */
/* ------------------------------------------------------------------ */

function previewText(k: string, p: CretopAmount | null | undefined, manualGrade: string): { val: string | null; yr: number | null } {
  if (k === 'creditGrade') return { val: manualGrade || (p && p.value != null ? String(p.value) : null), yr: null }
  if (!p) return { val: null, yr: null }
  if (k === 'cashflowGrade') return { val: (p as unknown as { latest?: string }).latest || null, yr: null }
  if (p.isRatio) return { val: p.value != null ? `${Math.round(p.value * 100) / 100}${p.unit || ''}` : null, yr: p.year ?? null }
  if (p.absent) return { val: '0원', yr: null }
  return { val: p.eok != null ? (Math.abs(p.eok) < 0.005 ? '0.01억 미만' : `${p.eok.toLocaleString()}억`) : null, yr: p.year ?? null }
}

function PreviewGrid({ ui, manualGrade }: { ui: CretopParsedForUi; manualGrade: string }) {
  return (
    <div className="rounded-xl border-2 p-3 sm:p-4" style={{ borderColor: `${C.gold}55`, background: '#FFFCF5' }}>
      <p className="t-card font-black" style={{ color: C.gold }}>
        ⭐ 핵심지표 미리보기
      </p>
      <p className="t-meta mb-2 break-keep" style={{ color: C.textM }}>
        금액·비율은 <b style={{ color: C.textS }}>최신 재무제표 연도</b> 기준 계산값입니다. (부채비율=부채총계/자본총계, 유동비율=유동자산/유동부채, 이자보상배수=영업이익/이자비용 — 산출 불가 시 ‘원문 확인 필요’) · 재무비율 5개 영역은 보고서 재무비율 표(과거 연도일 수 있음) 기준
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))]" data-testid="cretop-preview">
        {CORE_PREVIEW_ORDER.map((k) => {
          const p = ui.corePreview[k]
          const lbl = k === 'creditGrade' ? '신용등급' : CORE_LABELS[k] || k
          const { val, yr } = previewText(k, p, manualGrade)
          const tn = cretopPreviewTone(k, p ?? null, manualGrade || null)
          const T = tn ? CRETOP_PREVIEW_TONES[tn] : null
          return (
            <div
              key={k}
              className="min-w-0 rounded-lg border px-2.5 py-2"
              style={{ background: T ? T.bg : '#fff', borderColor: T ? T.bd : C.bdr }}
              data-tone={tn ?? 'none'}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="t-meta min-w-0 font-bold break-keep" style={{ color: C.textS }}>
                  {lbl}
                  {yr ? ` (${yr}년)` : ''}
                </span>
                {T && (
                  <span className="shrink-0 rounded-[5px] border bg-white px-1.5 text-[0.72rem] font-extrabold whitespace-nowrap" style={{ color: T.fg, borderColor: `${T.fg}55` }}>
                    {T.tag}
                  </span>
                )}
              </div>
              <div className="t-card mt-0.5 truncate font-black" style={{ color: T ? T.fg : val ? C.text : C.textM }} data-k={k}>
                {val || '원문 확인 필요'}
              </div>
              {k === 'debtRatio' && p?.capitalErosion && (
                <div className="text-[0.72rem] font-extrabold" style={{ color: '#B91C1C' }}>
                  자본잠식 위험 — 원문 확인 필요
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1차 미팅 포인트 + 추가 제안 포인트                                     */
/* ------------------------------------------------------------------ */

function MeetingBlock({ points, weapons, setWeapons }: { points: MeetingPoints; weapons: string[]; setWeapons: (fn: (w: string[]) => string[]) => void }) {
  const [open, setOpen] = useState(true)
  const [wOpen, setWOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const pairs = points.pointPairs.length ? points.pointPairs : points.topPoints.map((t, i) => ({ title: t, q: points.questions[i] || '' }))
  const selW = weapons.map((nm) => CRETOP_WEAPON_MAP[nm]).filter(Boolean)
  const copyText =
    `[1차 미팅 포인트]\n${pairs.map((p, i) => `${i + 1}. ${p.title}${p.q ? `\n   질문: ${p.q}` : ''}`).join('\n')}` +
    (selW.length ? `\n\n[선택한 추가 제안 포인트]\n${selW.map((w, i) => `${i + 1}. ${w.name}\n대표자 관심 포인트: ${w.p}\n검토 포인트: ${w.r}\n핵심 질문: ${w.q}\n관련 혜택/자료: ${w.d}`).join('\n\n')}` : '') +
    (points.docs.length ? `\n\n[요청자료]\n${points.docs.join(', ')}` : '')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 */
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: `${C.blue}40` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tap t-card flex w-full items-center gap-1.5 px-3 py-2.5 text-left font-black"
        style={{ color: C.blue, background: open ? '#EEF4FF' : '#fff' }}
      >
        <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        🎯 1차 미팅 포인트
        <span className="t-meta font-bold" style={{ color: C.textM }}>
          {points.topPoints.length}개
        </span>
      </button>
      {open && (
        <div className="border-t p-3 sm:p-4" style={{ borderColor: `${C.blue}30` }}>
          <ol className="grid gap-2.5" data-testid="cretop-points">
            {pairs.map((p, i) => (
              <li key={p.title}>
                <div className="t-sub font-bold break-keep" style={{ color: C.textS }}>
                  {i + 1}. {p.title}
                </div>
                {p.q && (
                  <div className="t-sub mt-0.5 break-keep pl-3" style={{ color: C.blue }}>
                    ↳ 질문: {p.q}
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-3.5 overflow-hidden rounded-[10px] border" style={{ borderColor: `${C.purple}33` }}>
            <button
              type="button"
              aria-expanded={wOpen}
              onClick={() => setWOpen((v) => !v)}
              data-testid="cretop-weapons-open"
              className="tap t-sub flex w-full items-center gap-1.5 px-3 py-2 text-left font-extrabold"
              style={{ color: C.purple, background: wOpen ? '#F5F1FF' : '#fff' }}
            >
              <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${wOpen ? 'rotate-90' : ''}`} />
              🧩 추가 제안 포인트 선택
              {weapons.length > 0 && (
                <span className="t-meta rounded-md px-2 text-white" style={{ background: C.purple }}>
                  {weapons.length}개 선택
                </span>
              )}
            </button>
            {wOpen && (
              <div className="border-t px-3 pt-2 pb-3" style={{ borderColor: `${C.purple}22` }}>
                <p className="t-meta mb-2 break-keep" style={{ color: C.textM }}>
                  이번 미팅에서 함께 확인할 제안 주제를 선택하세요. 선택한 항목은 1차 미팅 포인트와 복사 내용에 함께 포함됩니다.
                </p>
                {CRETOP_WEAPONS.map((g) => (
                  <div key={g.cat} className="mb-2">
                    <div className="t-meta mb-1 font-extrabold" style={{ color: C.textS }}>
                      {g.cat}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((it) => {
                        const on = weapons.includes(it.name)
                        return (
                          <button
                            key={it.name}
                            type="button"
                            title={it.p}
                            aria-pressed={on}
                            data-weapon={it.name}
                            onClick={() => setWeapons((w) => (w.includes(it.name) ? w.filter((x) => x !== it.name) : [...w, it.name]))}
                            className="t-meta rounded-[7px] border px-2.5 py-1"
                            style={{ borderColor: on ? C.purple : C.bdr, background: on ? C.purple : '#fff', color: on ? '#fff' : C.textS, fontWeight: on ? 800 : 600 }}
                          >
                            {on ? '✓ ' : ''}
                            {it.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selW.length > 0 && (
            <div className="mt-3" data-testid="cretop-weapons-selected">
              <div className="t-sub mb-1.5 font-black" style={{ color: C.purple }}>
                선택한 추가 제안 포인트 <span className="t-meta font-bold" style={{ color: C.textM }}>({selW.length})</span>
              </div>
              <div className="grid gap-2">
                {selW.map((w) => (
                  <div key={w.name} className="rounded-lg border px-3 py-2" style={{ background: C.purpleBg, borderColor: `${C.purple}22` }}>
                    <div className="t-sub mb-0.5 font-black" style={{ color: C.purple }}>
                      + {w.name}
                    </div>
                    <div className="t-meta break-keep" style={{ color: C.textS }}>
                      <b style={{ color: C.text }}>대표자 관심 포인트</b> · {w.p}
                    </div>
                    <div className="t-meta mt-0.5 break-keep" style={{ color: C.textS }}>
                      <b style={{ color: C.text }}>검토 포인트</b> · {w.r}
                    </div>
                    <div className="t-meta mt-0.5 break-keep" style={{ color: C.blue }}>
                      <b>핵심 질문</b> · {w.q}
                    </div>
                    <div className="t-meta mt-0.5 break-keep" style={{ color: C.textM }}>
                      <b>관련 혜택/자료</b> · {w.d}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {points.docs.length > 0 && (
            <p className="t-meta mt-2.5 break-keep" style={{ color: C.textM }}>
              요청자료: {points.docs.join(', ')}
            </p>
          )}
          {points.proposals.length > 0 && (
            <p className="t-meta mt-1 break-keep" style={{ color: C.textM }}>
              제안 후보: {points.proposals.join(' / ')}
            </p>
          )}
          <div className="mt-2.5">
            <Button size="sm" onClick={() => void copy()} data-testid="cretop-points-copy">
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? '복사됨' : '미팅 포인트 복사'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3개년 추이 · 5영역 · 상세 재무제표                                      */
/* ------------------------------------------------------------------ */

const gradeNum = (g: unknown) => {
  const n = parseInt(String(g).replace(/\D/g, ''), 10)
  return isNaN(n) ? null : n
}

export function TrendCardView({ row }: { row: CretopTrendRow }) {
  if (row.isGrade) {
    const ser = row.gradeSeries ?? []
    if (!ser.length) return null
    const yrs = row.years ?? []
    const gi = cretopCashflowGradeInfo(ser[ser.length - 1])
    return (
      <div className="grid max-w-full gap-1.5 rounded-[9px] border bg-white px-2.5 py-2" style={{ borderColor: C.bdr }} data-trend={row.key}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-sub font-extrabold" style={{ color: C.text }}>
            현금흐름등급
          </span>
          <span className="t-meta rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: gi.color }}>
            {ser[ser.length - 1]} · {gi.level}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ser.map((gv, i) => {
            let chip: ReactNode = null
            if (i < ser.length - 1) {
              const a = gradeNum(ser[i])
              const b = gradeNum(ser[i + 1])
              const d = a == null || b == null ? '확인 필요' : b > a ? '악화' : b < a ? '개선' : '유지'
              const col = d === '악화' ? C.err : d === '개선' ? C.ok : C.textM
              chip = <ChangeChip fromY={yrs[i]} toY={yrs[i + 1]} main={d} sub="" col={col} />
            }
            return (
              <span key={i} className="contents">
                <YearBox yr={yrs[i]} body={gv} neg={false} />
                {chip}
              </span>
            )
          })}
        </div>
        <div className="t-meta rounded-lg border px-2.5 py-1.5 break-keep" style={{ color: gi.level === '현금흐름 주의' ? '#991B1B' : C.textS, background: `${gi.color}24`, borderColor: `${gi.color}66` }}>
          <b style={{ color: gi.color }}>{gi.level}</b> · {gi.text}
        </div>
      </div>
    )
  }
  const t = row.trend
  if (!t || !t.series.length) return null
  const rc = cretopTrendCommentRich(row.key, t)
  const tc = TREND_COMMENT_TONE[rc.tone] ?? TREND_COMMENT_TONE.gray
  const latestNeg = t.latest && typeof t.latest.val === 'number' && t.latest.val < 0
  return (
    <div className="grid max-w-full gap-1.5 rounded-[9px] border bg-white px-2.5 py-2" style={{ borderColor: C.bdr }} data-trend={row.key} data-tone={rc.tone}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-sub font-extrabold" style={{ color: C.text }}>
          {row.label}
        </span>
        <span className="t-sub font-extrabold" style={{ color: latestNeg ? C.err : C.text }}>
          {t.latest ? fmt(t.latest.val, t.unit) : '—'}
        </span>
      </div>
      <SeriesRow t={t} k={row.key} />
      {/* 한 줄 평 — 글상자 전체가 빨강/초록 */}
      <div className="t-sub rounded-lg border px-2.5 py-2 font-bold break-keep" style={{ color: tc.fg, background: tc.bg, borderColor: tc.bd }} data-trend-comment={rc.tone}>
        {rc.text}
      </div>
    </div>
  )
}

function AreaMetric({ m }: { m: CretopTrendRow }) {
  const t = m.trend
  const usable = !m.missing && t && t.series && t.series.length
  return (
    <div className="border-t border-dashed py-1.5" style={{ borderColor: C.bdr }}>
      <div className="t-meta mb-1 font-bold" style={{ color: C.textS }}>
        {m.label}
        {m.rawLabel && m.label !== m.rawLabel ? (
          <span className="font-normal" style={{ color: C.textM }}>
            {' '}
            · 원문 {m.rawLabel}
          </span>
        ) : null}
      </div>
      {usable && t ? (
        <SeriesRow t={t} k={m.key} />
      ) : (
        <span className="t-meta" style={{ color: C.textM }}>
          원문 후보 없음
        </span>
      )}
    </div>
  )
}

const STMT_META: Array<[string, string, string]> = [
  ['bs', '재무상태표', 'balanceSheet'],
  ['is', '손익계산서', 'incomeStatement'],
  ['re', '이익잉여금처분계산서', 'retainedEarnings'],
  ['mc', '제조원가명세서', 'manufacturingCost'],
]

function DetailItem({ r, gYears }: { r: CretopDetailItem; gYears: Array<number | null> }) {
  const vals = r.numberCandidates || []
  const ys = r.yearCandidates && r.yearCandidates.length ? r.yearCandidates : gYears && gYears.length ? gYears : vals.map(() => null)
  const u = r.unit || '천원'
  const uf = CRETOP_UF[u] != null ? CRETOP_UF[u] : 1e-5
  const eokVals = vals.map((v) => (v == null ? null : Math.round(v * uf * 100) / 100))
  const small = (v: number | null) => v != null && Math.abs(v * uf) < 0.005
  const boxTxt = (i: number) => {
    const v = vals[i]
    if (v == null) return '-'
    if (small(v)) return '0.01억 미만'
    return `${(eokVals[i] ?? 0).toLocaleString()}억`
  }
  let lastIdx = -1
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] != null) {
      lastIdx = i
      break
    }
  }
  const lastV = lastIdx >= 0 ? vals[lastIdx] : null
  const latestTxt = lastV == null ? '' : small(lastV) ? `0.01억 미만 (${lastV.toLocaleString()}${u})` : `${(eokVals[lastIdx] ?? 0).toLocaleString()}억`
  const rawLine = vals.map((v) => (v == null ? '-' : v.toLocaleString())).join(' / ')
  // 부채·차입금·원가·비용 줄은 줄어야 좋아진 것이다
  const lowerBetter = /부채|차입|원가|비용|판매비|관리비/.test(String(r.rawLabel || r.account || ''))
  return (
    <div className="border-t border-dashed py-1.5" style={{ borderColor: C.bdr }}>
      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
        <span className="t-meta font-bold" style={{ color: C.textS }}>
          {r.rawLabel || r.account}
        </span>
        {latestTxt && (
          <span className="text-[0.78rem]" style={{ color: C.textM }}>
            최신 {latestTxt}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {eokVals.map((v, i) => {
          let chip: ReactNode = null
          if (i < eokVals.length - 1) {
            const a = eokVals[i]
            const b = eokVals[i + 1]
            if (a != null && b != null) {
              const d = Math.round((b - a) * 100) / 100
              const col = d === 0 ? C.textM : (d > 0) !== lowerBetter ? C.ok : C.err
              chip = <ChangeChip fromY={ys[i]} toY={ys[i + 1]} main={`${d > 0 ? '+' : ''}${d.toLocaleString()}억`} sub="" col={col} />
            }
          }
          return (
            <span key={i} className="contents">
              <YearBox yr={ys[i] != null ? ys[i] : (gYears && gYears[i]) || '—'} body={boxTxt(i)} neg={typeof v === 'number' && v < 0} />
              {chip}
            </span>
          )
        })}
      </div>
      <div className="mt-0.5 text-[0.72rem]" style={{ color: C.textM }}>
        단위 {u} · 원값 {rawLine}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 전체                                                                 */
/* ------------------------------------------------------------------ */

export interface AnalysisViewProps {
  ui: CretopParsedForUi
  points: MeetingPoints | null
  reportName: string
  manualGrade: string
  setManualGrade: (g: string) => void
  weapons: string[]
  setWeapons: (fn: (w: string[]) => string[]) => void
}

export function AnalysisView({ ui, points, reportName, manualGrade, setManualGrade, weapons, setWeapons }: AnalysisViewProps) {
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ trend: true })
  const toggle = (k: string) => setOpenSec((o) => ({ ...o, [k]: !o[k] }))

  const trendRows = ui.trendRows.filter((r) => (r.isGrade ? (r.gradeSeries?.length ?? 0) > 0 : (r.trend?.series.length ?? 0) > 0))
  const ds = ui.detailStatements as Record<string, CretopDetailStatement | undefined>
  const det = STMT_META.map(([key, defName, prop]) => {
    const s = ds?.[prop] ?? { items: [], years: [], noData: false }
    return { key, name: s.name || defName, items: s.items || [], years: s.years || [], noData: !!s.noData }
  }).filter((g) => g.items.length || g.noData)

  return (
    <div className="flex flex-col gap-3" data-testid="cretop-analysis">
      <CompanyCard ui={ui} manualGrade={manualGrade} setManualGrade={setManualGrade} reportName={reportName} />
      <PreviewGrid ui={ui} manualGrade={manualGrade} />
      {points && points.topPoints.length > 0 && <MeetingBlock points={points} weapons={weapons} setWeapons={setWeapons} />}

      <Fold title="📈 3개년 핵심 추이" meta={`(${trendRows.length})`} open={!!openSec.trend} onToggle={() => toggle('trend')} testId="cretop-trends">
        {trendRows.length ? (
          <div className="grid gap-1.5 lg:grid-cols-2">
            {trendRows.map((r) => (
              <TrendCardView key={r.key} row={r} />
            ))}
          </div>
        ) : (
          <p className="t-meta p-1.5" style={{ color: C.textM }}>
            3개년 추이를 만들 금액 후보가 없습니다.
          </p>
        )}
      </Fold>

      <Fold title="📊 재무비율 5개 영역" meta="(성장성·수익성·재무구조·부채상환능력·활동성)" open={!!openSec.areas} onToggle={() => toggle('areas')} testId="cretop-areas">
        <div className="grid gap-2">
          {ui.ratioAreas.map((a) => {
            const got = a.metrics.filter((m) => !m.missing && m.trend && m.trend.series && m.trend.series.length).length
            const k = `area_${a.key}`
            return (
              <div key={a.key} className="overflow-hidden rounded-[9px] border bg-white" style={{ borderColor: C.bdr }}>
                <button
                  type="button"
                  aria-expanded={!!openSec[k]}
                  onClick={() => toggle(k)}
                  className="tap t-sub flex w-full items-center gap-1.5 px-2.5 py-2 text-left font-extrabold"
                  style={{ color: C.blue, background: openSec[k] ? '#FAFBFD' : '#fff' }}
                >
                  <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${openSec[k] ? 'rotate-90' : ''}`} />
                  {a.name}
                  <span className="t-meta font-bold" style={{ color: C.textM }}>
                    지표 {got}/{a.metrics.length}
                  </span>
                </button>
                {openSec[k] && (
                  <div className="px-2.5 pt-0.5 pb-2.5">
                    {a.metrics.map((m) => (
                      <AreaMetric key={m.key} m={m} />
                    ))}
                    <p className="t-meta mt-1.5 break-keep" style={{ color: C.textM }}>
                      해석: {a.hint}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Fold>

      <Fold title="📑 상세 재무제표 보기" meta={`(원문 기준 참고용 · ${det.length}개 명세서)`} open={!!openSec.detail} onToggle={() => toggle('detail')} testId="cretop-detail">
        {det.length ? (
          <div className="grid gap-2">
            {det.map((g) => {
              const k = `det_${g.key}`
              return (
                <div key={g.key} className="overflow-hidden rounded-[9px] border bg-white" style={{ borderColor: C.bdr }}>
                  <button
                    type="button"
                    aria-expanded={!!openSec[k]}
                    onClick={() => toggle(k)}
                    className="tap t-sub flex w-full items-center gap-1.5 px-2.5 py-2 text-left font-extrabold"
                    style={{ color: C.blue, background: openSec[k] ? '#FAFBFD' : '#fff' }}
                  >
                    <ChevronRight aria-hidden="true" className={`size-4 shrink-0 transition-transform ${openSec[k] ? 'rotate-90' : ''}`} />
                    {g.name}
                    <span className="t-meta font-bold" style={{ color: C.textM }}>
                      {g.noData && !g.items.length ? '원문 자료 없음' : `${g.items.length}개 항목`}
                    </span>
                  </button>
                  {openSec[k] && (
                    <div className="px-2.5 pt-0.5 pb-2.5">
                      {g.noData && !g.items.length ? (
                        <p className="t-meta py-1" style={{ color: C.textM }}>
                          {g.name} 원문 자료가 없습니다.
                        </p>
                      ) : (
                        g.items.map((it, i) => <DetailItem key={it.id ?? i} r={it} gYears={g.years} />)
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="t-meta p-1.5" style={{ color: C.textM }}>
            상세 재무제표 후보를 찾지 못했습니다(원문에 상세표가 없을 수 있습니다).
          </p>
        )}
      </Fold>

      <Fold title="🛠 관리자용 / 디버그 도구" meta="(추천·후보·검수·제외·원문 디버그)" color={C.textM} open={!!openSec.admin} onToggle={() => toggle('admin')}>
        <div className="flex flex-col gap-2 p-1">
          <p className="t-meta break-keep" style={{ color: C.textS }}>
            후보 줄 하나하나를 고치고 고르는 검수는 <Link to="/tools/cretop/core-check" className="font-bold underline" style={{ color: C.blue }}>핵심지표 검수</Link> 화면에서 합니다. 같은 원문을 그대로 읽습니다.
          </p>
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(JSON.stringify(ui, null, 2)).catch(() => undefined)
              }}
            >
              🧪 실제 UI 사용 데이터 JSON 복사
            </Button>
          </div>
          <div className="t-meta rounded-lg border px-2.5 py-1.5 break-all" style={{ color: C.textS, background: C.bg, borderColor: C.bdr }}>
            <div>
              <b>financialYears</b> {JSON.stringify(ui.financialYears || [])} <span style={{ color: C.textM }}>(금액형·미리보기/추이 비율 계산 연도)</span>
            </div>
            <div>
              <b>computedRatioYears</b> {JSON.stringify(ui.computedRatioYears || [])} <span style={{ color: C.textM }}>(재무제표 직접 계산 비율 연도)</span>
            </div>
            <div>
              <b>reportRatioYears</b> {JSON.stringify(ui.reportRatioYears || ui.ratioYears || [])} · <b>source</b> {ui.ratioYearSource} · <b>confidence</b> {ui.ratioYearConfidence}
            </div>
            <div>
              <b>ignoredYears</b> {JSON.stringify(ui.ignoredYears || [])} <span style={{ color: C.textM }}>(조회일시·설립 등 비재무 연도)</span>
            </div>
          </div>
        </div>
      </Fold>
    </div>
  )
}
