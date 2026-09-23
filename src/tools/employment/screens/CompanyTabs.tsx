/**
 * 고용지원금 — 업체 한 곳의 나머지 탭 (D-92).
 *
 * 원본(고용지원금 매니저 Pro) 업체 화면의 탭을 그대로 옮겼다:
 *   개요(지원금별 참여·협약·운영기관·급여일·위험 지표·다가오는 회차) · 업체 서류(5단계) ·
 *   수수료 정산(율·착수금·성공보수·청구·입금·세금계산서·직원별·정산서) · 업무 일지(13종) ·
 *   기관 보고서(운영기관 현황 보고서 — 위험 항목·30일 계획·지원금별·미제출 서류·대표 요약·서류 요청 문구).
 * 기록은 모듈 기록 `employment/companies` 에 업체마다 한 줄. 계산은 lib/companyMeta.ts 가 한다.
 */

import { useMemo, useState } from 'react'
import { Check, Copy, Download, Printer, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { addMo, fD, formatDday, getDdayFrom } from '../lib/dates'
import { fMan } from '../lib/format'
import { EMP_STAGES, EMP_STAGE_LABEL, type EmpRecord } from '../lib/empRecords'
import type { ProgramView } from '../lib/usePrograms'
import {
  DEFAULT_COMPANY_DOCS,
  DOC_STATUS,
  NOTE_TYPES,
  PARTICIPATION_STATES,
  agencyAutoComment,
  agencyDocRequestText,
  agencyReportData,
  agencySummaryText,
  commissionSummary,
  docIsDone,
  docStatusMeta,
  noteTypeMeta,
  type CompanyMeta,
  type ProgramInfo,
} from '../lib/companyMeta'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setOk(true)
            window.setTimeout(() => setOk(false), 1400)
          })
          .catch(() => undefined)
      }}
    >
      {ok ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {ok ? '복사됨' : label}
    </Button>
  )
}

export interface TabProps {
  client: ClientOpsRecord
  meta: CompanyMeta
  patch: (next: Partial<CompanyMeta>) => Promise<void>
  employees: EmpRecord[]
  programs: ProgramView[]
  today: Date
}

/* ------------------------------------------------------------------ */
/* 개요                                                                 */
/* ------------------------------------------------------------------ */

