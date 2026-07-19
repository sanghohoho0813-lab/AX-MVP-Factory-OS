// 고객사 등록·수정 (한 컴포넌트로 겸용 — :id 있으면 수정 모드)
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createCompany, getCompany, listIndustries, updateCompany } from '../lib/repo'
import type { Industry } from '../lib/types'
import { EMPLOYEE_BANDS, REVENUE_BANDS } from '../lib/types'
import { Button, ErrorNote, Field, PageHeader, inputCls } from '../components/ui'

export default function CompanyFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)

  const [industries, setIndustries] = useState<Industry[]>([])
  const [name, setName] = useState('')
  const [industryCode, setIndustryCode] = useState('')
  const [subIndustry, setSubIndustry] = useState('')
  const [employeeBand, setEmployeeBand] = useState('')
  const [revenueBand, setRevenueBand] = useState('')
  const [region, setRegion] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [memo, setMemo] = useState('')
  const [archived, setArchived] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editing)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listIndustries().then((i) => alive && setIndustries(i)).catch(() => {})
    if (id) {
      getCompany(id).then((c) => {
        if (!alive || !c) return
        setName(c.name); setIndustryCode(c.industry_code ?? ''); setSubIndustry(c.sub_industry ?? '')
        setEmployeeBand(c.employee_band ?? ''); setRevenueBand(c.revenue_band ?? ''); setRegion(c.region ?? '')
        setContactName(c.contact_name ?? ''); setContactPhone(c.contact_phone ?? ''); setContactEmail(c.contact_email ?? '')
        setMemo(c.memo ?? ''); setArchived(c.status === 'archived'); setLoaded(true)
      }).catch((e) => alive && setErr(e instanceof Error ? e.message : '불러오지 못했습니다.'))
    }
    return () => { alive = false }
  }, [id])

  // 업종: 최상위만 선택 + 전문서비스는 세부(하위) 선택 노출
  const topIndustries = useMemo(() => industries.filter((i) => !i.parent_code), [industries])
  const subOptions = useMemo(
    () => industries.filter((i) => i.parent_code && i.parent_code === (industryCode.startsWith('prof_') ? 'professional' : industryCode)),
    [industries, industryCode],
  )
  const topValue = industryCode.startsWith('prof_') ? 'professional' : industryCode

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) { setErr('회사명을 입력해 주세요.'); return }
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        industry_code: industryCode || null,
        sub_industry: subIndustry.trim() || null,
        employee_band: employeeBand || null,
        revenue_band: revenueBand || null,
        region: region.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        memo: memo.trim() || null,
        status: (archived ? 'archived' : 'active') as 'active' | 'archived',
      }
      if (id) {
        await updateCompany(id, payload)
        navigate('/companies')
      } else {
        await createCompany(payload)
        navigate('/companies')
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded && !err) return <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={editing ? '고객사 수정' : '고객사 등록'} desc={editing ? undefined : '기본 정보만 입력해도 됩니다. 상세 현황은 S2 설문에서 수집합니다.'} />
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <Field label="회사명" required>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="예: (주)한빛정밀" className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="업종">
            <select
              value={topValue}
              onChange={(e) => setIndustryCode(e.target.value)}
              className={inputCls}
            >
              <option value="">선택 안 함</option>
              {topIndustries.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
            </select>
          </Field>
          {subOptions.length > 0 ? (
            <Field label="세부 분류 (전문서비스)">
              <select value={industryCode.startsWith('prof_') ? industryCode : ''} onChange={(e) => setIndustryCode(e.target.value || 'professional')} className={inputCls}>
                <option value="">전문서비스 전체</option>
                {subOptions.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="세부 업태" hint="자유 입력 (예: 금속 가공, 식자재 유통)">
              <input value={subIndustry} onChange={(e) => setSubIndustry(e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="직원 수">
            <select value={employeeBand} onChange={(e) => setEmployeeBand(e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {EMPLOYEE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="매출 규모">
            <select value={revenueBand} onChange={(e) => setRevenueBand(e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {REVENUE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="지역">
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예: 경기 화성" className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="담당자">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예: 김대표" className={inputCls} />
          </Field>
          <Field label="연락처">
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="010-0000-0000" className={inputCls} />
          </Field>
          <Field label="이메일">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ceo@company.co.kr" className={inputCls} />
          </Field>
        </div>
        <Field label="메모">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="유입 경로, 특이사항 등" className={`${inputCls} resize-y`} />
        </Field>
        {editing && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="h-4 w-4 accent-navy-800" />
            보관 처리 (목록에서 비활성 표시)
          </label>
        )}
        <ErrorNote msg={err} />
        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" disabled={busy}>{busy ? '저장 중…' : editing ? '수정 저장' : '등록'}</Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>취소</Button>
        </div>
      </form>
    </div>
  )
}
