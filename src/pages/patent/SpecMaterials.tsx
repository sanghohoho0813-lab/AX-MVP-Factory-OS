/**
 * D-271 [자료 넣기] — 대표: "자료 넣기를 누르면 꼭 파일을 첨부하는 것뿐만 아니라 GPT 랑 실제로 나눈 대화를 첨부한다든지 ·
 *   기본적으로는 고객 관리 안에 그 업체 서류 첨부한 거를 기반으로".
 *   ① 업체 서류함(고객 관리 › 업체 › 서류)에서 가져오기 ② 파일 올리기 ③ 글 붙여넣기(GPT 대화 · 메모) — 그리고 넣은 자료 보기 · 빼기.
 */
import { useState } from 'react'
import { ClipboardPaste, FileUp, FolderOpen, Loader2, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { MATERIAL_MAX, type SpecDraft } from '../../services/patent/specDraft'
import { DOC_MATERIAL_KIND, type ImportableDoc } from '../../services/patent/specMaterials'

export function SpecMaterialsSheet({
  open,
  onClose,
  d,
  docs,
  missingFiles,
  reading,
  docFails,
  onImportDocs,
  onPickFiles,
  onAddText,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  d: SpecDraft
  /** 업체 서류함에서 읽을 수 있는 파일 */
  docs: ImportableDoc[]
  /** 받았다고만 표시된 서류(파일 없음) 수 */
  missingFiles: number
  reading: string
  docFails: string[]
  onImportDocs: (keys: string[]) => void
  onPickFiles: () => void
  onAddText: (title: string, text: string) => Promise<boolean>
  onRemove: (index: number) => void
}) {
  const have = (label: string) => d.materials.some((m) => m.kind === DOC_MATERIAL_KIND && m.title === label)
  const fresh = docs.filter((x) => !have(x.label))
  const [picked, setPicked] = useState<string[]>(() => fresh.map((x) => x.key))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const room = MATERIAL_MAX - d.materials.length
  const busy = !!reading
  return (
    <Modal open={open} title="자료 넣기" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4" data-testid="spec-mats-sheet">
        <p className="t-sub break-keep text-slate-600">
          AI 가 이 자료로 회사 이야기를 잡고 아이디어를 냅니다. 자료는 {MATERIAL_MAX}개까지(지금 {d.materials.length}개) · 읽은 글만 남기고 원본 파일은 저장하지 않아요 · 사람 이름 · 연락처는 가립니다.
        </p>

        {/* ① 업체 서류함 */}
        <section className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2.5" data-testid="spec-mats-docs" aria-labelledby="spec-mats-docs-h">
          <h3 id="spec-mats-docs-h" className="t-sub flex items-center gap-1.5 font-bold text-slate-900">
            <FolderOpen aria-hidden="true" className="size-4" /> 업체 서류함에서 가져오기
          </h3>
          {docs.length === 0 ? (
            <p className="t-meta break-keep text-slate-600">
              {missingFiles ? `서류함에 받았다고 표시된 서류 ${missingFiles}개는 파일이 올라와 있지 않아 읽을 수 없어요(이 기기에만 저장한 경우). ` : '서류함에 올린 파일이 없어요. '}
              고객 관리 › 업체 › 서류에서 회사 소개서 · 제품 설명 · 사업계획서를 올리면 여기서 바로 읽어요. 신분증 · 명부 · 인증서 같은 개인 정보 서류는 가져오지 않아요.
            </p>
          ) : (
            <>
              <ul className="flex flex-col">
                {docs.map((x) => {
                  const done = have(x.label)
                  return (
                    <li key={x.key}>
                      <label className="tap flex min-h-11 items-center gap-2">
                        <input type="checkbox" className="size-5 accent-brand-600" disabled={done || busy} checked={done || picked.includes(x.key)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, x.key] : p.filter((k) => k !== x.key)))} data-testid="spec-mats-doc" data-key={x.key} />
                        <span className="t-sub min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">{x.label}</span>
                        {done && <span className="t-meta shrink-0 rounded-full bg-success-100 px-2 py-0.5 font-semibold text-success-800">넣음</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
              <Button variant="secondary" size="sm" className="self-start" disabled={busy || !picked.filter((k) => fresh.some((x) => x.key === k)).length || room <= 0} onClick={() => onImportDocs(picked.filter((k) => fresh.some((x) => x.key === k)))} data-testid="spec-mats-docs-run">
                {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <FolderOpen aria-hidden="true" className="size-4" />} {busy ? reading : `고른 서류 ${picked.filter((k) => fresh.some((x) => x.key === k)).length}개 읽어서 넣기`}
              </Button>
            </>
          )}
          {docFails.length > 0 && (
            <p className="t-meta break-keep text-warning-800" data-testid="spec-mats-doc-fails">
              읽지 못한 서류 · {docFails.join(' · ')} — 파일을 다시 받지 못했거나 그림 · 스캔이에요. 글이 있는 PDF · 한글 · 워드로 다시 올리거나, 내용을 아래에 붙여 넣어 주세요.
            </p>
          )}
        </section>

        {/* ② 파일 */}
        <section className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2.5" aria-labelledby="spec-mats-file-h">
          <h3 id="spec-mats-file-h" className="t-sub flex items-center gap-1.5 font-bold text-slate-900">
            <FileUp aria-hidden="true" className="size-4" /> 파일 올리기
          </h3>
          <p className="t-meta break-keep text-slate-600">회사 소개서 · 제품 설명 · 기존 명세서 · GPT 대화 저장본(.hwpx · .hwp · .docx · .pdf · .txt · .md)</p>
          <Button variant="secondary" size="sm" className="self-start" disabled={busy || room <= 0} onClick={onPickFiles} data-testid="spec-mats-file">
            <FileUp aria-hidden="true" className="size-4" /> 파일 고르기
          </Button>
        </section>

        {/* ③ 글 붙여넣기 */}
        <section className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2.5" data-testid="spec-mats-paste" aria-labelledby="spec-mats-paste-h">
          <h3 id="spec-mats-paste-h" className="t-sub flex items-center gap-1.5 font-bold text-slate-900">
            <ClipboardPaste aria-hidden="true" className="size-4" /> 글 붙여넣기 — GPT 와 나눈 대화 · 메모
          </h3>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="이름(비우면 '붙여 넣은 글')" aria-label="붙여 넣는 글 이름" className="t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 text-slate-900" data-testid="spec-mats-paste-title" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={60000} placeholder="ChatGPT 에서 나눈 대화를 통째로 복사해 붙여 넣으세요 — 끝부분(정리한 결론)까지 AI 가 봅니다." aria-label="붙여 넣을 글" className="t-sub rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-slate-900" data-testid="spec-mats-paste-text" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={busy || text.trim().length < 20 || room <= 0}
              onClick={async () => {
                if (await onAddText(title, text)) {
                  setTitle('')
                  setText('')
                }
              }}
              data-testid="spec-mats-paste-add"
            >
              <ClipboardPaste aria-hidden="true" className="size-4" /> 붙여 넣은 글 넣기
            </Button>
            <span className="t-meta text-slate-500">{text.trim().length.toLocaleString('ko-KR')}자</span>
          </div>
        </section>

        {/* 넣은 자료 */}
        <section className="flex flex-col gap-1.5" data-testid="spec-mats-list" aria-labelledby="spec-mats-list-h">
          <h3 id="spec-mats-list-h" className="t-sub font-bold text-slate-900">
            넣은 자료 {d.materials.length}/{MATERIAL_MAX}
          </h3>
          {d.materials.length === 0 ? (
            <p className="t-meta text-slate-500">아직 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {d.materials.map((m, i) => (
                <li key={`${m.title}-${i}`} className="flex items-center gap-2 rounded-(--radius-control) bg-slate-50 px-2.5 py-1.5" data-testid="spec-mats-item" data-kind={m.kind}>
                  <span className="t-meta shrink-0 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">{m.kind}</span>
                  <span className="t-sub min-w-0 flex-1 truncate text-slate-800">{m.title}</span>
                  <span className="t-meta shrink-0 text-slate-500">{m.text.length.toLocaleString('ko-KR')}자</span>
                  <button type="button" onClick={() => onRemove(i)} disabled={busy} className="tap inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-danger-50 hover:text-danger-700" aria-label={`${m.title} 빼기`} data-testid="spec-mats-remove">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
