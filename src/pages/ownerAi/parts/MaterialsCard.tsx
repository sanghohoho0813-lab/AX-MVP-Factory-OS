/**
 * 업체 자료 — 파일(PDF · 이미지 · 글 · 엑셀) · 홈페이지 주소 · 붙여넣은 글 · 메모 · 업체 서류함에서 가져오기.
 *  - 파일은 이 기기에서 글만 읽어 둔다(주민번호 · 비밀번호 · 키 · 계좌 · 휴대폰은 지운 뒤 저장). 원본 파일은 올리지 않는다
 *    — 같은 작업공간 보관함은 팀장도 열 수 있어서, 대표 전용 자료는 글로만 둔다.
 *  - 4대보험 명부 모양이면 'AI 에 보내지 않음' 으로 둔다(개인별 원문).
 *  - 같은 자료를 두 번 넣으면 알려 준다(지문 · 파일 이름+크기 · 주소).
 */
import { useRef, useState } from 'react'
import { FileUp, Link2, Loader2, StickyNote, Type } from 'lucide-react'
import { canExtractText, extractTextFromFile } from '../../../services/docTextExtract'
import { documentFileUrl } from '../../../services/clientOpsService'
import { guessMaterialKind, makeMaterial, normalizeUrl, sameMaterial } from '../../../services/ownerAi/caseUtil'
import { MATERIAL_KIND_LABEL, type CaseMaterial, type MaterialKind } from '../../../services/ownerAi/types'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { Badge, Surface } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { fmtDateTime } from '../shared'

/** 업체 서류함에서 AI 자료로 가져올 수 있는 칸(신분증 · 명부 · 인증서 · 건강보험은 뺀다) */
const DOC_KIND: Record<string, MaterialKind> = {
  businessRegistration: 'bizreg',
  corporateRegistry: 'registry',
  cretopReport: 'company_info',
  financialStatements: 'company_info',
  smeCertificate: 'other',
}

export type AddMaterials = (list: CaseMaterial[], note: string) => Promise<void>

