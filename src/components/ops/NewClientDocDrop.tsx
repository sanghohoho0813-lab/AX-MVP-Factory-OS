/**
 * 새 업체 등록 창 — 서류 넣는 곳 (D-187).
 *
 * 사업자등록증 · 크레탑 보고서 · 등기부등본을 넣으면 하나씩 읽어(PDF 글자 · 사진 OCR · 글자 파일)
 * 업체명 · 대표자 · 사업자등록번호를 찾는다. 찾을 때마다 부르는 쪽에 알려 칸을 채운다.
 * 등록하면 부르는 쪽이 같은 파일(읽은 글자째)을 업체 상세 '서류 올리기' 로 넘긴다 — 서류함에 넣고 분석까지.
 *
 * 규칙 계산 — 외부 호출 없음. 사진 · 스캔은 처음 한 번 한글 인식 준비가 걸린다.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, FileUp, Loader2, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { DROP_FILE_LIMIT, filesFromDrop } from '../../lib/dropFiles'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { isSystemFile } from '../../services/docShelf'
import type { ReadMethod } from '../../services/docAutoFill'
import { archiveOf, archiveSummary, expandArchives } from '../../services/docArchive'
import {
  NEW_CLIENT_FIELD_LABEL,
  guessNewClientFromDocs,
  looksLikeCretopForNewClient,
  type CretopCompanyLite,
  type NewClientDocsRead,
  type NewClientGuess,
} from '../../services/newClientFromDocs'

/** 한 창에서 받는 파일 수 — 등록 창은 기본 서류 몇 개를 넣는 곳(더 많으면 업체 상세에서) */
const MAX_FILES = 20

interface Item {
  id: string
  file: File
  status: 'queued' | 'reading' | 'done'
  progress: string
  text: string
  method: ReadMethod
}

