/**
 * 설정 화면 공유 조각 (local·supabase 모두 사용). Supabase 의존성이 없다.
 */

import { useMemo, type ReactNode } from 'react'
import { Database, Info, SlidersHorizontal, Users } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { TextScaleControl } from '../../components/ui/TextScaleControl'
import { MotionControl, ThemeControl } from '../../components/ui/ThemeControl'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { CloudSaveStatus } from '../../components/cloud/CloudSaveStatus'
import { SCHEMA_VERSION } from '../../storage/localStore'
import { buildLocalSnapshot, summarizeSnapshot } from '../../services/dataImport/localSnapshot'
import { downloadLocalBackup } from '../../services/dataImport/localBackup'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { isAdvancedVisible, setFeatureVisibility } from '../../lib/featureVisibility'
import { brand } from '../../brand/brand.config'

export type TabKey = 'me' | 'workspace' | 'data' | 'system'

export const SETTINGS_TABS: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: 'me', label: '내 설정', icon: SlidersHorizontal },
  { key: 'workspace', label: '워크스페이스', icon: Users },
  { key: 'data', label: '데이터', icon: Database },
  { key: 'system', label: '시스템', icon: Info },
]

export function TabNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <nav aria-label="설정 메뉴" className="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200">
      {SETTINGS_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
            active === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <t.icon aria-hidden="true" className="size-4" />
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-2.5 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[13px] font-medium text-slate-800">{children}</span>
    </div>
  )
}

/** 화면 색·움직임 (마스터 규격: 테마 9종 + 모션 설정) */
export function AppearancePanel() {
  return (
    <Panel title="화면 색">
      <HelpNote summary="전체 화면의 색을 9가지 중에서 고릅니다. 고르면 즉시 반영되고 다음 접속에도 유지됩니다. 글자·표·서식의 읽기 편한 색은 테마와 상관없이 그대로 유지됩니다." />
      <div className="mt-4">
        <ThemeControl />
      </div>
      <div className="mt-4">
        <MotionControl />
      </div>
    </Panel>
  )
}

export function TextScalePanel() {
  return (
    <Panel title="글자 크기">
      <HelpNote summary="화면 전체의 글자 크기를 조절합니다. 선택하면 즉시 반영되고 다음 접속에도 유지됩니다." />
      <div className="mt-4">
        <TextScaleControl showPreview />
      </div>
    </Panel>
  )
}

/** 고급 운영 기능 노출 토글 (Stage 12B-UX 5차) */
export function FeatureVisibilityPanel() {
  const version = useStoreVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const advanced = useMemo(() => isAdvancedVisible(), [version])
  return (
    <Panel title="고급 운영 기능 보기">
      <HelpNote summary="테스트 운영, 기관 연계, 사례 관리처럼 프로젝트 후반에 사용하는 기능을 추가로 표시합니다. 꺼도 데이터는 삭제되지 않으며 직접 주소로는 계속 접근할 수 있습니다." />
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-(--radius-control) border border-slate-200 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[0.95rem] font-semibold text-slate-800">고급 운영 기능 보기</span>
          <span className="block text-[0.88rem] break-keep text-slate-500">
            {advanced ? '실제 사용 테스트·기관 연계·사례 메뉴가 표시됩니다.' : '지금은 핵심 흐름만 표시합니다.'}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="고급 운영 기능 보기"
          checked={advanced}
          onChange={(e) => setFeatureVisibility(e.target.checked ? 'advanced' : 'core')}
          className="size-5 shrink-0 accent-brand-600"
        />
      </label>
    </Panel>
  )
}

export function SystemPanel({ mode, connection }: { mode: string; connection: ReactNode }) {
  return (
    <Panel title="시스템 정보">
      <SettingRow label="앱">{brand.productName} · {brand.productSubtitle}</SettingRow>
      <SettingRow label="데이터 모드">{mode === 'supabase' ? '클라우드(supabase)' : '로컬 데모(local)'}</SettingRow>
      <SettingRow label="연결 상태">{connection}</SettingRow>
      <SettingRow label="로컬 스키마">v{SCHEMA_VERSION}</SettingRow>
      <SettingRow label="DB 마이그레이션">stage12a</SettingRow>
    </Panel>
  )
}

export function LocalDataSummaryPanel() {
  const snapshot = useMemo(() => buildLocalSnapshot(), [])
  const summary = useMemo(() => summarizeSnapshot(snapshot), [snapshot])
  const { showToast } = useToast()
  return (
    <Panel title="로컬 데이터">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CloudSaveStatus state="local" />
          <span className="text-[13px] text-slate-500">스키마 v{snapshot.schemaVersion} · 총 {snapshot.totalItems}건</span>
        </div>
        {summary.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {summary.map((s) => (
              <li key={s.domain} className="flex items-center justify-between text-[13px] text-slate-600">
                <span className="truncate">{s.domain}</span>
                <span className="font-semibold text-slate-800">{s.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-slate-500">저장된 로컬 데이터가 없습니다.</p>
        )}
        <div>
          <Button variant="secondary" onClick={() => { downloadLocalBackup(); showToast('로컬 백업(JSON)을 내려받았습니다.') }}>
            로컬 데이터 내보내기(JSON)
          </Button>
          <p className="mt-2 text-[0.875rem] break-keep text-slate-400">
            클라우드 저장(supabase 모드)으로 옮기려면 로그인 후 설정 &gt; 데이터에서 가져오기를 실행하세요. 로컬 데이터는 자동으로 지워지지 않습니다.
          </p>
        </div>
      </div>
    </Panel>
  )
}