export function MaterialsCard({
  materials,
  client,
  busy,
  onAdd,
  onToggleExclude,
  onSummarize,
  aiReady,
  toast,
}: {
  materials: CaseMaterial[]
  client: ClientOpsRecord | null
  busy: boolean
  onAdd: AddMaterials
  onToggleExclude: (id: string, excluded: string | undefined) => Promise<void>
  onSummarize: () => void
  aiReady: boolean
  toast: (m: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'url' | 'paste' | 'memo' | 'docs'>(null)

  const addOne = async (m: CaseMaterial, note: string) => {
    const dup = sameMaterial(materials, m)
    if (dup) {
      toast(`이미 넣은 자료입니다 — ${dup.title}`)
      return
    }
    await onAdd([m], note)
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const at = new Date().toISOString()
    const added: CaseMaterial[] = []
    let dups = 0
    for (const f of Array.from(files).slice(0, 10)) {
      if (/^\.|^thumbs\.db$|^desktop\.ini$/i.test(f.name)) continue
      setReading(`${f.name} 읽는 중…`)
      let text = ''
      if (canExtractText(f)) {
        try {
          text = (await extractTextFromFile(f, (_p, label) => setReading(`${f.name} · ${label}`))).text
        } catch {
          text = ''
        }
      }
      const m = makeMaterial({ kind: /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name) && !text.trim() ? 'image' : guessMaterialKind(f.name, text), title: f.name.replace(/\.[^.]+$/, ''), text, fileName: f.name, fileSize: f.size, source: '직접 올림' }, at)
      if (sameMaterial([...materials, ...added], m)) {
        dups += 1
        continue
      }
      added.push(m)
    }
    setReading(null)
    if (fileRef.current) fileRef.current.value = ''
    if (added.length) await onAdd(added, `자료 ${added.length}개 추가`)
    if (dups) toast(`같은 자료 ${dups}개는 이미 있어서 건너뛰었습니다.`)
    const empty = added.filter((m) => !m.text.trim()).length
    if (empty) toast(`${empty}개는 글을 읽지 못했습니다(이름만 남김). 내용을 붙여넣기로 더해 주세요.`)
  }

  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-section break-keep text-slate-900">업체 자료</h2>
        <span className="t-sub text-slate-500">{materials.length}개</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" disabled={busy || !!reading} onClick={() => fileRef.current?.click()} data-testid="material-file">
          <FileUp aria-hidden="true" className="size-4" />
          파일
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDialog('url')} data-testid="material-url">
          <Link2 aria-hidden="true" className="size-4" />
          홈페이지 · URL
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDialog('paste')} data-testid="material-paste">
          <Type aria-hidden="true" className="size-4" />
          붙여넣기
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDialog('memo')} data-testid="material-memo">
          <StickyNote aria-hidden="true" className="size-4" />
          메모
        </Button>
      </div>
      {client && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog('docs')} data-testid="material-from-docs">
          업체 서류함에서 가져오기
        </Button>
      )}
      <input ref={fileRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.xlsx" onChange={(e) => void onFiles(e.target.files)} data-testid="material-file-input" />
      {reading && (
        <p className="t-sub flex items-center gap-2 text-slate-600" role="status">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {reading}
        </p>
      )}
      {materials.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">회사소개서 · 사업자등록증 · 기업정보 · 홈페이지 글 · 메모를 넣으면 AI 작업이 이 자료를 같이 봅니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="material-list">
          {materials.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 py-2" data-material={m.kind}>
              <div className="flex items-start gap-2">
                <span className="t-body min-w-0 flex-1 break-words text-slate-800">{m.title}</span>
                <Badge>{MATERIAL_KIND_LABEL[m.kind]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="t-meta text-slate-500">
                  {m.chars ? `${m.chars.toLocaleString('ko-KR')}자` : '글 없음'} · {fmtDateTime(m.addedAt).slice(0, 10)}
                  {m.source ? ` · ${m.source}` : ''}
                </span>
                {m.excluded ? <Badge tone="warning">AI 에 안 보냄</Badge> : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onToggleExclude(m.id, m.excluded ? undefined : '대표가 뺌')}
                  className="t-meta tap min-h-11 font-semibold text-brand-700 hover:underline disabled:opacity-50"
                >
                  {m.excluded ? '다시 보내기' : 'AI 에 안 보내기'}
                </button>
              </div>
              {m.excluded && <span className="t-meta break-keep text-slate-500">{m.excluded}</span>}
            </li>
          ))}
        </ul>
      )}
      {materials.some((m) => !m.excluded && m.text.trim()) && (
        <Button size="sm" variant="ghost" disabled={busy || !aiReady} onClick={onSummarize} data-testid="material-summarize">
          자료 요약 · 업체 정보 채우기(빠르게)
        </Button>
      )}

      {dialog === 'url' && (
        <TextDialog
          title="홈페이지 · URL"
          fields={[{ key: 'url', label: '주소', placeholder: 'https://', rows: 1 }, { key: 'text', label: '그 페이지에서 본 내용(선택 · 붙여넣기)', placeholder: '회사 소개 · 제품 설명 등을 복사해 붙여넣으면 AI 가 같이 봅니다', rows: 5 }]}
          note="OS 는 주소를 직접 열어 읽지 않습니다 — 주소를 남기고, 내용은 붙여넣은 만큼만 씁니다."
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            const url = normalizeUrl(v.url)
            if (!url) return '주소를 확인해 주세요.'
            await addOne(makeMaterial({ kind: 'url', title: url.replace(/^https?:\/\//, ''), text: v.text ? `${url}\n${v.text}` : url, url, source: '직접' }, new Date().toISOString()), '홈페이지 주소 추가')
            setDialog(null)
            return null
          }}
        />
      )}
      {dialog === 'paste' && (
        <TextDialog
          title="붙여넣기"
          fields={[{ key: 'title', label: '제목', placeholder: '예: 회사소개서 본문', rows: 1 }, { key: 'text', label: '글', placeholder: '여기에 붙여넣기', rows: 10 }]}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            if (!v.text.trim()) return '글을 붙여넣어 주세요.'
            await addOne(makeMaterial({ kind: guessMaterialKind(v.title, v.text) === 'other' ? 'paste' : guessMaterialKind(v.title, v.text), title: v.title || '붙여넣은 글', text: v.text, source: '직접' }, new Date().toISOString()), '붙여넣은 글 추가')
            setDialog(null)
            return null
          }}
        />
      )}
      {dialog === 'memo' && (
        <TextDialog
          title="메모"
          fields={[{ key: 'text', label: '메모', placeholder: '예: 대표님이 영업 관리가 제일 힘들다고 함', rows: 6 }]}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            if (!v.text.trim()) return '메모를 적어 주세요.'
            await addOne(makeMaterial({ kind: 'memo', title: v.text.trim().split('\n')[0].slice(0, 40), text: v.text, source: '직접' }, new Date().toISOString()), '메모 추가')
            setDialog(null)
            return null
          }}
        />
      )}
      {dialog === 'docs' && client && <DocsDialog client={client} materials={materials} busy={busy} onClose={() => setDialog(null)} onAdd={async (list) => { await onAdd(list, `업체 서류함에서 ${list.length}개 가져옴`); setDialog(null) }} toast={toast} />}
    </Surface>
  )
}

