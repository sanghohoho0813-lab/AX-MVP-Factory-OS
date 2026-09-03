/**
 * supabase 모드 설정 화면 (세션·워크스페이스 사용). lazy 로 로드되어 local entry 에 영향 없음.
 */

import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { CloudSaveStatus } from '../../components/cloud/CloudSaveStatus'
import { notifyStoreChanged } from '../../storage/localStore'
import { downloadLocalBackup, clearLocalDomainData } from '../../services/dataImport/localBackup'
import { useAuth } from '../../auth/AuthProvider'
import { WorkspaceMembersPanel } from '../../components/data/WorkspaceMembersPanel'
import { ImportWizard } from '../../components/data/ImportWizard'
import { TabNav, SettingRow, TextScalePanel, FeatureVisibilityPanel, SystemPanel, type TabKey } from './parts'
import { OnboardingSettingsPanel } from './OnboardingSettingsPanel'
import { SupabaseHealthPanel } from './SupabaseHealthPanel'

function DataPanelSupabase() {
  const { showToast } = useToast()
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)

  function handleClear() {
    setBusy(true)
    try {
      // 정리 전 반드시 백업을 내려받는다.
      downloadLocalBackup()
      clearLocalDomainData()
      notifyStoreChanged()
      showToast('로컬 백업을 내려받고 로컬 원본을 정리했습니다.')
      setConfirmClear(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="로컬 데이터 가져오기">
        <HelpNote summary="이 브라우저의 로컬 데이터를 현재 워크스페이스(클라우드)로 옮깁니다. 멱등하며 원본은 지워지지 않습니다." />
        <div className="mt-4">
          <ImportWizard />
        </div>
      </Panel>

      <Panel title="로컬 원본 정리">
        <p className="text-[13px] break-keep text-slate-500">
          클라우드로 가져오기를 마친 뒤, 이 브라우저에 남은 로컬 원본을 정리할 수 있습니다. 정리 전 자동으로 JSON 백업을 내려받습니다.
        </p>
        <Button variant="secondary" className="mt-4" onClick={() => setConfirmClear(true)}>
          가져온 로컬 데이터 정리
        </Button>
      </Panel>

      <ConfirmModal
        open={confirmClear}
        title="로컬 원본 정리"
        message="이 브라우저의 로컬 도메인 데이터를 정리합니다. 진행하면 먼저 JSON 백업을 내려받은 뒤 삭제합니다."
        warning="클라우드로 가져오기를 완료했는지 먼저 확인하세요. 이 작업은 되돌릴 수 없습니다(백업 파일로만 복원 가능)."
        confirmLabel="백업 후 정리"
        danger
        busy={busy}
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  )
}

export function SupabaseSettingsView() {
  const [tab, setTab] = useState<TabKey>('me')
  const { session, workspaces, currentWorkspaceId } = useAuth()
  const current = workspaces.find((w) => w.workspaceId === currentWorkspaceId)
  const roleLabel: Record<string, string> = { owner: '소유자', admin: '관리자', editor: '편집자', viewer: '뷰어' }
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
      <PageHeader title="설정" description="내 계정·워크스페이스·데이터·시스템을 관리합니다." />
      <TabNav active={tab} onChange={setTab} />
      {tab === 'me' && (
        <>
          <Panel title="내 정보">
            <SettingRow label="이메일">{session?.user.email ?? '—'}</SettingRow>
            <SettingRow label="현재 워크스페이스">{current?.workspace?.name ?? '—'}</SettingRow>
            <SettingRow label="내 역할">{current ? roleLabel[current.role] : '—'}</SettingRow>
          </Panel>
          <TextScalePanel />
          <FeatureVisibilityPanel />
          <OnboardingSettingsPanel />
        </>
      )}
      {tab === 'workspace' && (
        <Panel title={`워크스페이스 · ${current?.workspace?.name ?? ''}`}>
          <WorkspaceMembersPanel />
        </Panel>
      )}
      {tab === 'data' && <DataPanelSupabase />}
      {tab === 'system' && <SupabaseHealthPanel />}
      {tab === 'system' && <SystemPanel mode="supabase" connection={<CloudSaveStatus state="saved" />} />}
    </div>
  )
}
