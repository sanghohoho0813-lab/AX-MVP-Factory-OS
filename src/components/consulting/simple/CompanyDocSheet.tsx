/**
 * 서류에서 회사 정보 읽기 — 사업자등록증·법인등기부등본.
 *
 * 일곱 칸을 손으로 적는 대신 서류를 올린다. 두 장을 함께 올려도 되고, 한 장만 올려도 된다.
 * 두 장을 올리면 항목마다 더 믿을 만한 쪽을 골라 쓴다(`companyDocFacts`).
 *
 * 읽은 값을 바로 덮어쓰지 않는다. 목록으로 보여 주고 체크한 것만 채운다(§44).
 * 비어 있던 칸은 처음부터 체크돼 있고, 이미 값이 있는 칸은 꺼 둔 채 기존 값을 함께 보여 준다.
 */

import { useRef, useState } from 'react'
import { AlertTriangle, FileUp, Loader2 } from 'lucide-react'
import { parseKoreanBusinessDocument, type ParsedCompanyInfo } from '../../../services/koreanDocParser'
import { extractTextFromFile } from '../../../services/docTextExtract'
import { factDef } from '../../../domain/consulting/factsheetSchema'
import { documentsSummary, factsFromDocuments, type DocFactRead } from '../../../domain/consulting/companyDocFacts'
import type { ConsultingProject } from '../../../types/consulting'
import { BottomSheet } from '../../ui/primitives'
import { Button } from '../../ui/Button'

/** 한 번에 받아 읽는 서류 수 — 사업자등록증 + 법인등기부등본 */
const MAX_FILES = 2

export function CompanyDocSheet({
  project,
  busy,
  onApply,
  onClose,
}: {
  project: ConsultingProject
  busy: boolean
  onApply: (facts: DocFactRead[]) => void
  onClose: () => void
}) {
  const [reading, setReading] = useState('')
  const [error, setError] = useState('')
  const [reads, setReads] = useState<DocFactRead[]>([])
  const [docLabel, setDocLabel] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const current = (key: DocFactRead['key']) => project.factsheet[key]?.value?.trim() ?? ''

  const show = (docs: ParsedCompanyInfo[]) => {
    const got = factsFromDocuments(docs)
    setReads(got)
    setDocLabel(documentsSummary(docs))
    // 비어 있던 칸만 미리 켠다 — 이미 적어 둔 값을 소리 없이 덮지 않기 위해서다
    setChecked(Object.fromEntries(got.map((f) => [f.key, current(f.key) === ''])))
    if (got.length === 0) setPasteOpen(true)
  }

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, MAX_FILES)
    if (files.length === 0) return
    setError('')
    setReads([])
    try {
      const docs: ParsedCompanyInfo[] = []
      for (const [i, file] of files.entries()) {
        setReading(files.length > 1 ? `${i + 1}/${files.length} · ${file.name}` : file.name)
        const res = await extractTextFromFile(file, (ratio, label) => {
          setReading(`${file.name} · ${label}${ratio > 0 ? ` ${Math.round(ratio * 100)}%` : ''}`)
        })
        docs.push(parseKoreanBusinessDocument(res.text))
      }
      show(docs)
    } catch (cause) {
      setError(cause instanceof Error ? `파일을 읽지 못했습니다: ${cause.message}` : '파일을 읽지 못했습니다.')
      setPasteOpen(true)
    } finally {
      setReading('')
    }
  }

  const picked = reads.filter((f) => checked[f.key])

  return (
    <BottomSheet
      title="서류에서 회사 정보 읽기"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={busy || picked.length === 0} onClick={() => onApply(picked)}>
            {busy ? '채우는 중…' : `${picked.length}개 채우기`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/*
          여기만 PDF·사진으로 제한한다. 보관이 아니라 "글자를 읽어 칸을 채우는" 기능이라
          판독기가 다루지 못하는 형식은 골라도 소용이 없다.
        */}
        <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="sr-only" onChange={(e) => void onFiles(e.target.files)} />
        <button
          type="button"
          disabled={reading !== ''}
          onClick={() => fileRef.current?.click()}
          className="tap flex w-full flex-col items-center gap-2 rounded-(--radius-panel) border-2 border-dashed border-slate-300 px-5 py-7 text-center hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60"
        >
          {reading ? <Loader2 aria-hidden="true" className="size-7 animate-spin text-brand-600" /> : <FileUp aria-hidden="true" className="size-7 text-brand-500" />}
          <span className="t-card break-keep text-slate-800">{reading ? '읽는 중…' : '사업자등록증 · 법인등기부등본'}</span>
          <span className="t-sub break-keep text-slate-500">
            {reading || '두 장을 한꺼번에 골라도 됩니다. 인터넷등기소·홈택스 PDF 는 거의 그대로 읽고, 사진은 글자 인식을 씁니다.'}
          </span>
        </button>

        {error && (
          <p role="alert" className="t-sub flex items-start gap-1.5 rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2.5 break-keep text-danger-700">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        {reads.length > 0 && (
          <div>
            <p className="t-sub font-semibold text-slate-700">
              {docLabel}에서 {reads.length}개를 읽었습니다
            </p>
            <p className="t-meta mt-0.5 text-slate-500">채울 것만 체크하세요.</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {reads.map((f) => {
                const now = current(f.key)
                const overwrites = now !== '' && now !== f.value
                return (
                  <li key={f.key}>
                    <label className="flex items-start gap-2.5 rounded-(--radius-card) border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked[f.key] ?? false}
                        onChange={(e) => setChecked((s) => ({ ...s, [f.key]: e.target.checked }))}
                        className="mt-0.5 size-5 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="t-sub block text-slate-500">{factDef(f.key).label}</span>
                        <span className="t-body block font-semibold break-keep text-slate-900">{f.value}</span>
                        {overwrites && <span className="t-sub mt-0.5 block break-keep text-warning-800">지금 적힌 「{now}」을(를) 바꿉니다</span>}
                        {f.status === 'unverified' && <span className="t-meta mt-0.5 block break-keep text-slate-500">서류의 종목에서 옮긴 값입니다 — 맞는지 봐 주세요</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* 사진이 흐리거나 기울면 못 읽는다. 그때만 나오는 마지막 수단 */}
        {pasteOpen && (
          <div className="rounded-(--radius-card) border border-slate-200 px-3 py-3">
            <p className="t-sub break-keep text-slate-600">
              {reads.length === 0 ? '읽을 수 있는 항목을 찾지 못했습니다. ' : ''}
              서류의 글자를 복사해 붙여 넣어도 됩니다.
            </p>
            <textarea
              aria-label="서류 글자 붙여넣기"
              value={pasted}
              rows={5}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'예) 등록번호 : 214-88-01234\n     상호 : 주식회사 대한정밀'}
              className="t-sub mt-2 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2 font-mono"
            />
            <Button className="mt-2" disabled={pasted.trim() === ''} onClick={() => show([parseKoreanBusinessDocument(pasted)])}>
              글자에서 읽기
            </Button>
          </div>
        )}
        {!pasteOpen && reads.length === 0 && (
          <button type="button" onClick={() => setPasteOpen(true)} className="t-sub self-start text-slate-500 hover:text-slate-800">
            서류 대신 글자를 붙여 넣기
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