export function OverviewTab({ client, meta, patch, employees, programs, today }: TabProps) {
  const { showToast } = useToast()
  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? id
  const used = Array.from(new Set(employees.map((e) => e.programId).filter(Boolean)))
  const [addPid, setAddPid] = useState('')

  const risk = useMemo(() => {
    let overdue = 0
    let overdueAmt = 0
    let next7 = 0
    let docMiss = 0
    for (const e of employees) {
      if (e.stage === 'resigned') continue
      for (const r of e.rounds) {
        if (r.isPaid || !e.hireDate) continue
        const amt = r.expectedAmount || r.amount || 0
        const dd = getDdayFrom(addMo(e.hireDate, r.month), today)
        if (dd === null) continue
        if (dd < 0) {
          overdue++
          overdueAmt += amt
        } else if (dd <= 7) next7++
      }
      docMiss += e.docs.filter((d) => !d.done).length
    }
    docMiss += meta.companyDocs.filter((d) => !d.done).length
    return { overdue, overdueAmt, next7, docMiss }
  }, [employees, meta.companyDocs, today])

  const upcoming = useMemo(() => {
    const list: Array<{ key: string; name: string; label: string; date: string; dd: number; amount: number }> = []
    for (const e of employees) {
      if (e.stage === 'resigned' || !e.hireDate) continue
      e.rounds.forEach((r, i) => {
        if (r.isPaid) return
        const date = addMo(e.hireDate, r.month)
        const dd = getDdayFrom(date, today)
        if (dd === null || dd > 60) return
        list.push({ key: `${e.id}-${i}`, name: e.name, label: r.label, date, dd, amount: r.expectedAmount || r.amount || 0 })
      })
    }
    return list.sort((a, b) => a.dd - b.dd).slice(0, 10)
  }, [employees, today])

  const setInfo = (idx: number, next: Partial<ProgramInfo>) => {
    const list = meta.programInfos.slice()
    list[idx] = { ...list[idx], ...next }
    void patch({ programInfos: list })
  }
  const addInfo = (pid: string) => {
    if (!pid || meta.programInfos.some((x) => x.programId === pid)) return
    const info: ProgramInfo = {
      id: uid(),
      programId: pid,
      programName: programName(pid),
      year: today.getFullYear(),
      quota: '',
      applyDate: '',
      agreementDate: '',
      participationStatus: '미신청',
      agencyName: '',
      agencyManager: '',
      agencyPhone: '',
      agencyEmail: '',
      memo: '',
    }
    void patch({ programInfos: [...meta.programInfos, info] })
    showToast(`${info.programName} 참여 정보를 더했습니다.`)
  }

  return (
    <div className="flex flex-col gap-4" data-testid="emp-tab-overview">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="지연 신청" value={`${risk.overdue}건`} hint={risk.overdue ? fMan(risk.overdueAmt) : '지연 없음'} tone={risk.overdue ? 'danger' : 'neutral'} />
        <MetricTile label="7일 내 신청" value={`${risk.next7}건`} tone={risk.next7 ? 'warning' : 'neutral'} />
        <MetricTile label="미제출 서류" value={`${risk.docMiss}건`} tone={risk.docMiss ? 'warning' : 'neutral'} hint={risk.docMiss ? '서류 확인' : '모두 완료'} />
        <MetricTile label="대상자" value={`${employees.filter((e) => e.stage !== 'resigned').length}명`} />
      </div>
      {risk.overdue > 0 && (
        <Surface edge="danger" showEdge>
          <p className="t-sub font-bold text-danger-700">🚨 신청 기한 초과! 즉시 처리하세요 — {risk.overdue}건 · {fMan(risk.overdueAmt)}이 걸려 있습니다</p>
        </Surface>
      )}

      <Section title="급여일" action={<span className="t-meta text-slate-500">급여 증빙 요청 시점 계산에 필요</span>}>
        <Surface className="flex flex-wrap items-center gap-2">
          <span className="t-sub text-slate-600">매월</span>
          <input aria-label="급여일" inputMode="numeric" defaultValue={meta.payday} onBlur={(e) => void patch({ payday: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })} className={`${inputCls} w-20`} />
          <span className="t-sub text-slate-600">일</span>
          {!meta.payday && employees.length > 0 && <Badge tone="warning">급여일 미입력</Badge>}
        </Surface>
      </Section>

      <Section title="지원금별 참여 · 협약 · 운영기관" count={meta.programInfos.length}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="참여 정보 더할 지원금" value={addPid} onChange={(e) => setAddPid(e.target.value)} className={`${inputCls} w-auto`}>
              <option value="">지원금 고르기</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {used.includes(p.id) ? ' · 대상자 있음' : ''}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => addInfo(addPid)} disabled={!addPid} data-testid="emp-info-add">
              참여 정보 더하기
            </Button>
            {used
              .filter((pid) => !meta.programInfos.some((x) => x.programId === pid))
              .map((pid) => (
                <Button key={pid} size="sm" variant="ghost" onClick={() => addInfo(pid)}>
                  + {programName(pid)}
                </Button>
              ))}
          </div>
          {meta.programInfos.map((info, idx) => {
            const cur = employees.filter((e) => e.programId === info.programId && e.stage !== 'resigned').length
            const quota = Number(info.quota) || 0
            return (
              <Surface key={info.id} edge={info.agreementDate ? 'success' : 'warning'} showEdge className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="t-body">{info.programName}</b>
                  <span className="t-meta text-slate-500">{info.year}년</span>
                  {quota > 0 && <Badge tone={cur >= quota ? 'danger' : 'neutral'}>지원한도 {quota}명 · 현재 {cur}명</Badge>}
                  {info.agreementDate ? <Badge tone="success">✅ 협약 체결: {fD(info.agreementDate)}</Badge> : <Badge tone="warning">⚠️ 협약 미체결 — 신청 전 협약 필요</Badge>}
                  <button type="button" className="t-meta ml-auto text-slate-400 hover:text-danger-700" onClick={() => void patch({ programInfos: meta.programInfos.filter((x) => x.id !== info.id) })}>
                    지우기
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PARTICIPATION_STATES.map((s) => (
                    <button key={s} type="button" aria-pressed={(info.participationStatus || '미신청') === s} onClick={() => setInfo(idx, { participationStatus: s })} className={`tap t-meta rounded-full border px-2.5 py-1 font-bold ${(info.participationStatus || '미신청') === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="t-meta text-slate-500">사업참여 신청일</span>
                    <input type="date" aria-label={`${info.programName} 신청일`} defaultValue={info.applyDate} onBlur={(e) => setInfo(idx, { applyDate: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="t-meta text-slate-500">협약 체결일</span>
                    <input type="date" aria-label={`${info.programName} 협약일`} defaultValue={info.agreementDate} onBlur={(e) => setInfo(idx, { agreementDate: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="t-meta text-slate-500">지원한도(명)</span>
                    <input aria-label={`${info.programName} 지원한도`} inputMode="numeric" defaultValue={info.quota} onBlur={(e) => setInfo(idx, { quota: e.target.value.replace(/[^\d]/g, '') })} className={inputCls} />
                  </label>
                  {(
                    [
                      ['agencyName', '관할·운영기관명'],
                      ['agencyManager', '담당자'],
                      ['agencyPhone', '연락처'],
                      ['agencyEmail', '이메일'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="block">
                      <span className="t-meta text-slate-500">{label}</span>
                      <input aria-label={`${info.programName} ${label}`} defaultValue={info[k]} onBlur={(e) => setInfo(idx, { [k]: e.target.value })} className={inputCls} />
                    </label>
                  ))}
                  <label className="block sm:col-span-2">
                    <span className="t-meta text-slate-500">메모</span>
                    <input aria-label={`${info.programName} 메모`} defaultValue={info.memo} onBlur={(e) => setInfo(idx, { memo: e.target.value })} className={inputCls} />
                  </label>
                </div>
              </Surface>
            )
          })}
        </div>
      </Section>

      <Section title="다가오는 신청 (60일)" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <p className="t-sub text-slate-500">60일 안에 신청할 회차가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {upcoming.map((u) => (
              <li key={u.key} className="t-sub flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2">
                <b>{u.name}</b>
                <span className="text-slate-600">{u.label}</span>
                <span className="t-meta text-slate-500">{fD(u.date)}</span>
                <Badge tone={u.dd < 0 ? 'danger' : u.dd <= 7 ? 'warning' : 'neutral'}>{formatDday(u.dd)}</Badge>
                <span className="t-meta ml-auto tabular-nums text-slate-500">{fMan(u.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="t-meta text-slate-400">{client.companyName} · 규칙표 기준 1차 검토이며 운영기관 심사 결과에 따라 달라질 수 있습니다.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 서류                                                            */
/* ------------------------------------------------------------------ */

export function CompanyDocsTab({ meta, patch }: TabProps) {
  const [label, setLabel] = useState('')
  const docs = meta.companyDocs
  const done = docs.filter((d) => docIsDone(d)).length
  const pct = docs.length ? Math.round((done / docs.length) * 100) : 0
  const setStatus = (id: string, status: string) => {
    void patch({ companyDocs: docs.map((d) => (d.id === id ? { ...d, status: status as CompanyMeta['companyDocs'][number]['status'], done: status === 'confirmed' } : d)) })
  }
  return (
    <div className="flex flex-col gap-3" data-testid="emp-tab-docs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-sub font-bold">서류 완료율 {pct}%</span>
        <div className="h-2.5 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {docs.length === 0 && (
        <Button size="sm" variant="primary" className="w-fit" onClick={() => void patch({ companyDocs: DEFAULT_COMPANY_DOCS.map((l) => ({ id: uid(), label: l, done: false, status: 'none' })) })} data-testid="emp-docs-default">
          기본 업체 서류 {DEFAULT_COMPANY_DOCS.length}종 넣기
        </Button>
      )}
      <ul className="flex flex-col gap-1.5">
        {docs.map((d) => {
          const st = docStatusMeta(d.status ?? (d.done ? 'confirmed' : 'none'))
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-(--radius-control) px-3 py-2" style={{ background: st.bg }}>
              <b className="t-sub min-w-40">{d.label}</b>
              <select aria-label={`${d.label} 상태`} value={st.id} onChange={(e) => setStatus(d.id, e.target.value)} className="t-sub rounded border border-slate-300 bg-white px-2 py-1 font-bold" style={{ color: st.color }}>
                {DOC_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="button" aria-label={`${d.label} 지우기`} className="ml-auto text-slate-400 hover:text-danger-700" onClick={() => void patch({ companyDocs: docs.filter((x) => x.id !== d.id) })}>
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2">
        <input aria-label="업체 서류 이름" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="서류 이름" className={inputCls} />
        <Button
          size="sm"
          onClick={() => {
            if (!label.trim()) return
            void patch({ companyDocs: [...docs, { id: uid(), label: label.trim(), done: false, status: 'none' }] })
            setLabel('')
          }}
        >
          더하기
        </Button>
      </div>
      <p className="t-meta text-slate-400">파일은 업체 서류함에 올립니다. 여기는 무엇을 받았는지 상태만 적습니다.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 수수료 정산                                                           */
/* ------------------------------------------------------------------ */

export function CommissionTab({ client, meta, patch, employees, programs, today }: TabProps) {
  const { showToast } = useToast()
  const comm = meta.commission
  const s = commissionSummary(comm, employees.filter((e) => e.stage !== 'resigned'))
  const setC = (next: Partial<typeof comm>) => patch({ commission: { ...comm, ...next } })
  const log = (text: string, type: string) => patch({ commission: { ...comm }, notes: [{ id: uid(), text, at: new Date().toISOString(), type }, ...meta.notes] })

  const statement = () => {
    const rd2 = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
    const rows = s.perEmployee.map((r) => `<tr><td>${r.name}</td><td>${programs.find((p) => p.id === r.programId)?.name ?? ''}</td><td class="num">${fMan(r.received)}</td><td class="num" style="color:#059669;font-weight:600">${fMan(r.fee)}</td></tr>`).join('')
    const totalFee = s.perEmployee.reduce((x, r) => x + r.fee, 0)
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>수수료 정산서</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:700px;margin:0 auto;color:#1E293B}h1{font-size:22px;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:16px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0}.sc{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:20px;font-weight:700;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:9px 10px;border-bottom:1px solid #E2E8F0;text-align:left}th{background:#F8FAFC;color:#64748B}.num{text-align:right}tfoot td{font-weight:700;border-top:2px solid #CBD5E1}</style></head><body><h1>💰 수수료 정산서</h1><p style="color:#64748B;font-size:13px">업체: <strong>${client.companyName}</strong> | 정산일: ${rd2}</p><p style="font-size:14px">수수료율: <strong style="color:#059669">${s.rate}%</strong></p><div class="summary"><div class="sc"><div class="l">수령완료 합계</div><div class="v">${fMan(s.totalPaid)}</div></div><div class="sc"><div class="l">수수료율</div><div class="v">${s.rate}%</div></div><div class="sc"><div class="l">정산 수수료</div><div class="v" style="color:#059669">${fMan(totalFee)}</div></div></div><table><thead><tr><th>직원명</th><th>지원금</th><th class="num">수령액 합계</th><th class="num">수수료 (${s.rate}%)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">합계</td><td class="num">${fMan(s.totalPaid)}</td><td class="num" style="color:#059669">${fMan(totalFee)}</td></tr></tfoot></table><div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center">자동 생성 · 실제 수수료는 계약서에 따름</div></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${client.companyName}_수수료정산_${today.toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
    void log('수수료 정산서 출력', '수수료청구')
    showToast('수수료 정산서가 생성되었습니다.')
  }

  const toggles: Array<{ k: 'successFee' | 'billed' | 'paid' | 'taxInvoice'; label: string; on: boolean; type?: string }> = [
    { k: 'successFee', label: '성공보수 적용', on: comm.successFee !== false },
    { k: 'billed', label: '청구 완료', on: !!comm.billed, type: '수수료청구' },
    { k: 'paid', label: '입금 완료', on: !!comm.paid, type: '수수료입금' },
    { k: 'taxInvoice', label: '세금계산서 발행', on: !!comm.taxInvoice },
  ]

  return (
    <div className="flex flex-col gap-4" data-testid="emp-tab-commission">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile label="✅ 수령 완료액" value={fMan(s.totalPaid)} />
        <MetricTile label="💰 예상 총 수수료" value={fMan(s.expected)} hint={`착수금+전체 ${s.rate}%`} />
        <MetricTile label="🧾 청구 가능액" value={fMan(s.billable)} hint={`수령액 기준 ${s.rate}%`} tone="success" />
        <MetricTile label={s.receivable > 0 ? '⏳ 미수금' : '👍 미수금'} value={fMan(s.receivable)} hint={s.state} tone={s.receivable > 0 ? 'danger' : 'neutral'} />
      </div>
      <Section title="⚙️ 정산 설정">
        <Surface className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="t-meta text-slate-500">수수료율 (%)</span>
              <input aria-label="수수료율" inputMode="decimal" defaultValue={String(s.rate)} onBlur={(e) => void setC({ rate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={inputCls} />
            </label>
            <label className="block">
              <span className="t-meta text-slate-500">착수금 (원)</span>
              <input aria-label="착수금" inputMode="numeric" defaultValue={String(s.retainer)} onBlur={(e) => void setC({ retainer: Math.max(0, Number(e.target.value.replace(/[^\d]/g, '')) || 0) })} className={inputCls} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {toggles.map((t) => (
              <button
                key={t.k}
                type="button"
                aria-pressed={t.on}
                data-testid={`emp-comm-${t.k}`}
                onClick={() => {
                  const nv = !t.on
                  const next = { ...comm, [t.k]: nv }
                  if (t.type && nv) void patch({ commission: next, notes: [{ id: uid(), text: t.k === 'billed' ? `수수료 청구 완료 (${fMan(s.billable)})` : `수수료 입금 완료 (${fMan(s.billable)})`, at: new Date().toISOString(), type: t.type }, ...meta.notes] })
                  else void patch({ commission: next })
                  showToast(`${t.label}${nv ? ' 처리됨' : ' 해제됨'}`)
                }}
                className="tap t-sub rounded-[10px] border-[1.5px] px-3 py-2.5 text-left font-bold"
                style={{ borderColor: t.on ? '#6EE7B7' : '#E2E8F0', background: t.on ? '#ECFDF5' : '#fff', color: t.on ? '#047857' : '#64748B' }}
              >
                {t.on ? '✅ ' : '⬜ '}
                {t.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="t-meta text-slate-500">수수료 메모</span>
            <textarea aria-label="수수료 메모" rows={2} defaultValue={comm.memo ?? ''} onBlur={(e) => void setC({ memo: e.target.value })} placeholder="계약 조건·청구 일정·특이사항 등" className={inputCls} />
          </label>
        </Surface>
      </Section>
      <Section
        title={`👤 직원별 수수료 (${s.rate}%)`}
        action={
          <Button size="sm" onClick={statement} data-testid="emp-comm-statement">
            <Download aria-hidden="true" className="size-4" /> 수수료 정산서
          </Button>
        }
      >
        {s.perEmployee.length === 0 ? (
          <p className="t-sub text-slate-500">아직 수령 완료된 직원이 없습니다. 회차 지급이 확정되면 수수료가 자동 집계됩니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {s.perEmployee.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-[9px] border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <span>
                  <b className="t-body">{r.name}</b> <span className="t-meta text-slate-400">{programs.find((p) => p.id === r.programId)?.name ?? ''}</span>
                </span>
                <span className="text-right">
                  <span className="t-meta block text-slate-500">수령 {fMan(r.received)}</span>
                  <span className="t-body font-extrabold text-emerald-600">수수료 {fMan(r.fee)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업무 일지                                                            */
/* ------------------------------------------------------------------ */

export function NotesTab({ meta, patch }: TabProps) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [type, setType] = useState('전화')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    void patch({ notes: [{ id: uid(), text: t, at: new Date().toISOString(), type }, ...meta.notes] })
    setText('')
    showToast('업무 일지가 기록되었습니다.')
  }
  return (
    <div className="flex flex-col gap-3" data-testid="emp-tab-notes">
      <div className="flex flex-wrap gap-1.5">
        {NOTE_TYPES.map((t) => (
          <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={`tap t-meta rounded-lg border px-3 py-1.5 ${type === t.id ? 'border-brand-600 bg-brand-600 font-bold text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            {t.icon} {t.id}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea
          aria-label="업무 일지"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add()
          }}
          placeholder="진행 상황·통화 내용·제출 기록·특이사항 등을 남겨보세요 (Ctrl+Enter 로 기록)"
          className={inputCls}
        />
        <Button variant="primary" onClick={add} data-testid="emp-note-add">
          기록
        </Button>
      </div>
      {meta.notes.length === 0 ? (
        <p className="t-sub text-slate-500">🗒️ 아직 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="emp-notes">
          {meta.notes.map((n) => {
            const t = noteTypeMeta(n.type)
            return (
              <li key={n.id} className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
                <div className="t-meta flex flex-wrap items-center gap-2 text-slate-500">
                  <span className="font-bold text-slate-700">
                    {t.icon} {t.id}
                  </span>
                  <span>{new Date(n.at).toLocaleString('ko-KR')}</span>
                  {n.editedAt && <span>(수정됨)</span>}
                  <span className="ml-auto flex gap-2">
                    <button type="button" className="hover:text-brand-700" onClick={() => { setEditId(n.id); setEditText(n.text) }}>
                      편집
                    </button>
                    <button type="button" className="hover:text-danger-700" onClick={() => void patch({ notes: meta.notes.filter((x) => x.id !== n.id) })}>
                      삭제
                    </button>
                  </span>
                </div>
                {editId === n.id ? (
                  <div className="mt-1 flex gap-2">
                    <textarea aria-label="일지 고치기" rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} className={inputCls} />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!editText.trim()) return
                        void patch({ notes: meta.notes.map((x) => (x.id === n.id ? { ...x, text: editText.trim(), editedAt: new Date().toISOString() } : x)) })
                        setEditId(null)
                      }}
                    >
                      저장
                    </Button>
                  </div>
                ) : (
                  <p className="t-sub mt-1 break-keep whitespace-pre-wrap text-slate-700">{n.text}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 기관 보고서                                                           */
/* ------------------------------------------------------------------ */

export function AgencyReportTab({ client, meta, employees, programs, today }: TabProps) {
  const rd = useMemo(() => agencyReportData(client.companyName, meta, employees, (id) => programs.find((p) => p.id === id)?.name ?? '(지원금 미지정)', today), [client.companyName, meta, employees, programs, today])
  const [comment, setComment] = useState<string | null>(null)
  const auto = agencyAutoComment(rd)
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
  const kpi: Array<[string, string, string, string?]> = [
    ['예상 총 수령액', fMan(rd.totalExp), '#2563EB'],
    ['이미 수령한 금액', fMan(rd.totalRcv), '#059669'],
    ['앞으로 받을 잔여', fMan(rd.totalExp - rd.totalRcv), '#2563EB'],
    ['신청 지연·위험', `${rd.riskCount}건`, rd.riskCount > 0 ? '#DC2626' : '#059669', rd.riskCount > 0 ? '#FEF2F2' : undefined],
    ['미제출 서류', `${rd.missingDocsCount}건`, rd.missingDocsCount > 0 ? '#D97706' : '#059669', rd.missingDocsCount > 0 ? '#FFFBEB' : undefined],
    [`예상 컨설팅 수수료${rd.rate > 0 ? ` (${rd.rate}%)` : ''}`, rd.rate > 0 ? fMan(rd.estFee) : '-', '#334155'],
  ]
  let sno = 0
  const sh = (t: string) => {
    sno += 1
    return (
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-[0.8rem] font-bold text-white">{sno}</span>
        <span className="t-card font-bold text-slate-900">{t}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3" data-testid="emp-tab-agency">
      <div className="flex flex-wrap gap-2">
        <CopyBtn text={agencySummaryText(rd)} label="대표님 요약 문구 복사" />
        <CopyBtn text={agencyDocRequestText(rd)} label="서류 요청 문구 복사" />
        <Button size="sm" variant="primary" onClick={() => window.print()}>
          <Printer aria-hidden="true" className="size-4" /> 인쇄 · PDF
        </Button>
      </div>
      <div id="visitReport" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" data-testid="emp-agency-report">
        <div className="mb-4 border-b-[3px] border-[#2563EB] pb-3">
          <p className="t-meta font-bold tracking-wide text-[#2563EB]">고용지원금 진행 현황 보고서</p>
          <h2 className="text-[1.35rem] font-black text-slate-900">{client.companyName}</h2>
          <p className="t-meta text-slate-500">작성일 {dateStr}</p>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {kpi.map(([l, v, c, bg]) => (
            <div key={l} className="rounded-lg border border-slate-200 px-3 py-2.5" style={{ background: bg ?? '#F8FAFC' }}>
              <div className="t-meta text-slate-500">{l}</div>
              <div className="t-card font-black" style={{ color: c }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <p className="t-sub mb-4 break-keep text-slate-700">
          현재 <b>{client.companyName}</b>은(는) 총 <b>{rd.emps.length}명</b>의 근로자에 대해 고용지원금 검토 및 관리를 진행 중입니다. 현재까지 수령 완료된 금액은 <b className="text-emerald-600">{fMan(rd.totalRcv)}</b>이며, 향후 예상 수령액은 <b className="text-[#2563EB]">{fMan(rd.totalExp - rd.totalRcv)}</b>입니다 (진행률 {rd.pct}%).
        </p>
        <div className="mb-4 flex h-6 overflow-hidden rounded-md">
          {EMP_STAGES.map((s) => {
            const cnt = rd.sc[s.key] ?? 0
            if (!cnt || !rd.emps.length) return null
            const w = Math.round((cnt / rd.emps.length) * 100)
            const col = { preparing: '#64748B', submitted: '#2563EB', reviewing: '#475569', approved: '#059669', inprogress: '#2563EB', completed: '#059669', resigned: '#94A3B8' }[s.key]
            return (
              <div key={s.key} className="flex items-center justify-center text-[0.7rem] font-bold text-white" style={{ width: `${w}%`, background: col }} title={`${s.label} ${cnt}명`}>
                {w > 9 ? `${cnt}명` : ''}
              </div>
            )
          })}
        </div>
        {rd.riskItems.length > 0 && (
          <div className="mb-4">
            {sh('놓치면 손해 보는 항목')}
            <ul className="flex flex-col gap-1">
              {rd.riskItems.slice(0, 16).map((it, i) => (
                <li key={i} className="t-sub flex flex-wrap gap-2 rounded bg-rose-50 px-2.5 py-1.5">
                  <b>{it.empName}</b>
                  <span className="t-meta text-slate-500">{it.prog}</span>
                  <span className="text-danger-700">{it.problem}</span>
                  {it.impact > 0 && <span className="t-meta font-bold">{fMan(it.impact)}</span>}
                  <span className="t-meta text-slate-600">→ {it.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rd.overdue.length > 0 && (
          <div className="mb-4">
            {sh('지연된 신청')}
            <ul className="t-sub flex flex-col gap-1">
              {rd.overdue.slice(0, 12).map((o, i) => (
                <li key={i}>
                  <b>{o.empName}</b> · {o.prog} · {o.roundLabel} · {fD(o.eligDate)} <span className="font-bold text-danger-700">{Math.abs(o.dday)}일 지연</span> · {fMan(o.amount)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {rd.upcoming.length > 0 && (
          <div className="mb-4">
            {sh('다가오는 신청 (90일)')}
            <ul className="t-sub flex flex-col gap-1">
              {rd.upcoming.slice(0, 12).map((u, i) => (
                <li key={i}>
                  <b>{u.empName}</b> · {u.prog} · {u.roundLabel} · {fD(u.eligDate)}{' '}
                  <span className={`rounded-full px-2 font-bold ${u.dday <= 7 ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{u.dday === 0 ? 'D-Day' : `D-${u.dday}`}</span> · {fMan(u.amount)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mb-4">
          {sh('30일 액션 플랜')}
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['이번 주', rd.planWeek],
                ['이번 달', rd.planMonth],
                ['다음 달', rd.planNext],
              ] as const
            ).map(([t, arr]) => (
              <div key={t} className="rounded-lg bg-slate-50 p-3">
                <div className="t-sub mb-1 font-bold">{t}</div>
                {arr.length === 0 ? (
                  <p className="t-meta text-slate-400">예정된 작업이 없습니다.</p>
                ) : (
                  <ul className="t-meta list-disc pl-4 text-slate-700">
                    {arr.slice(0, 7).map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
        {rd.progList.length > 0 && (
          <div className="mb-4">
            {sh('지원금별 진행 현황')}
            <ul className="t-sub flex flex-col gap-1">
              {rd.progList.map((b) => (
                <li key={b.name} className="flex flex-wrap gap-2">
                  <b>{b.name}</b> {b.count}명 · 예상 <span className="font-bold text-[#2563EB]">{fMan(b.expected)}</span> · 수령 <span className="font-bold text-emerald-600">{fMan(b.received)}</span> · 잔여 {fMan(b.remaining)}
                  {b.delay > 0 && <span className="text-danger-700">· 지연 {b.delay}</span>}
                  {b.missingDocs > 0 && <span className="text-amber-700">· 서류 {b.missingDocs}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {rd.missingDocsCount > 0 && (
          <div className="mb-4">
            {sh('미제출 서류')}
            <ul className="t-sub flex flex-col gap-1">
              {rd.companyMissingDocs.length > 0 && (
                <li>
                  <b>업체 서류</b> — {rd.companyMissingDocs.join(', ')}
                </li>
              )}
              {rd.docItems.map((it) => (
                <li key={it.empName}>
                  <b>{it.empName}</b> <span className="t-meta text-slate-500">{it.prog}</span> — {it.docs.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          {sh('담당자 코멘트')}
          <textarea aria-label="담당자 코멘트" rows={4} value={comment ?? auto} onChange={(e) => setComment(e.target.value)} className={`${inputCls} t-sub`} />
        </div>
        <p className="t-meta mt-4 text-slate-400">
          대상자 상태: {EMP_STAGES.filter((s) => rd.sc[s.key]).map((s) => `${EMP_STAGE_LABEL[s.key]} ${rd.sc[s.key]}명`).join(' · ') || '없음'} · 규칙표 기준 1차 검토이며 운영기관 심사 결과에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  )
}
