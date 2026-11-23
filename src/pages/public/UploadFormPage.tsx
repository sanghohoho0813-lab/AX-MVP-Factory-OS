/**
 * L-41 · D-652 서류 올리기 공개 화면 (/up/<20자리>) — 로그인 없음 · OS 로고 · 이름 없음.
 *
 * 컨설턴트가 카톡으로 보낸 주소를 업체 대표가 휴대폰으로 연다 → 서류마다 [사진 찍기 · 파일 고르기] → 그 업체 서류함으로 바로 간다
 * (서버 0031 — 서버가 정한 경로에만 넣는다 · 컨설턴트가 [이 칸에 넣기] 를 눌러야 서류함 칸이 바뀐다).
 *
 *  - 화면이 읽는 것은 업체 이름 · 받을 서류 이름 · 한 줄 안내 · 기한 · 서류마다 올린 개수뿐(파일 이름 · 다른 서류 · 작업공간 0).
 *  - 라우터 · 로그인 준비 밖에서 바로 그린다(App.tsx) — 컨설턴트 브라우저에서 열어도 그 사람 자격으로 올리지 않는다(세션 없는 연결).
 *  - 60대 기준: 글자 16px 이상 · 누르는 칸 52px · 쉬운 말 · 한 줄에 한 서류. 사진으로 찍어도 된다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, CheckCircle2 } from 'lucide-react'
import {
  OTHER_UPLOAD_LABEL,
  UPLOAD_ACCEPT,
  koDate,
  loadPublicUploadForm,
  uploadErrorText,
  uploadPublicFile,
  type PublicUploadLoad,
} from '../../services/uploadLink'

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:py-10" data-testid="up-page">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-7">{children}</div>
      <p className="mx-auto mt-3 max-w-[560px] px-1 text-[0.9375rem] break-keep text-slate-600">올린 서류는 이 주소를 보내 준 분께만 전달돼요.</p>
    </main>
  )
}

interface RowState {
  busy: boolean
  /** 이번에 올린 수 */
  added: number
  error: string
  progress: string
}

const EMPTY_ROW: RowState = { busy: false, added: 0, error: '', progress: '' }

function DocRow({
  label,
  docKey,
  sent,
  row,
  onFiles,
}: {
  label: string
  docKey: string
  sent: number
  row: RowState
  onFiles: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const total = sent + row.added
  return (
    <li className="flex flex-col gap-2 border-t border-slate-200 pt-3.5 first:border-t-0 first:pt-0" data-testid="up-doc" data-key={docKey}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold break-keep text-slate-900">{label}</span>
        {total > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 text-base font-semibold text-success-700" data-testid="up-doc-done">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            {total}개 올렸어요
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="up-file"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      <button
        type="button"
        disabled={row.busy}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex min-h-13 items-center justify-center gap-2 rounded-(--radius-control) px-4 text-lg font-bold disabled:opacity-60 ${
          total > 0 ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
        data-testid="up-pick"
      >
        <Camera aria-hidden="true" className="size-5" />
        {row.busy ? row.progress || '올리는 중…' : total > 0 ? '더 올리기' : '사진 찍기 · 파일 고르기'}
      </button>
      {row.error && (
        <p role="alert" className="text-base break-keep text-danger-700" data-testid="up-error">
          {row.error}
        </p>
      )}
    </li>
  )
}

export default function UploadFormPage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<PublicUploadLoad | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let alive = true
    void loadPublicUploadForm(slug).then((r) => {
      if (!alive) return
      setLoad(r)
      if (r.status === 'open') document.title = `${r.title} 서류 올리기`
    })
    return () => {
      alive = false
    }
  }, [slug, tries])

  const patch = (key: string, p: Partial<RowState>) => setRows((cur) => ({ ...cur, [key]: { ...EMPTY_ROW, ...cur[key], ...p } }))

  const send = async (key: string, files: File[]) => {
    patch(key, { busy: true, error: '', progress: '' })
    const problems: string[] = []
    for (let i = 0; i < files.length; i += 1) {
      if (files.length > 1) patch(key, { progress: `올리는 중… ${i + 1}/${files.length}` })
      try {
        const r = await uploadPublicFile(slug, key, files[i])
        if (r === 'closed') {
          setLoad({ status: 'closed' })
          return
        }
        setRows((cur) => ({ ...cur, [key]: { ...EMPTY_ROW, ...cur[key], added: (cur[key]?.added ?? 0) + 1 } }))
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : uploadErrorText(cause)
        problems.push(files.length > 1 ? `${files[i].name}: ${msg}` : msg)
      }
    }
    patch(key, { busy: false, progress: '', error: problems.slice(0, 3).join(' · ') })
  }

  if (!load) {
    return (
      <Shell>
        <p role="status" className="text-base text-slate-700" data-testid="up-loading">
          서류 올리기 화면을 여는 중…
        </p>
      </Shell>
    )
  }
  if (load.status === 'closed') {
    return (
      <Shell>
        <h1 className="text-xl font-bold break-keep text-slate-900" data-testid="up-closed">
          이 주소는 지금 서류를 받지 않아요
        </h1>
        <p className="text-base break-keep text-slate-700">기한이 지났거나 닫힌 주소예요. 주소를 보내 준 분께 새 주소를 물어봐 주세요.</p>
      </Shell>
    )
  }
  if (load.status === 'error') {
    return (
      <Shell>
        <h1 className="text-xl font-bold break-keep text-slate-900" data-testid="up-error-page">
          잠깐 연결이 안 됐어요
        </h1>
        <button type="button" onClick={() => setTries((n) => n + 1)} className="tap min-h-12 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-base font-semibold text-slate-800 hover:bg-slate-50">
          다시 열기
        </button>
      </Shell>
    )
  }

  const until = koDate(load.expiresAt)
  const docs = [...load.docs, { key: '', label: load.docs.length ? OTHER_UPLOAD_LABEL : '올릴 서류' }]
  const anyDone = docs.some((d) => (load.sent[d.key] ?? 0) + (rows[d.key]?.added ?? 0) > 0)

  return (
    <Shell>
      <header className="flex flex-col gap-1.5">
        <p className="text-base font-semibold text-slate-600">서류 올리기</p>
        <h1 className="text-xl font-bold break-keep text-slate-900 sm:text-2xl" data-testid="up-title">
          {load.title}
        </h1>
        {load.note && (
          <p className="text-base break-keep text-slate-800" data-testid="up-note">
            {load.note}
          </p>
        )}
        <p className="text-base break-keep text-slate-700">
          서류마다 아래 단추를 눌러 사진을 찍거나 파일을 고르세요.{until ? ` ${until}까지 열려 있어요.` : ''}
        </p>
      </header>
      <ul className="flex flex-col gap-3.5" data-testid="up-docs">
        {docs.map((d) => (
          <DocRow key={d.key || 'other'} label={d.label} docKey={d.key} sent={load.sent[d.key] ?? 0} row={rows[d.key] ?? EMPTY_ROW} onFiles={(files) => void send(d.key, files)} />
        ))}
      </ul>
      {anyDone && (
        <p role="status" className="text-base break-keep text-slate-800" data-testid="up-all-done">
          다 올리셨으면 이 창을 닫으셔도 돼요. 담당자에게 바로 전달됐어요.
        </p>
      )}
    </Shell>
  )
}
