/** 파일 이름 → OS 안에서 미리 볼 수 있는 종류 (D-129). 못 보면 null — 억지로 열지 않는다 */
export type PreviewKind = 'pdf' | 'image'

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'])

export function previewKindOf(fileName: string): PreviewKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1]?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (IMAGE.has(ext)) return 'image'
  return null
}
