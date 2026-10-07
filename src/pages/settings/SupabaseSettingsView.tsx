/**
 * supabase 모드 설정 화면 (세션·워크스페이스 사용). lazy 로 로드되어 local entry 에 영향 없음.
 */

import { useIsPilot, useViewingPilot } from '../../auth/osAccess'
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
import { useCurrentUser } from '../../components/layout/useCurrentUser'
import { TabNav, SettingRow, AppearancePanel, TextScalePanel, FeatureVisibilityPanel, SystemPanel, type TabKey } from './parts'
import { OnboardingSettingsPanel } from './OnboardingSettingsPanel'
import { SupabaseHealthPanel } from './SupabaseHealthPanel'
import { updateMyName } from '../../auth/authService'

/** D-163: 이름 · 직함 고치기 — 사이드바 · 머리줄 · 고객에게 가는 글 서명이 같이 바뀐다(대표 · Pilot 같은 화면) */
function NameEditor() {
  const { session } = useAuth()
  const me = useCurrentUser()
  const { showToast } = useToast()
  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>
  const [name, setName] = useState(typeof meta.display_name === 'string' ? meta.display_name : me.name === '사용자' ? '' : me.name)
  const [title, setTitle] = useState(typeof meta.title === 'string' ? meta.title : me.title)
  const [saving, setSaving] = useState(false)
  // D-164: 대표가 팀장 화면을 보는 중 — 여기서 저장하면 대표 계정 이름이 바뀐다. 팀장 이름은 팀장 계정에서.
  const viewing = useViewingPilot()
  if (viewing) {
    return (
      <p className="t-sub border-b border-slate-50 py-3 text-slate-600" data-testid="name-editor-viewing">
        지금은 팀장님 화면을 보는 중입니다. 이름 · 직함은 팀장님 계정으로 들어가서 바꿉니다(여기서 바꾸면 대표님 계정 이름이 바뀝니다).
      </p>
    )
  }
  const save = async () => {
    if (!name.trim()) return showToast('이름을 적어 주세요.')
    setSaving(true)
    const r = await updateMyName(name, title)
    setSaving(false)
    showToast(r.ok ? '이름을 바꿨습니다.' : (r.errorMessage ?? '저장하지 못했습니다.'))
  }
  const input = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]'
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-50 py-3" data-testid="name-editor">
      <label className="min-w-[10rem] flex-1 text-[0.875rem] text-slate-500">
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 최은혜" className={input} data-testid="name-input" />
      </label>
      <label className="w-32 text-[0.875rem] text-slate-500">
        직함
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 팀장" className={input} data-testid="title-input" />
      </label>
      <Button variant="primary" onClick={() => void save()} disabled={saving} data-testid="name-save">
        {saving ? '저장 중…' : '이름 저장'}
      </Button>
    </div>
  )
}

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
        <HelpNote summary="이 브라우저의 로컬 데이터를 현재 작업공간(클라우드)로 옮깁니다. 멱등하며 원본은 지워지지 않습니다." />
        <div className="mt-4">
          <ImportWizard />
        </div>
      </Panel>

      <Panel title="로컬 원본 정리">
        <p className="text-[0.875rem] break-keep text-slate-500">
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
  // D-162: Pilot 에게는 '내 설정' 하나만 — 구성원 · 데이터 가져오기(이 브라우저 자료를 작업공간으로) · 시스템 · 고급 기능 · 사용법 설정은 없다
  const pilot = useIsPilot()
  if (pilot) {
    return (
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5" data-testid="settings-pilot">
        <PageHeader title="설정" description="내 계정과 화면 표시를 바꿉니다." />
        <Panel title="내 정보">
          <NameEditor />
          <SettingRow label="이메일">{session?.user.email ?? '—'}</SettingRow>
          <SettingRow label="작업공간">{current?.workspace?.name ?? '—'}</SettingRow>
        </Panel>
        <TextScalePanel />
        <AppearancePanel />
      </div>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
      <PageHeader title="설정" description="내 계정·작업공간·데이터·시스템을 관리합니다." />
      <TabNav active={tab} onChange={setTab} />
      {tab === 'me' && (
        <>
          <Panel title="내 정보">
            <NameEditor />
            <SettingRow label="이메일">{session?.user.email ?? '—'}</SettingRow>
            <SettingRow label="현재 작업공간">{current?.workspace?.name ?? '—'}</SettingRow>
            <SettingRow label="내 역할">{current ? roleLabel[current.role] : '—'}</SettingRow>
          </Panel>
          <TextScalePanel />
          <AppearancePanel />
          <FeatureVisibilityPanel />
          <OnboardingSettingsPanel />
        </>
      )}
      {tab === 'workspace' && (
        <Panel title={`작업공간 · ${current?.workspace?.name ?? ''}`}>
          <WorkspaceMembersPanel />
        </Panel>
      )}
      {tab === 'data' && <DataPanelSupabase />}
      {tab === 'system' && <SupabaseHealthPanel />}
      {tab === 'system' && <SystemPanel mode="supabase" connection={<CloudSaveStatus state="saved" />} />}
    </div>
  )
}