function TextDialog({
  title,
  fields,
  note,
  busy,
  onClose,
  onSave,
}: {
  title: string
  fields: { key: string; label: string; placeholder: string; rows: number }[]
  note?: string
  busy: boolean
  onClose: () => void
  onSave: (v: Record<string, string>) => Promise<string | null>
}) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ''])))
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal
      open
      title={title}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy} onClick={async () => setErr(await onSave(v))} data-testid="material-save">
            넣기
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {note && <p className="t-sub break-keep text-slate-500">{note}</p>}
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-700">{f.label}</span>
            {f.rows === 1 ? (
              <input value={v[f.key]} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} maxLength={500} data-field={f.key} className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 px-3" />
            ) : (
              <textarea value={v[f.key]} onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={f.rows} maxLength={60000} data-field={f.key} className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" />
            )}
          </label>
        ))}
        {err && <p className="t-sub text-danger-700" role="alert">{err}</p>}
      </div>
    </Modal>
  )
}

function DocsDialog({ client, materials, busy, onClose, onAdd, toast }: { client: ClientOpsRecord; materials: CaseMaterial[]; busy: boolean; onClose: () => void; onAdd: (list: CaseMaterial[]) => Promise<void>; toast: (m: string) => void }) {
  const custom = new Map(client.customDocuments.filter((d) => !d.sensitive).map((d) => [d.key, d.label]))
  const docs = Object.entries(client.documents)
    .filter(([k, d]) => d.storagePath && (k in DOC_KIND || custom.has(k)))
    .map(([k, d]) => ({ key: k, label: custom.get(k) || d.fileName || k, state: d }))
  const [picked, setPicked] = useState<string[]>([])
  const [working, setWorking] = useState<string | null>(null)
  const run = async () => {
    const at = new Date().toISOString()
    const out: CaseMaterial[] = []
    for (const d of docs.filter((x) => picked.includes(x.key))) {
      setWorking(`${d.label} 읽는 중…`)
      try {
        const url = await documentFileUrl(d.state.storagePath)
        if (!url) throw new Error('주소 없음')
        const blob = await (await fetch(url)).blob()
        const file = new File([blob], d.state.fileName || 'document', { type: blob.type })
        const text = canExtractText(file) ? (await extractTextFromFile(file)).text : ''
        const m = makeMaterial({ kind: DOC_KIND[d.key] ?? guessMaterialKind(d.label, text), title: d.label, text, fileName: d.state.fileName, fileSize: d.state.fileSize, source: '업체 서류함' }, at)
        if (!sameMaterial([...materials, ...out], m)) out.push(m)
      } catch {
        toast(`${d.label} 을(를) 읽지 못했습니다.`)
      }
    }
    setWorking(null)
    if (out.length) await onAdd(out)
    else onClose()
  }
  return (
    <Modal
      open
      title="업체 서류함에서 가져오기"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || !!working || picked.length === 0} onClick={run}>
            {working ? '읽는 중…' : `${picked.length}개 가져오기`}
          </Button>
        </>
      }
    >
      {docs.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">가져올 파일이 없습니다. 신분증 · 4대보험 명부 · 인증서 · 건강보험 서류는 개인 정보라 가져오지 않습니다.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {docs.map((d) => (
            <label key={d.key} className="tap flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-brand-600" checked={picked.includes(d.key)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.key] : p.filter((x) => x !== d.key)))} />
              <span className="t-body min-w-0 flex-1 truncate">{d.label}</span>
            </label>
          ))}
          {working && <p className="t-sub text-slate-600" role="status">{working}</p>}
        </div>
      )}
    </Modal>
  )
}
