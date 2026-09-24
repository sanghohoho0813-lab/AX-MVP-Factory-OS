/**
 * 모듈 기록 내보내기·되돌리기 (D-91).
 *
 * 모듈마다 같은 단추를 다시 만들지 않는다. 갈래 이름만 넘기면 된다.
 * 내보낸 파일에는 **이 모듈이 쌓은 것만** 들어간다 — 업체 자체는 고객 운영 백업이 맡는다.
 */

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { listRows, replaceRows, type ModuleRow } from '../../services/moduleData'
import { useToolClient } from './toolClientContext'

interface BackupFile {
  kind: string
  version: 1
  savedAt: string
  buckets: Record<string, ModuleRow[]>
}

export interface ModuleBackupProps {
  moduleKey: string
  /** 내보낼 갈래들 */
  buckets: readonly string[]
  /** 파일 이름에 쓸 말 (예: 연구소) */
  label: string
  /** 되돌린 뒤 화면을 다시 읽게 하고 싶을 때 */
  onRestored?: () => void
}

export function ModuleBackup({ moduleKey, buckets, label, onRestored }: ModuleBackupProps) {
  const { workspaceId } = useToolClient()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const kind = `axmvp.module.${moduleKey}`

  const exportAll = async () => {
    setBusy(true)
    try {
      const out: Record<string, ModuleRow[]> = {}
      for (const b of buckets) out[b] = await listRows(workspaceId, moduleKey, b)
      const file: BackupFile = { kind, version: 1, savedAt: new Date().toISOString(), buckets: out }
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label}-기록-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('이 모듈의 기록을 내보냈습니다.')
    } finally {
      setBusy(false)
    }
  }

  const importAll = async (file: File) => {
    setBusy(true)
    try {
      const parsed = JSON.parse(await file.text()) as Partial<BackupFile>
      if (parsed.kind !== kind || !parsed.buckets) {
        showToast(`${label} 기록 파일이 아닙니다.`)
        return
      }
      for (const b of buckets) {
        const rows = parsed.buckets[b]
        if (Array.isArray(rows)) await replaceRows(workspaceId, moduleKey, b, rows)
      }
      onRestored?.()
      showToast('기록을 되돌렸습니다.')
    } catch {
      showToast('파일을 읽지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Surface>
      <div className="flex flex-col gap-3">
        <p className="t-sub break-keep text-slate-600">
          이 모듈이 쌓은 기록만 파일로 내보내고 되돌립니다. 업체 자체는{' '}
          <Link to="/settings" className="font-medium text-brand-700 hover:underline">
            고객 관리 백업
          </Link>{' '}
          이 맡습니다 — 같은 업체를 두 벌로 만들지 않기 위해서입니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportAll()} disabled={busy} data-testid="module-export">
            <Download aria-hidden="true" className="size-4" /> 내보내기
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload aria-hidden="true" className="size-4" /> 되돌리기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="기록 파일 고르기"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importAll(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="t-meta break-keep text-slate-400">
          되돌리기는 이 모듈의 기록을 <b>파일의 것으로 바꿉니다</b>. 지금 것을 먼저 내보내 두세요.
        </p>
      </div>
    </Surface>
  )
}
