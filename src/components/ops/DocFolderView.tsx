/**
 * 서류함 '폴더로 보기' (D-204) — 윈도우 탐색기처럼 폴더 · 큰 아이콘. 목차(서류 칸) 보기와 같은 파일을 다른 모양으로 보여 준다.
 *
 *  - 폴더째 올린 서류는 원래 폴더 그대로(폴더를 누르면 안으로 · 위 빵 부스러기로 돌아오기)
 *  - 파일은 큰 아이콘 — PDF 첫 장 · 사진은 작은 그림, 나머지는 종류 아이콘(엑셀 · 한글 · 워드 · 압축 …)
 *  - 파일을 누르면: 미리보기 · 새 창 · 내려받기 · 어느 서류 칸인지 · 올린 날 · 크기 · [목차에서 이 칸 보기]
 * 여기서는 옮기기 · 이름 바꾸기 · 지우기를 하지 않는다 — 서류 칸이 기준이라 목차에서 한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, CornerLeftUp, FileText, Folder, ListTree } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { crumbsOf, docFolderTree, extLabel, fileKindOf, folderAt, type FileKind, type FolderFile, type FolderNode } from '../../services/docFolders'
import { fileThumb } from '../../lib/fileThumb'
import { formatFileSize } from '../../lib/format'
import { localDateOf } from '../../lib/appClock'
import { OTHER_DOC_LABEL } from '../../services/docClassify'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { DocFileActions } from './DocFileActions'

const KIND_STYLE: Record<FileKind, { bg: string; fg: string; name: string }> = {
  pdf: { bg: 'bg-red-50', fg: 'text-red-600', name: 'PDF' },
  image: { bg: 'bg-sky-50', fg: 'text-sky-600', name: '사진' },
  excel: { bg: 'bg-emerald-50', fg: 'text-emerald-700', name: '엑셀' },
  word: { bg: 'bg-blue-50', fg: 'text-blue-700', name: '워드' },
  hwp: { bg: 'bg-cyan-50', fg: 'text-cyan-700', name: '한글' },
  ppt: { bg: 'bg-orange-50', fg: 'text-orange-600', name: '발표' },
  zip: { bg: 'bg-slate-100', fg: 'text-slate-600', name: '압축' },
  video: { bg: 'bg-violet-50', fg: 'text-violet-600', name: '영상' },
  text: { bg: 'bg-slate-50', fg: 'text-slate-600', name: '글' },
  other: { bg: 'bg-slate-50', fg: 'text-slate-500', name: '파일' },
}

/** D-209 로컬 날짜로 — UTC 로 자르면 한국 오전 9시 전에 올린 파일이 '어제' 로 보였다 */
const day = (iso: string | null) => (iso ? localDateOf(iso).replace(/-/g, '.') : '')

