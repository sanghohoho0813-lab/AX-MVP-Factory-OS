/**
 * D-582 여러 업체 한 번에 등록 — 엑셀에서 복사해 붙여넣기 → 미리 보기 → [n곳 등록].
 *
 * 📐 한 화면에 한 가지: 처음에는 붙여넣는 칸 하나만. 붙여넣으면 그 아래에 '이렇게 읽었어요' 가 펼쳐진다.
 *  - 칸은 알아서 찾고(clientBulkPaste), 틀리면 칸마다 고르개로 바꾼다.
 *  - 이미 있는 업체 · 목록 안에서 겹치는 줄은 건너뛴다(무엇을 건너뛰는지 펼쳐 볼 수 있다).
 *  - 등록은 있는 저장 길(createClient) 그대로 한 곳씩 — 중간에 끊기면 등록된 곳까지 남고, 다시 누르면 남은 곳만.
 *  - D-585 복사가 어려우면 [엑셀 파일 고르기] — 파일을 브라우저 안에서 읽어 같은 칸에 넣는다(올리지 않는다).
 * 규칙으로 읽는다 — AI 가 아니다.
 */
import { useMemo, useRef, useState } from 'react'
import { ClipboardPaste, FileSpreadsheet } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { createClient } from '../../services/clientOpsService'
import { emptySales, type ClientOpsRecord } from '../../types/clientOps'
import { BULK_FILE_ACCEPT, readBulkFile } from '../../services/clientBulkFile'
import { PASTE_FIELDS, PASTE_FIELD_LABEL, bulkSummaryLine, guessColumns, planBulk, rowsFromTable, splitPaste, type PasteField } from '../../services/clientBulkPaste'

type Kind = 'contract' | 'prospect'

const KINDS: Array<{ key: Kind; label: string; hint: string }> = [
  { key: 'contract', label: '계약 고객', hint: '이미 일하고 있는 곳' },
  { key: 'prospect', label: '잠재고객', hint: '아직 계약 전 — 영업 보드로' },
]

const EXAMPLE = '한솔테크(주)\t김한솔\t010-1234-5678\t123-45-67890\n다움에너지\t이다움\t02-123-4567\t'

