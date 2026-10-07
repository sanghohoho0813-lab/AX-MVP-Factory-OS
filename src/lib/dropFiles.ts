/**
 * 끌어다 놓은 것 → 파일 목록 (D-168). 폴더를 끌어다 놓아도 안의 파일을 다 읽는다(하위 폴더 포함).
 *
 * 브라우저는 폴더를 놓으면 dataTransfer.files 에 크기 0 짜리 '폴더 이름' 하나만 준다 —
 * webkitGetAsEntry 로 폴더 안을 직접 훑는다. 항목(entry)은 놓는 순간에만 꺼낼 수 있어 await 전에 모두 꺼낸다.
 */

/** 한 번에 읽는 파일 수 — 실수로 큰 폴더를 놓아도 화면이 멈추지 않게 */
export const DROP_FILE_LIMIT = 300
const MAX_DEPTH = 6

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (ok: (f: File) => void, fail: (e: unknown) => void) => void
  createReader?: () => { readEntries: (ok: (list: FsEntry[]) => void, fail: (e: unknown) => void) => void }
}

function fileOf(entry: FsEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) return resolve(null)
    entry.file(resolve, () => resolve(null))
  })
}

async function childrenOf(entry: FsEntry): Promise<FsEntry[]> {
  const reader = entry.createReader?.()
  if (!reader) return []
  const out: FsEntry[] = []
  // readEntries 는 한 번에 100개 정도만 준다 — 빈 목록이 올 때까지 다시 부른다
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve) => reader.readEntries(resolve, () => resolve([])))
    if (batch.length === 0) break
    out.push(...batch)
    if (out.length > DROP_FILE_LIMIT * 2) break
  }
  return out
}

async function walk(entry: FsEntry, depth: number, out: File[]): Promise<void> {
  if (out.length >= DROP_FILE_LIMIT) return
  if (entry.isFile) {
    const f = await fileOf(entry)
    if (f) out.push(f)
    return
  }
  if (!entry.isDirectory || depth >= MAX_DEPTH) return
  for (const child of await childrenOf(entry)) await walk(child, depth + 1, out)
}

/** 놓은 것 전부(폴더 안 파일 포함). 폴더를 못 훑는 브라우저면 dataTransfer.files 그대로 */
export async function filesFromDrop(dt: DataTransfer | null): Promise<{ files: File[]; folders: number; capped: boolean }> {
  if (!dt) return { files: [], folders: 0, capped: false }
  const plain = Array.from(dt.files ?? [])
  const items = Array.from(dt.items ?? [])
  const entries = items
    .filter((it) => it.kind === 'file')
    .map((it) => (typeof (it as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry === 'function' ? (it as DataTransferItem & { webkitGetAsEntry: () => FsEntry | null }).webkitGetAsEntry() : null))
  if (entries.length === 0 || entries.some((e) => e === null)) return { files: plain, folders: 0, capped: false }
  const folders = entries.filter((e) => e?.isDirectory).length
  if (folders === 0) return { files: plain, folders: 0, capped: false }
  const out: File[] = []
  for (const e of entries) if (e) await walk(e, 0, out)
  return { files: out, folders, capped: out.length >= DROP_FILE_LIMIT }
}