function Thumb({ file, cloud }: { file: FolderFile; cloud: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const kind = fileKindOf(file.fileName)
  const style = KIND_STYLE[kind]
  useEffect(() => {
    if (!cloud || !file.storagePath || (kind !== 'pdf' && kind !== 'image')) return
    const el = ref.current
    if (!el) return
    let alive = true
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      void fileThumb(file.storagePath, file.fileName).then((url) => alive && url && setSrc(url))
    })
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [cloud, file.storagePath, file.fileName, kind])
  return (
    <div ref={ref} className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-(--radius-control) border border-slate-200 ${src ? 'bg-white' : style.bg}`}>
      {src ? (
        <img src={src} alt="" className="size-full object-cover object-top" data-testid="folder-thumb" />
      ) : (
        <span className="flex flex-col items-center gap-1">
          <FileText className={`size-9 ${style.fg}`} aria-hidden="true" />
          <span className={`t-meta font-bold ${style.fg}`}>{extLabel(file.fileName)}</span>
        </span>
      )}
      {src && <span className={`t-meta absolute right-1 bottom-1 rounded px-1 font-bold ${style.bg} ${style.fg}`}>{extLabel(file.fileName)}</span>}
    </div>
  )
}

export function DocFolderView({ record, cloud, onShowInList }: { record: ClientOpsRecord; cloud: boolean; onShowInList: (key: DocumentKey) => void }) {
  const tree = useMemo(() => docFolderTree(record), [record])
  const [path, setPath] = useState('')
  const [open, setOpen] = useState<FolderFile | null>(null)
  const node: FolderNode = folderAt(tree, path) ?? tree
  // 지금 폴더가 없어졌으면(파일을 옮김) 맨 위로
  useEffect(() => {
    if (path && !folderAt(tree, path)) setPath('')
  }, [tree, path])
  const crumbs = crumbsOf(node.path)
  const looseOld = node.path === '' && tree.folders.length > 0 && tree.files.length > 0

  if (tree.total === 0) {
    return (
      <section className="rounded-(--radius-panel) border border-dashed border-slate-300 bg-white p-6 text-center" data-testid="folder-view">
        <p className="t-body text-slate-600">아직 올린 파일이 없어요. [한꺼번에 올리기] 로 폴더째 올리면 폴더 그대로 보여요.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" data-testid="folder-view" data-path={node.path}>
      <nav aria-label="폴더 위치" className="flex flex-wrap items-center gap-1" data-testid="folder-crumbs">
        {node.path !== '' && (
          <button type="button" onClick={() => setPath(crumbs[crumbs.length - 2]?.path ?? '')} className="tap mr-1 flex size-11 items-center justify-center rounded-(--radius-control) border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="위 폴더로" data-testid="folder-up">
            <CornerLeftUp className="size-4" aria-hidden="true" />
          </button>
        )}
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => setPath(c.path)}
              aria-current={i === crumbs.length - 1 ? 'location' : undefined}
              className={`tap t-body min-h-11 max-w-[14rem] truncate rounded-(--radius-control) px-2 ${i === crumbs.length - 1 ? 'font-semibold text-slate-900' : 'text-brand-700 hover:bg-slate-50'}`}
              data-testid="folder-crumb"
            >
              {c.name}
            </button>
          </span>
        ))}
        <span className="t-sub ml-auto shrink-0 text-slate-500">
          {node.folders.length ? `폴더 ${node.folders.length} · ` : ''}파일 {node.files.length}
        </span>
      </nav>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] sm:gap-3" data-testid="folder-grid">
        {node.folders.map((f) => (
          <li key={f.path}>
            <button type="button" onClick={() => setPath(f.path)} className="tap flex w-full flex-col items-center gap-1 rounded-(--radius-control) p-1.5 text-center hover:bg-amber-50/60" data-testid="folder-item" data-name={f.name}>
              <span className="flex aspect-[4/5] w-full items-center justify-center">
                <Folder className="size-[70%] fill-amber-300 text-amber-500" strokeWidth={1.25} aria-hidden="true" />
              </span>
              <span className="t-sub line-clamp-2 w-full font-medium break-all text-slate-800">{f.name}</span>
              <span className="t-meta text-slate-500">파일 {f.total}개</span>
            </button>
          </li>
        ))}
        {node.files.map((f) => (
          <li key={f.key}>
            <button type="button" onClick={() => setOpen(f)} className="tap flex w-full flex-col items-center gap-1 rounded-(--radius-control) p-1.5 text-center hover:bg-slate-50" data-testid="folder-file" data-key={f.key} title={f.fileName}>
              <Thumb file={f} cloud={cloud} />
              <span className="t-sub line-clamp-2 w-full break-all text-slate-800">{f.fileName}</span>
              {/* D-209: 무슨 서류인지 모르는 파일(기타 칸)은 폴더 보기에서도 눈에 띄게 — 목차 보기로 가서 칸을 고른다 */}
              {f.label.startsWith(OTHER_DOC_LABEL) ? (
                <span className="t-meta line-clamp-1 w-full font-semibold text-warning-700" data-testid="folder-file-other">
                  확인 필요
                </span>
              ) : (
                <span className="t-meta line-clamp-1 w-full text-slate-500">{f.label}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {looseOld && <p className="t-meta break-keep text-slate-500">폴더 밖에 있는 파일은 하나씩 올렸거나 폴더 보기가 생기기 전에 올린 것이에요.</p>}

      {open && (
        <BottomSheet title={open.fileName} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-4" data-testid="folder-file-sheet">
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
              <dt className="t-sub text-slate-500">서류 칸</dt>
              <dd className="t-body break-words text-slate-800">{open.label}</dd>
              <dt className="t-sub text-slate-500">폴더</dt>
              <dd className="t-body break-words text-slate-800">{open.folderPath || '폴더 없이 올림'}</dd>
              <dt className="t-sub text-slate-500">올린 날</dt>
              <dd className="t-body text-slate-800">{day(open.uploadedAt) || '—'}</dd>
              {open.issuedAt && (
                <>
                  <dt className="t-sub text-slate-500">발급일</dt>
                  <dd className="t-body text-slate-800">{open.issuedAt.replace(/-/g, '.')}</dd>
                </>
              )}
              {open.fileSize > 0 && (
                <>
                  <dt className="t-sub text-slate-500">크기</dt>
                  <dd className="t-body text-slate-800">{formatFileSize(open.fileSize)}</dd>
                </>
              )}
            </dl>
            {open.storagePath ? <DocFileActions label={open.label} storagePath={open.storagePath} fileName={open.fileName} /> : <p className="t-sub break-keep text-slate-500">이 브라우저에만 저장 중이라 파일은 열 수 없어요(클라우드를 연결하면 열려요).</p>}
            <Button
              variant="secondary"
              onClick={() => {
                const key = open.key
                setOpen(null)
                onShowInList(key)
              }}
              data-testid="folder-show-in-list"
            >
              <ListTree className="size-4" aria-hidden="true" />
              목차에서 이 칸 보기
            </Button>
          </div>
        </BottomSheet>
      )}
    </section>
  )
}