/** title · hint — 부르는 곳마다 다른 안내(D-255 AI 전략실은 서류함이 아니라 '자료' 로 들어간다) */
export function NewClientDocDrop({ onChange, title = '서류만 넣어도 칸이 채워집니다', hint = '사업자등록증 · 크레탑 보고서 · 등기부등본 — PDF · 사진 · 한글 · 워드 · 압축(zip) 그대로 · 등록하면 서류함에도 들어갑니다' }: { onChange: (read: NewClientDocsRead) => void; title?: string; hint?: string }) {
  const { showToast } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [cretop, setCretop] = useState<CretopCompanyLite[]>([])
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  /** 창을 닫으면(등록 · 취소) 남은 파일은 읽지 않는다 — 등록이면 넘겨받은 업체 상세가 마저 읽는다 */
  const stoppedRef = useRef(false)
  const runningRef = useRef(false)
  const itemsRef = useRef<Item[]>([])
  itemsRef.current = items
  useEffect(() => {
    stoppedRef.current = false
    return () => {
      stoppedRef.current = true
    }
  }, [])

  // 읽을 때마다 부르는 쪽에 알린다 — 사업자등록증을 읽자마자 칸이 채워진다
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  /** 찾은 값이 그대로면 같은 것을 넘긴다 — 읽는 중 진행률이 바뀔 때마다 칸을 다시 채우지 않게 */
  const lastGuess = useRef<{ key: string; guess: NewClientGuess }>({ key: '{}', guess: {} })
  useEffect(() => {
    const done = items.filter((it) => it.status === 'done')
    const found = guessNewClientFromDocs(
      done.map((it) => ({ fileName: it.file.name, text: it.text, method: it.method })),
      cretop.filter((c) => done.some((it) => it.file.name === c.fileName)),
    )
    const key = JSON.stringify(found.guess)
    if (key !== lastGuess.current.key) lastGuess.current = { key, guess: found.guess }
    const { guess } = lastGuess.current
    const { files } = found
    onChangeRef.current({
      docs: items.map((it) => (it.status === 'done' ? { file: it.file, text: it.text, method: it.method } : { file: it.file })),
      guess,
      files,
      reading: items.some((it) => it.status !== 'done'),
    })
  }, [items, cretop])

  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)))

  /** 줄 선 파일을 하나씩 읽는다 — 동시에 여러 OCR 을 돌리면 휴대폰이 멈춘다 */
  const drain = async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      for (;;) {
        if (stoppedRef.current) return
        const next = itemsRef.current.find((it) => it.status === 'queued')
        if (!next) return
        patch(next.id, { status: 'reading', progress: '읽는 중' })
        let text = ''
        let method: ReadMethod = 'none'
        try {
          if (canExtractText(next.file)) {
            const res = await extractTextFromFile(next.file, (ratio, label) => patch(next.id, { progress: ratio > 0 && ratio < 1 ? `${label} ${Math.round(ratio * 100)}%` : label }))
            text = res.text
            method = res.method
          }
        } catch {
          // 못 읽어도 멈추지 않는다 — 등록하면 서류함에는 그대로 들어간다
          text = ''
        }
        if (stoppedRef.current) return
        // 크레탑 보고서면 크레탑 엔진으로 회사 칸을 읽는다(무거워서 필요할 때만 불러온다)
        if (looksLikeCretopForNewClient({ fileName: next.file.name, text, method })) {
          try {
            const [{ analyzeCretopText }, sc] = await Promise.all([import('../../tools/cretop/mini/analysisCore.js'), import('../../services/salesCretop')])
            const co = sc.cretopCompany(analyzeCretopText(text))
            if (!stoppedRef.current) setCretop((list) => [...list.filter((c) => c.fileName !== next.file.name), { fileName: next.file.name, method, name: co.name, bizNo: co.bizNo, ceo: co.ceo }])
          } catch {
            // 크레탑으로 못 읽어도 서류함에는 들어간다
          }
        }
        // 읽는 사이 [빼기] 를 눌렀으면 그 줄은 이미 없다 — patch 가 아무것도 바꾸지 않는다
        itemsRef.current = itemsRef.current.map((it) => (it.id === next.id ? { ...it, status: 'done', progress: '', text, method } : it))
        patch(next.id, { status: 'done', progress: '', text, method })
      }
    } finally {
      runningRef.current = false
    }
  }

  const addFiles = async (list: File[]) => {
    const kept = list.filter((f) => f.size > 0 && !isSystemFile(f))
    const skipped = list.length - kept.length
    if (skipped > 0) showToast(`서류가 아닌 컴퓨터 파일 ${skipped}개(빈 파일 · Thumbs.db 같은 것)는 뺐습니다.`)
    // D-266 압축(.zip)은 풀어 안의 서류를 하나씩(사업자등록증 · 등기부등본이 압축 안에 있어도 칸이 채워진다)
    const { files: picked, notes: zipNotes } = await expandArchives(kept, MAX_FILES * 3)
    const archived = archiveSummary(zipNotes)
    if (archived) showToast(archived)
    if (stoppedRef.current) return
    const room = MAX_FILES - itemsRef.current.length
    if (picked.length > room) showToast(`등록 창에서는 ${MAX_FILES}개까지 받아요 — 나머지는 업체를 연 뒤 [서류 올리기] 로 넣어 주세요.`)
    const fresh: Item[] = picked.slice(0, Math.max(0, room)).map((file) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      status: 'queued',
      progress: '',
      text: '',
      method: 'none',
    }))
    if (fresh.length === 0) return
    itemsRef.current = [...itemsRef.current, ...fresh]
    setItems((cur) => [...cur, ...fresh])
    void drain()
  }

  const remove = (id: string) => {
    const gone = itemsRef.current.find((it) => it.id === id)
    itemsRef.current = itemsRef.current.filter((it) => it.id !== id)
    setItems((cur) => cur.filter((it) => it.id !== id))
    if (gone) setCretop((list) => list.filter((c) => c.fileName !== gone.file.name))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    void filesFromDrop(e.dataTransfer).then(({ files, folders, capped }) => {
      if (folders > 0) showToast(`폴더 ${folders}개에서 파일 ${files.length}개를 찾았습니다${capped ? ` — 한 번에 ${DROP_FILE_LIMIT}개까지만 읽어요` : ''}.`)
      return addFiles(files)
    })
  }

  const notes = guessNewClientFromDocs(
    items.filter((it) => it.status === 'done').map((it) => ({ fileName: it.file.name, text: it.text, method: it.method })),
    cretop,
  ).files

  return (
    <div
      data-testid="new-client-docs"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`rounded-(--radius-panel) border-2 border-dashed px-4 py-3 ${over ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50/60'}`}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-label="등록할 업체 서류 고르기"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <FileUp aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="text-[0.98rem] font-bold break-keep text-slate-900">{title}</p>
            <p className="t-meta break-keep text-slate-600">{hint}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={() => fileRef.current?.click()} data-testid="new-client-docs-pick">
          <FileUp aria-hidden="true" className="size-4" />
          서류 넣기
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="new-client-docs-list">
          {items.map((it) => {
            const note = notes.find((n) => n.fileName === it.file.name)
            const found = note?.found ?? []
            return (
              <li key={it.id} className="flex min-w-0 items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
                {it.status === 'done' ? (
                  <Check aria-hidden="true" className={`size-4 shrink-0 ${found.length ? 'text-success-600' : 'text-slate-400'}`} />
                ) : (
                  <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-brand-600" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.92rem] font-semibold text-slate-800">{it.file.name}</span>
                  {archiveOf(it.file) && <span className="t-meta block truncate text-slate-500">{archiveOf(it.file)} 안에서 꺼냄</span>}
                  <span className="t-meta block break-keep text-slate-600" data-testid="new-client-doc-note">
                    {it.status !== 'done'
                      ? it.progress || '차례를 기다리는 중'
                      : found.length > 0
                        ? `${note?.docLabel ? `${note.docLabel} — ` : ''}${found.map((f) => NEW_CLIENT_FIELD_LABEL[f]).join(' · ')} 찾음`
                        : note?.docLabel
                          ? `${note.docLabel} — 등록하면 서류함에 넣어요`
                          : '등록하면 서류함에 넣어요(칸은 제목으로 정해요)'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  aria-label={`${it.file.name} 빼기`}
                  className="tap inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
