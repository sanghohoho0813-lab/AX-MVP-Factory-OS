import { Suspense, lazy, useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { CloudSaveStatus } from '../components/cloud/CloudSaveStatus'
import { getDataModeConfig } from '../data/dataMode'
import { CURRENT_USER } from '../data/demo'
import {
  TabNav,
  SettingRow,
  TextScalePanel,
  SystemPanel,
  LocalDataSummaryPanel,
  type TabKey,
} from './settings/parts'

// supabase 설정 화면은 lazy 로 로드해 local entry 번들에 Supabase SDK 가 섞이지 않게 한다.
const SupabaseSettingsView = lazy(() =>
  import('./settings/SupabaseSettingsView').then((m) => ({ default: m.SupabaseSettingsView })),
)

/** local 모드 설정 (로그인/워크스페이스 없음) */
function LocalSettings() {
  const [tab, setTab] = useState<TabKey>('me')
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
      <PageHeader title="설정" description="화면 표시와 운영 환경을 관리합니다." />
      <TabNav active={tab} onChange={setTab} />
      {tab === 'me' && (
        <>
          <Panel title="내 정보">
            <SettingRow label="이름">{CURRENT_USER.name}</SettingRow>
            <SettingRow label="역할">{CURRENT_USER.role}</SettingRow>
          </Panel>
          <TextScalePanel />
        </>
      )}
      {tab === 'workspace' && (
        <Panel title="워크스페이스">
          <p className="text-[13px] break-keep text-slate-500">
            로컬 데모 모드에서는 워크스페이스·구성원이 없습니다. 클라우드 저장(supabase) 모드에서 워크스페이스를 만들고 구성원을 초대할 수 있습니다.
          </p>
        </Panel>
      )}
      {tab === 'data' && <LocalDataSummaryPanel />}
      {tab === 'system' && <SystemPanel mode="local" connection={<CloudSaveStatus state="local" />} />}
    </div>
  )
}

export function SettingsPage() {
  const mode = getDataModeConfig().mode
  if (mode === 'supabase') {
    return (
      <Suspense fallback={<div className="p-6 text-sm text-slate-400">불러오는 중…</div>}>
        <SupabaseSettingsView />
      </Suspense>
    )
  }
  return <LocalSettings />
}
