/**
 * 서류함 '폴더로 보기' (D-204 대표 요청) — 올린 서류를 윈도우 탐색기처럼 폴더 · 큰 아이콘으로.
 *
 * "서류 낱개(목차)로 보는 것도 좋지만, 처음 올린 사람은 한눈에 안 들어올 수 있다 — 평소 폴더 안에 있는 것처럼 똑같이
 *  보여 주는 칸도 따로. 폴더에서 찾는 게 익숙한 사람도 많으니 두 방식을 같이 쓰게."
 *
 * 폴더는 올릴 때 남긴 원래 경로(DocumentState.folderPath)로 만든다. 경로가 없는 파일(하나씩 올렸거나 이 기능 전에 올린 것)은
 * 맨 위(서류함)에 놓인다. 서류 칸 · 파일은 그대로 — 보는 모양만 다르다(옮기거나 이름을 바꾸지 않는다).
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import { allDocumentMetas } from './clientOpsDocuments'

export interface FolderFile {
  key: DocumentKey
  /** 서류 칸 이름(사업자등록증 · 정관 (2) …) */
  label: string
  fileName: string
  fileSize: number
  storagePath: string
  /** 올린 · 고친 때 */
  updatedAt: string | null
  /** D-209 올린 때(없으면 updatedAt) */
  uploadedAt: string | null
  issuedAt: string
  folderPath: string
}

export interface FolderNode {
  name: string
  /** '' = 맨 위 */
  path: string
  folders: FolderNode[]
  files: FolderFile[]
  /** 이 폴더 아래(하위 폴더 포함) 파일 수 */
  total: number
  /** 이 폴더 아래 가장 최근에 올린 때 */
  latest: string | null
}

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

function newNode(name: string, path: string): FolderNode {
  return { name, path, folders: [], files: [], total: 0, latest: null }
}

/** 서류함의 파일(이름이 있는 칸)을 폴더 나무로 */
export function docFolderTree(record: ClientOpsRecord): FolderNode {
  const root = newNode('서류함', '')
  const labelOf = new Map(allDocumentMetas(record).map((m) => [m.key, m.label]))
  for (const [key, st] of Object.entries(record.documents ?? {})) {
    if (!st || !st.fileName) continue
    const folderPath = (st.folderPath ?? '')
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean)
      .join('/')
    const file: FolderFile = {
      key: key as DocumentKey,
      label: labelOf.get(key as DocumentKey) ?? key,
      fileName: st.fileName,
      fileSize: st.fileSize ?? 0,
      storagePath: st.storagePath ?? '',
      updatedAt: st.updatedAt ?? null,
      uploadedAt: st.uploadedAt ?? st.updatedAt ?? null,
      issuedAt: st.issuedAt ?? '',
      folderPath,
    }
    let node = root
    const chain: FolderNode[] = [root]
    if (folderPath) {
      let path = ''
      for (const part of folderPath.split('/')) {
        path = path ? `${path}/${part}` : part
        let next = node.folders.find((f) => f.name === part)
        if (!next) {
          next = newNode(part, path)
          node.folders.push(next)
        }
        node = next
        chain.push(node)
      }
    }
    node.files.push(file)
    for (const n of chain) {
      n.total += 1
      if (file.uploadedAt && (!n.latest || file.uploadedAt > n.latest)) n.latest = file.uploadedAt
    }
  }
  const sortNode = (n: FolderNode) => {
    n.folders.sort((a, b) => collator.compare(a.name, b.name))
    n.files.sort((a, b) => collator.compare(a.fileName, b.fileName))
    n.folders.forEach(sortNode)
  }
  sortNode(root)
  return root
}

/** 경로('a/b')의 폴더 — 없으면 null(지워졌거나 옮겨짐) */
export function folderAt(root: FolderNode, path: string): FolderNode | null {
  if (!path) return root
  let node: FolderNode | undefined = root
  for (const part of path.split('/')) {
    node = node?.folders.find((f) => f.name === part)
    if (!node) return null
  }
  return node ?? null
}

/** 빵 부스러기 — [서류함, a, a/b] */
export function crumbsOf(path: string): { name: string; path: string }[] {
  const out = [{ name: '서류함', path: '' }]
  let acc = ''
  for (const part of path.split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${part}` : part
    out.push({ name: part, path: acc })
  }
  return out
}

export type FileKind = 'pdf' | 'image' | 'excel' | 'word' | 'hwp' | 'ppt' | 'zip' | 'video' | 'text' | 'other'

export function fileKindOf(fileName: string): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1]?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'tif', 'tiff'].includes(ext)) return 'image'
  if (['xls', 'xlsx', 'xlsm', 'csv', 'cell'].includes(ext)) return 'excel'
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'word'
  if (['hwp', 'hwpx', 'hlz'].includes(ext)) return 'hwp'
  if (['ppt', 'pptx', 'key', 'show'].includes(ext)) return 'ppt'
  if (['zip', '7z', 'rar', 'alz', 'egg', 'tar', 'gz'].includes(ext)) return 'zip'
  if (['mp4', 'mov', 'avi', 'mkv', 'wmv'].includes(ext)) return 'video'
  if (['txt', 'md', 'json', 'xml'].includes(ext)) return 'text'
  return 'other'
}

/** 파일 종류 표시(아이콘 위 글자) */
export function extLabel(fileName: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1]?.toUpperCase() ?? ''
  return ext.slice(0, 4) || '파일'
}

/** 폴더 정보가 없는 파일이 있는가(예전에 올린 것) — 화면 안내용 */
export function filesWithoutFolder(root: FolderNode): number {
  return root.files.length
}
