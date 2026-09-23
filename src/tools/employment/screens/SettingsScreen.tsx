/**
 * 설정·백업 — 이 모듈이 쌓은 것을 내보내고 되돌린다 (D-91).
 *
 * 원본의 설정 화면에는 글자 크기와 화면 안내가 있었다. 그 둘은 이 OS 가 이미 갖고 있으므로
 * (머리띠의 글자 크기 · 온보딩) 여기서는 **이 모듈의 기록**만 다룬다.
 *
 * 내보낸 파일에는 업체가 아니라 모듈 기록만 들어간다 — 업체 백업은 고객 운영의 백업이 한다.
 */

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { listRows, replaceRows, type ModuleRow } from '../../../services/moduleData'
import { useToolClient } from '../../shared/toolClientContext'
import { useEmployees } from '../lib/useEmployees'
import { usePrograms } from '../lib/usePrograms'

const MODULE = 'employment'
const BUCKETS = ['employees', 'programs'] as const

interface BackupFile {
  kind: 'axmvp.module.employment'
  version: 1
  savedAt: string
  buckets: Record<string, ModuleRow[]>
}

export function SettingsScreen() {
  const { workspaceId } = useToolClient()
  const { employees, reload } = useEmployees()
  const { programs } = usePrograms()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const exportAll = async () => {
    setBusy(true)
    try {
      const buckets: Record<string, ModuleRow[]> = {}
      for (const b of BUCKETS) buckets[b] = await listRows(workspaceId, MODULE, b)
      const file: BackupFile = {
        kind: 'axmvp.module.employment',
        version: 1,
        savedAt: new Date().toISOString(),
        buckets,
      }
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `고용지원금-기록-${new Date().toISOString().slice(0, 10)}.json`
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
      if (parsed.kind !== 'axmvp.module.employment' || !parsed.buckets) {
        showToast('고용지원금 기록 파일이 아닙니다.')
        return
      }
      for (const b of BUCKETS) {
        const rows = parsed.buckets[b]
        if (Array.isArray(rows)) await replaceRows(workspaceId, MODULE, b, rows)
      }
      await reload()
      showToast('기록을 되돌렸습니다. 화면을 한 번 새로 고쳐 주세요.')
    } catch {
      showToast('파일을 읽지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="emp-settings">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="대상자 기록" value={`${employees?.length ?? 0}줄`} />
        <MetricTile label="지원금" value={`${programs?.filter((p) => p.enabled).length ?? 0}개`} hint="쓰는 것" />
        <MetricTile label="저장 위치" value={workspaceId ? '클라우드' : '이 브라우저'} hint={workspaceId ? '작업실에 저장' : '로컬 모드'} />
      </div>

      <Section title="백업">
        <Surface>
          <div className="flex flex-col gap-3">
            <p className="t-sub break-keep text-slate-600">
              이 모듈이 쌓은 기록(대상자·지원금 설정)만 파일로 내보내고 되돌립니다.
              업체 자체는 <Link to="/settings" className="font-medium text-brand-700 hover:underline">고객 운영 백업</Link> 이 맡습니다 —
              같은 업체를 두 벌로 만들지 않기 위해서입니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void exportAll()} disabled={busy} data-testid="emp-export">
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
      </Section>

      <Section title="이 모듈이 지키는 것">
        <Surface>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 t-sub text-slate-600">
            <li>주민등록번호를 저장하지 않습니다. 나이 요건 판정에는 생년월일이면 충분합니다.</li>
            <li>4대보험 명부 파일은 브라우저 안에서만 읽고 어디에도 남기지 않습니다.</li>
            <li>업체 명단은 이 모듈이 따로 갖지 않습니다 — 고객 운영의 업체를 그대로 씁니다.</li>
            <li>판정·계산은 전부 규칙표 기준입니다. 외부 API 를 부르지 않습니다.</li>
          </ul>
        </Surface>
      </Section>
    </div>
  )
}
