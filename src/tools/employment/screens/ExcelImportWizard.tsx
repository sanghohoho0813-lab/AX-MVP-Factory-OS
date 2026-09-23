/**
 * 엑셀로 대상자 한 번에 넣기 — 원본 ExcelImport 4단계 (D-92).
 * 1 파일 올리기 → 2 컬럼 확인(자동 매핑 · 신뢰도 · 헤더 행 바꾸기) → 3 미리보기(정상·주의·중복·제외) → 4 등록 결과.
 * 파일은 브라우저 안에서만 읽는다(서버로 보내지 않는다). 규칙은 lib/excelImport.ts.
 */

import { useRef, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { readXlsxSheets, isXlsxFile } from '../../../services/xlsxText'
import { buildRounds } from '../lib/schedule'
import type { EmpRecord } from '../lib/empRecords'
import type { ProgramView } from '../lib/usePrograms'
import { XL_FIELDS, buildImportPreview, parseCsv, templateCsv, xlAutoMap, xlDetectHeader, type Conf, type ImportClient, type ImportPreview } from '../lib/excelImport'

const CONF_LABEL: Record<Conf, [string, 'success' | 'brand' | 'warning' | 'neutral']> = {
  high: ['높음', 'success'],
  mid: ['보통', 'brand'],
  low: ['확인 필요', 'warning'],
  none: ['없음', 'neutral'],
}
const STATUS_TONE = { 정상: 'success', 주의: 'warning', '중복 의심': 'neutral', '저장 제외': 'danger' } as const

export function ExcelImportWizard({
  clients,
  programs,
  employees,
  onSave,
  fixedClientId,
  onClose,
}: {
  clients: ImportClient[]
  programs: ProgramView[]
  employees: EmpRecord[]
  onSave: (input: Omit<EmpRecord, 'id'> & { id?: string }) => Promise<EmpRecord>
  fixedClientId?: string
  onClose: () => void
}) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState(1)
  const [grid, setGrid] = useState<string[][] | null>(null)
  const [header, setHeader] = useState(0)
  const [map, setMap] = useState<Record<string, number>>({})
  const [conf, setConf] = useState<Record<string, Conf>>({})
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null)

  const fields = fixedClientId ? XL_FIELDS.filter((f) => f.key !== 'companyName' && f.key !== 'bizNo') : XL_FIELDS

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      let g: string[][]
      if (isXlsxFile(file)) {
        const sheets = await readXlsxSheets(await file.arrayBuffer())
        g = sheets[0]?.rows ?? []
      } else if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        g = parseCsv(await file.text())
      } else {
        showToast('xlsx·csv 파일만 지원합니다.')
        return
      }
      if (g.length < 2) throw new Error('데이터 행이 없습니다. 헤더 행과 데이터 행이 필요합니다.')
      const h = xlDetectHeader(g)
      const am = xlAutoMap(g[h] ?? [])
      setGrid(g)
      setHeader(h)
      setMap(am.map)
      setConf(am.conf)
      setStep(2)
    } catch (e) {
      showToast(`파일을 읽지 못했습니다: ${e instanceof Error ? e.message : '오류'}`)
    } finally {
      setBusy(false)
    }
  }

  const changeHeader = (idx: number) => {
    if (!grid) return
    const am = xlAutoMap(grid[idx] ?? [])
    setHeader(idx)
    setMap(am.map)
    setConf(am.conf)
  }

  const gotoPreview = () => {
    if (!grid) return
    const missing = fields.filter((f) => f.required && (map[f.key] == null || map[f.key] < 0))
    if (missing.length > 0) {
      showToast(`필수 필드 매핑이 필요합니다: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setPreview(
      buildImportPreview({
        grid,
        headerRow: header,
        map,
        clients,
        programs,
        existing: employees.map((e) => ({ clientId: e.clientId, name: e.name, hireDate: e.hireDate })),
        fixedClientId,
      }),
    )
    setStep(3)
  }

  const doImport = async () => {
    if (!preview) return
    setBusy(true)
    let saved = 0
    for (const r of preview.toSave) {
      const program = programs.find((p) => p.id === r.programId)
      await onSave({
        clientId: r.clientId,
        name: r.empName,
        hireDate: r.startDate,
        birthDate: r.birthDate,
        empType: '정규직',
        programId: r.programId,
        stage: r.stage,
        rounds: buildRounds(program ?? { rounds: [] }),
        docs: (program?.employeeDocs ?? []).map((n) => ({ name: n, done: false })),
        memo: [r.memo, r.status === '주의' ? `[확인 필요] ${r.messages.join(' · ')}` : ''].filter(Boolean).join('\n'),
        salary: r.salary,
      })
      saved++
    }
    setResult({ saved, skipped: preview.rows.length - saved })
    setStep(4)
    setBusy(false)
    showToast(`${saved}명을 등록했습니다.`)
  }

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '고용지원금_가져오기_샘플양식.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section title="📥 엑셀로 대상자 한 번에 넣기" action={<Badge tone="brand">{step}/4 단계</Badge>}>
      <Surface className="flex flex-col gap-3" data-testid="emp-excel-wizard">
        <ol className="t-meta flex flex-wrap gap-2 text-slate-500">
          {['파일 올리기', '컬럼 확인', '미리보기', '등록'].map((t, i) => (
            <li key={t} className={step === i + 1 ? 'font-bold text-brand-700' : ''}>
              {i + 1}. {t}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="flex flex-col gap-2">
            <p className="t-sub break-keep text-slate-600">업체·직원 목록 엑셀(xlsx·csv)을 올리면 헤더 행과 컬럼을 알아서 찾습니다. 파일은 이 브라우저 안에서만 읽고 서버로 보내지 않습니다.</p>
            {!fixedClientId && <p className="t-meta break-keep text-slate-500">업체는 사업자번호 → 업체명 순서로 고객 운영의 업체에 맞춥니다. 고객 운영에 없는 업체의 행은 저장하지 않습니다.</p>}
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" className="sr-only" aria-label="가져올 엑셀 파일" onChange={(e) => void handleFile(e.target.files?.[0])} />
              <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="emp-excel-file">
                <FileSpreadsheet aria-hidden="true" className="size-4" /> {busy ? '읽는 중…' : '파일 고르기'}
              </Button>
              <Button variant="ghost" onClick={downloadTemplate}>
                <Download aria-hidden="true" className="size-4" /> 샘플 양식
              </Button>
              <Button variant="ghost" onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        )}

        {step === 2 && grid && (
          <div className="flex flex-col gap-2">
            <label className="t-sub flex flex-wrap items-center gap-2">
              헤더 행
              <select aria-label="헤더 행" value={header} onChange={(e) => changeHeader(Number(e.target.value))} className="rounded border border-slate-300 bg-white px-2 py-1">
                {grid.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>
                    {i + 1}행 — {r.filter(Boolean).slice(0, 4).join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="emp-excel-map">
              {fields.map((f) => {
                const [cl, tone] = CONF_LABEL[conf[f.key] ?? 'none']
                return (
                  <li key={f.key} className="flex items-center gap-2 rounded bg-slate-50 px-2.5 py-1.5">
                    <span className="t-sub min-w-24 font-bold">
                      {f.label}
                      {f.required ? ' *' : ''}
                    </span>
                    <select
                      aria-label={`${f.label} 컬럼`}
                      value={map[f.key] ?? -1}
                      onChange={(e) => {
                        setMap({ ...map, [f.key]: Number(e.target.value) })
                        setConf({ ...conf, [f.key]: Number(e.target.value) >= 0 ? 'high' : 'none' })
                      }}
                      className="t-meta min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1"
                    >
                      <option value={-1}>(없음)</option>
                      {(grid[header] ?? []).map((h, i) => (
                        <option key={i} value={i}>
                          {h || `${i + 1}열`}
                        </option>
                      ))}
                    </select>
                    <Badge tone={tone}>{cl}</Badge>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-2">
              <Button variant="primary" onClick={gotoPreview} data-testid="emp-excel-preview">
                미리보기
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                파일 다시 고르기
              </Button>
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div className="flex flex-col gap-2">
            <p className="t-sub">
              저장 예정 <b className="text-emerald-700">{preview.toSave.length}명</b> ({preview.clientCount}곳) · 주의 {preview.warned} · 중복 {preview.duplicates} · 제외 {preview.excluded}
              {preview.junk ? ` · 합계·빈 행 ${preview.junk}줄 건너뜀` : ''}
            </p>
            <div className="max-h-80 overflow-auto rounded border border-slate-200">
              <table className="w-full min-w-[40rem] t-meta" data-testid="emp-excel-rows">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">행</th>
                    <th className="px-2 py-1.5">상태</th>
                    <th className="px-2 py-1.5">업체</th>
                    <th className="px-2 py-1.5">직원</th>
                    <th className="px-2 py-1.5">입사일</th>
                    <th className="px-2 py-1.5">지원금</th>
                    <th className="px-2 py-1.5">확인할 것</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.rowNo} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-1.5">{r.rowNo}</td>
                      <td className="px-2 py-1.5">
                        <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </td>
                      <td className="px-2 py-1.5">{r.companyName}</td>
                      <td className="px-2 py-1.5 font-bold">{r.empName}</td>
                      <td className="px-2 py-1.5">{r.startDate || '-'}</td>
                      <td className="px-2 py-1.5">{programs.find((p) => p.id === r.programId)?.name ?? (r.programName || '미지정')}</td>
                      <td className="px-2 py-1.5 break-keep text-slate-500">{r.messages.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void doImport()} disabled={busy || preview.toSave.length === 0} data-testid="emp-excel-save">
                {busy ? '등록 중…' : `${preview.toSave.length}명 등록`}
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)}>
                컬럼 다시 보기
              </Button>
            </div>
            <p className="t-meta break-keep text-slate-400">형식이 이상한 칸은 등록하되 메모에 '[확인 필요]' 로 남깁니다. 이미 등록된 사람·같은 파일 안 중복은 뺍니다.</p>
          </div>
        )}

        {step === 4 && result && (
          <div className="flex flex-col gap-2" data-testid="emp-excel-result">
            <p className="t-card font-bold text-emerald-700">✅ {result.saved}명을 등록했습니다.</p>
            {result.skipped > 0 && <p className="t-sub text-slate-500">{result.skipped}줄은 제외·중복이라 넣지 않았습니다.</p>}
            <Button className="w-fit" onClick={onClose}>
              닫기
            </Button>
          </div>
        )}
      </Surface>
    </Section>
  )
}
