// 프로젝트 등록 — 생성 시 Stage 0~7 자동 시드(DB 트리거/목 동일)
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createProject, listCompanies, listIndustries } from '../lib/repo'
import type { Company, Industry } from '../lib/types'
import { LEVEL_LABELS } from '../lib/types'
import { Button, ErrorNote, Field, PageHeader, inputCls } from '../components/ui'

export default function ProjectNewPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [companies, setCompanies] = useState<Company[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [companyId, setCompanyId] = useState(params.get('company') ?? '')
  const [name, setName] = useState('')
  const [industryCode, setIndustryCode] = useState('')
  const [targetLevel, setTargetLevel] = useState(2)
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([listCompanies(), listIndustries()])
      .then(([c, i]) => { if (alive) { setCompanies(c.filter((x) => x.status === 'active')); setIndustries(i) } })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : '불러오지 못했습니다.'))
    return () => { alive = false }
  }, [])

  // 고객사 선택 시 그 고객사의 업종을 기본값으로
  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId), [companies, companyId])
  useEffect(() => {
    if (selectedCompany?.industry_code && !industryCode) setIndustryCode(selectedCompany.industry_code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!companyId) { setErr('고객사를 선택해 주세요.'); return }
    if (!name.trim()) { setErr('프로젝트명을 입력해 주세요.'); return }
    setBusy(true)
    try {
      const p = await createProject({
        company_id: companyId,
        name: name.trim(),
        industry_code: industryCode || null,
        target_level: targetLevel,
        summary: summary.trim() || null,
      })
      navigate(`/projects/${p.id}`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="프로젝트 만들기" desc="생성하면 Stage 0(상담 접수)부터 7단계까지 자동으로 준비됩니다." />
      {companies.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          먼저 고객사를 등록해 주세요. <Link to="/companies/new" className="font-bold text-navy-700 underline underline-offset-2">고객사 등록 →</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Field label="고객사" required>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required className={inputCls}>
              <option value="">선택하세요</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="프로젝트명" required hint="예: 수주-생산 일정 관리 MVP, 견적 자동화 시스템">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="업종" hint="고객사 업종이 기본값으로 들어갑니다">
              <select value={industryCode} onChange={(e) => setIndustryCode(e.target.value)} className={inputCls}>
                <option value="">선택 안 함</option>
                {industries.map((i) => (
                  <option key={i.code} value={i.code}>{i.parent_code ? `└ ${i.name}` : i.name}</option>
                ))}
              </select>
            </Field>
            <Field label="목표 MVP Level">
              <select value={targetLevel} onChange={(e) => setTargetLevel(Number(e.target.value))} className={inputCls}>
                {LEVEL_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="한 줄 개요">
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="이 프로젝트로 무엇을 해결하나요?" className={inputCls} />
          </Field>
          <ErrorNote msg={err} />
          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <Button type="submit" disabled={busy}>{busy ? '생성 중…' : '프로젝트 만들기'}</Button>
            <Button variant="secondary" onClick={() => navigate(-1)}>취소</Button>
          </div>
        </form>
      )}
    </div>
  )
}