export function BulkClientPasteSheet({
  open,
  records,
  workspaceId,
  onClose,
  onPartial,
  onDone,
}: {
  open: boolean
  records: ClientOpsRecord[]
  workspaceId: string | null
  onClose: () => void
  /** 중간에 멈췄을 때 — 등록된 곳까지 목록을 다시 읽는다 */
  onPartial: () => void
  onDone: (count: number, kind: Kind) => void
}) {
  const [text, setText] = useState('')
  // 사람이 바꾼 칸 항목 · 제목 줄 여부 — 붙여넣은 표의 칸 수가 달라지면 버린다
  const [override, setOverride] = useState<{ width: number; columns: PasteField[] } | null>(null)
  const [headerPick, setHeaderPick] = useState<boolean | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  // D-585 고른 파일 — 읽은 결과 한 줄 · 못 읽은 까닭
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [fileNote, setFileNote] = useState('')
  const [fileError, setFileError] = useState('')

  const cells = useMemo(() => splitPaste(text), [text])
  const auto = useMemo(() => guessColumns(cells), [cells])
  const width = cells[0]?.length ?? 0
  const guess = useMemo(
    () => ({ header: headerPick ?? auto.header, columns: override && override.width === width ? override.columns : auto.columns }),
    [auto, override, headerPick, width],
  )
  const read = useMemo(() => rowsFromTable(cells, guess), [cells, guess])
  const plan = useMemo(() => planBulk(read.rows, records), [read, records])
  const skips = [...plan.dupes.map((d) => `${d.row.companyName} — 이미 있음${d.existing !== d.row.companyName ? `(${d.existing})` : ''}`), ...plan.repeats.map((r) => `${r.companyName} — 목록 안에서 겹침`)]
  const shown = plan.add.slice(0, 6)
  const noCompany = cells.length > 0 && !guess.columns.includes('companyName')

  const pickColumn = (i: number, f: PasteField) => {
    const next = guess.columns.map((c, j) => (j === i ? f : f !== 'skip' && c === f ? 'skip' : c))
    setOverride({ width, columns: next })
  }

  const close = () => {
    if (busy) return
    onClose()
  }

  const pickFile = async (file: File | undefined) => {
    if (!file || busy || fileBusy) return
    setFileBusy(true)
    setFileNote('')
    setFileError('')
    const res = await readBulkFile(file)
    setFileBusy(false)
    if (!res.ok) {
      setFileError(res.reason)
      return
    }
    setText(res.text)
    setOverride(null)
    setHeaderPick(null)
    setError('')
    setFileNote(res.note)
  }

  const run = async () => {
    if (busy || !kind || plan.add.length === 0) return
    setBusy(true)
    setError('')
    setProgress(0)
    let done = 0
    try {
      for (const row of plan.add) {
        await createClient(workspaceId, {
          companyName: row.companyName,
          contactName: row.contactName,
          contactPhone: row.contactPhone,
          businessNumber: row.businessNumber,
          industry: row.industry,
          ...(kind === 'prospect' ? { status: 'waiting' as const, sales: emptySales('lead') } : {}),
        })
        done++
        setProgress(done)
      }
      setText('')
      setOverride(null)
      setHeaderPick(null)
      setKind(null)
      setFileNote('')
      setFileError('')
      onDone(done, kind)
    } catch (cause) {
      const why = cause instanceof Error ? cause.message : '저장하지 못했습니다'
      setError(`${done}곳은 등록했고, '${plan.add[done]?.companyName ?? '다음 곳'}' 에서 멈췄어요 — ${why}. 다시 누르면 남은 곳만 등록합니다.`)
      onPartial()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="여러 업체 한 번에 등록"
      onClose={close}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            닫기
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || !kind || plan.add.length === 0} data-testid="bulk-paste-submit">
            {busy ? `등록하는 중 ${progress} / ${plan.add.length}` : plan.add.length > 0 ? `${plan.add.length}곳 등록` : '등록'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="bulk-paste">
        <p className="t-body break-keep text-slate-800">
          <strong className="font-bold text-slate-900">엑셀에서 고객 목록을 복사해 아래 칸에 붙여넣거나, 엑셀 파일을 그대로 고르세요.</strong> 한 줄에 한 곳 — 칸 순서는 상관없어요. 회사 이름 · 대표 · 전화 · 사업자등록번호를 알아서 찾습니다.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub flex items-center gap-1.5 font-semibold text-slate-800">
            <ClipboardPaste aria-hidden="true" className="size-4" /> 붙여넣는 칸
          </span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError('')
              setFileNote('')
            }}
            rows={cells.length > 0 ? 4 : 7}
            disabled={busy}
            placeholder={`예)\n${EXAMPLE}`}
            spellCheck={false}
            className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 font-mono text-[0.9375rem] whitespace-pre text-slate-900"
            data-testid="bulk-paste-text"
          />
        </label>
        {/* D-585 복사 · 붙여넣기가 어려우면 파일을 그대로 — 브라우저 안에서만 읽는다 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <input
            ref={fileRef}
            type="file"
            accept={BULK_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void pickFile(f)
            }}
            data-testid="bulk-paste-file-input"
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy || fileBusy} data-testid="bulk-paste-file">
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            {fileBusy ? '읽는 중…' : '엑셀 파일 고르기'}
          </Button>
          <span className="t-sub break-keep text-slate-600">복사가 어려우면 파일을 그대로 고르세요(.xlsx · .xls · .csv) — 파일은 올리지 않고 이 화면에서만 읽어요.</span>
        </div>
        {fileNote && (
          <p role="status" className="t-sub font-semibold break-keep text-slate-800" data-testid="bulk-paste-file-note">
            {fileNote}
          </p>
        )}
        {fileError && (
          <p role="alert" className="t-sub font-semibold break-keep text-danger-700" data-testid="bulk-paste-file-error">
            {fileError}
          </p>
        )}

        {cells.length > 0 && (
          <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3" aria-label="이렇게 읽었어요">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="t-body font-bold text-slate-900">이렇게 읽었어요</h3>
              <label className="t-sub flex min-h-10 cursor-pointer items-center gap-2 text-slate-800">
                <input type="checkbox" checked={guess.header} onChange={(e) => setHeaderPick(e.target.checked)} disabled={busy || cells.length < 2} className="size-4" data-testid="bulk-paste-header" />
                첫 줄은 제목 줄이에요
              </label>
            </div>
            {/* 칸마다 무엇인지 — 틀리면 고르개로 바꾼다 */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2" data-testid="bulk-paste-cols">
              {guess.columns.map((f, i) => (
                <label key={i} className="flex min-w-0 flex-col gap-1">
                  <span className="t-meta truncate text-slate-600">
                    {i + 1}번째 칸 · {cells[guess.header ? 1 : 0]?.[i] || '(빈 칸)'}
                  </span>
                  <select value={f} onChange={(e) => pickColumn(i, e.target.value as PasteField)} disabled={busy} className="min-h-10 w-full rounded-(--radius-control) border border-slate-300 bg-white px-2 text-[0.9375rem] text-slate-900" data-testid="bulk-paste-col" data-col={i}>
                    {PASTE_FIELDS.map((p) => (
                      <option key={p} value={p}>
                        {PASTE_FIELD_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {noCompany ? (
              <p role="status" className="t-sub font-semibold break-keep text-danger-700" data-testid="bulk-paste-nocompany">
                어느 칸이 회사 이름인지 찾지 못했어요 — 위 고르개에서 한 칸을 '회사 이름' 으로 골라 주세요.
              </p>
            ) : (
              <>
                <p className="t-sub font-semibold break-keep text-slate-900" role="status" data-testid="bulk-paste-summary" data-add={plan.add.length} data-dupes={plan.dupes.length} data-repeats={plan.repeats.length}>
                  {bulkSummaryLine(plan, read)}
                </p>
                {shown.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] border-collapse text-left text-[0.9375rem]" data-testid="bulk-paste-preview">
                      <thead>
                        <tr className="text-slate-600">
                          {(['companyName', 'contactName', 'contactPhone', 'businessNumber'] as const).map((f) => (
                            <th key={f} className="border-b border-slate-200 px-2 py-1.5 font-semibold">
                              {PASTE_FIELD_LABEL[f]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r) => (
                          <tr key={r.line} data-testid="bulk-paste-row">
                            <td className="border-b border-slate-100 px-2 py-1.5 font-semibold break-keep text-slate-900">{r.companyName}</td>
                            <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800">{r.contactName || '—'}</td>
                            <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap text-slate-800 tabular-nums">{r.contactPhone || '—'}</td>
                            <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap text-slate-800 tabular-nums">{r.businessNumber || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.add.length > shown.length && <p className="t-sub mt-1.5 text-slate-600">… 외 {plan.add.length - shown.length}곳</p>}
                  </div>
                )}
                {skips.length > 0 && (
                  <details className="t-sub text-slate-800" data-testid="bulk-paste-skips">
                    <summary className="min-h-10 cursor-pointer py-2 font-semibold">건너뛰는 곳 {skips.length} 보기</summary>
                    <ul className="flex flex-col gap-1 pb-1 pl-1">
                      {skips.slice(0, 30).map((s, i) => (
                        <li key={i} className="break-keep">
                          {s}
                        </li>
                      ))}
                      {skips.length > 30 && <li>… 외 {skips.length - 30}곳</li>}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
        )}

        {plan.add.length > 0 && !noCompany && (
          <fieldset>
            <legend className="t-sub font-semibold text-slate-800">이 목록은 어떤 업체인가요</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {KINDS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={kind === o.key}
                  onClick={() => setKind(o.key)}
                  disabled={busy}
                  className={`tap flex min-h-14 flex-col items-start rounded-(--radius-control) border px-3 py-2 text-left ${kind === o.key ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  data-testid="bulk-paste-kind"
                  data-value={o.key}
                >
                  <span className="text-[1rem] font-bold text-slate-900">{o.label}</span>
                  <span className="t-sub text-slate-600">{o.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-semibold break-keep text-danger-700" data-testid="bulk-paste-error">
            {error}
          </p>
        )}
        <p className="t-sub break-keep text-slate-600">등록한 뒤 업체를 눌러 사업자등록증을 올리면 주소 · 설립일 같은 나머지 칸이 채워져요.</p>
      </div>
    </Modal>
  )
}
