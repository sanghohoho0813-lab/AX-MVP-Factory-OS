/**
 * D-549 SAFE-5 서류 원본 내려받기 — 업체 서류함 [원본 내려받기] · 더보기 › [서류 원본 한 번에 내려받기].
 *
 * 한 판에 두 가지만: [전부 n개] · [정책자금 신청 서류 m개](서류함에 있는 신청 서류가 있을 때만).
 * 누르면 바로 받는 중 n/m → 압축 파일(.zip) 하나로 내려받고 한 줄로 끝 — 파일 이름은 서류 칸 이름, 원래 이름 · 발급일은 안의 목록.txt.
 * 읽기만 한다(서류함 · 보관함 아무것도 바꾸지 않는다).
 */
import { useMemo, useState } from 'react'
import { Download, FileArchive, Landmark } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import type { ClientOpsRecord } from '../../types/clientOps'
import { buildOriginalsZip, originalItems, originalsDoneLine, originalsZipName } from '../../services/docOriginals'
import { policyDocKeys } from '../../services/policyEvidence'
import { fetchDocumentBytes, saveBytesAs } from '../../services/clientOpsService'

const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

export function DocOriginalsSheet({ record, today, onClose }: { record: ClientOpsRecord; today: string; onClose: () => void }) {
  const all = useMemo(() => originalItems(record), [record])
  const policyKeys = useMemo(() => policyDocKeys(record, today), [record, today])
  const policy = useMemo(() => originalItems(record, policyKeys), [record, policyKeys])
  const [busy, setBusy] = useState<'all' | 'policy' | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [done, setDone] = useState('')

  const run = async (kind: 'all' | 'policy') => {
    if (busy) return
    setBusy(kind)
    setDone('')
    setProgress({ done: 0, total: kind === 'all' ? all.length : policy.length })
    try {
      const r = await buildOriginalsZip([{ record, keys: kind === 'policy' ? policyKeys : null }], {
        fetchBytes: fetchDocumentBytes,
        today,
        title: kind === 'policy' ? '정책자금 신청 서류(서류함에 있는 것)' : '서류 원본',
        onProgress: (d, t) => setProgress({ done: d, total: t }),
      })
      if (r.got > 0) saveBytesAs(r.zip, originalsZipName(kind === 'policy' ? 'policy' : 'client', record.companyName, today))
      setDone(r.got > 0 ? originalsDoneLine(r) : r.failed > 0 ? `한 개도 받지 못했어요 — 인터넷을 확인하고 다시 눌러 주세요(${r.rows[0]?.reason ?? '받지 못함'}).` : originalsDoneLine(r))
    } catch (cause) {
      setDone(cause instanceof Error && cause.message ? `내려받지 못했어요 — ${cause.message}` : '내려받지 못했어요 — 다시 눌러 주세요.')
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const total = all.reduce((n, i) => n + i.fileSize, 0)
  return (
    <BottomSheet title="서류 원본 내려받기" onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="doc-originals">
        <p className="t-sub break-keep text-slate-600">
          서류함에 올린 원본 파일을 압축 파일(.zip) 하나로 받아요. 파일 이름은 <b className="font-semibold text-slate-800">서류 칸 이름</b>이고, 원래 파일 이름 · 발급일은 안의 목록.txt 에 있어요.
        </p>
        <Button variant="primary" className="w-full justify-start" onClick={() => void run('all')} disabled={!!busy || all.length === 0} data-testid="doc-originals-all">
          <FileArchive aria-hidden="true" className="size-4" />
          {busy === 'all' ? '모으는 중…' : `전부 ${all.length}개${total > 0 ? ` · ${mb(total)}` : ''}`}
        </Button>
        {policy.length > 0 && (
          <Button variant="secondary" className="w-full justify-start" onClick={() => void run('policy')} disabled={!!busy} data-testid="doc-originals-policy">
            <Landmark aria-hidden="true" className="size-4" />
            {busy === 'policy' ? '모으는 중…' : `정책자금 신청 서류만 ${policy.length}개`}
            <span className="t-meta ml-auto font-normal text-slate-500 max-sm:hidden">기관에 낼 것 · 기한 지난 것은 뺌</span>
          </Button>
        )}
        {progress && (
          <div className="flex flex-col gap-1" role="status" data-testid="doc-originals-progress">
            <p className="t-sub text-slate-700">
              <Download aria-hidden="true" className="mr-1 inline size-4" />
              받는 중 {progress.done} / {progress.total}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
            </div>
          </div>
        )}
        {done && (
          <p role="status" className="t-sub break-keep text-slate-800" data-testid="doc-originals-done">
            {done}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
