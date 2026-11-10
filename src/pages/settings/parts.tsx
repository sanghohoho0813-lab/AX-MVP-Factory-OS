/**
 * 설정 화면 공유 조각 (local·supabase 모두 사용). Supabase 의존성이 없다.
 */

import { useCustomerAudience } from '../../config/customerAudience'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CONTENT_WIDTH_LABEL, CONTENT_WIDTH_PX, setContentWidth, useContentWidth } from '../../lib/contentWidth'
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
import { CHAT_FIRST_EVENT, CHAT_FIRST_KEYS, CHAT_FIRST_LABEL, readChatFirst, writeChatFirst, type ChatFirstMode } from '../../services/workChat/chatFirst'

export type TabKey = 'me' | 'workspace' | 'data' | 'system'

export const SETTINGS_TABS: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: 'me', label: '내 설정', icon: SlidersHorizontal },
  { key: 'workspace', label: '작업공간', icon: Users },
  { key: 'data', label: '데이터', icon: Database },
  { key: 'system', label: '시스템', icon: Info },
]

export function TabNav({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    // D-103: 휴대폰에서 넷째 칸('시스템')이 오른쪽에 잘려 옆으로 밀어야 보였다 — 좁으면 네 칸 한 줄(아이콘 위 · 글 아래)
    <nav aria-label="설정 메뉴" className="grid min-w-0 grid-cols-4 border-b border-slate-200 sm:flex sm:gap-1">
      {SETTINGS_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          aria-current={active === t.key ? 'page' : undefined}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex min-w-0 flex-col items-center gap-0.5 border-b-2 px-1 py-2 text-[0.875rem] font-medium break-keep transition-colors sm:shrink-0 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2.5 ${
            active === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <t.icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="max-w-full truncate">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-2.5 last:border-0">
      <span className="text-[0.875rem] text-slate-500">{label}</span>
      <span className="text-[0.875rem] font-medium text-slate-800">{children}</span>
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
      <ContentWidthControl />
    </Panel>
  )
}

/**
 * D-552 모듈 첫 화면 — 메뉴로 들어가면 대화창부터 / 예전 화면(바로 화면) 바로.
 * 전체를 고르면 모듈마다 고른 것은 비워 전체를 따른다(모듈 대화창 아래 '처음에 무엇을 보여 줄까요?' 와 같은 값).
 */
/** D-563 외부 구독 고객 계정에는 전문 모듈이 없다 — 이 칸을 그리지 않는다(대표 · 내부 팀장은 그대로) */
export function ModuleStartPanel() {
  const customer = useCustomerAudience()
  return customer ? null : <ModuleStartPanelBody />
}

function ModuleStartPanelBody() {
  const [prefs, setPrefs] = useState(readChatFirst)
  useEffect(() => {
    const on = () => setPrefs(readChatFirst())
    window.addEventListener(CHAT_FIRST_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(CHAT_FIRST_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const all: ChatFirstMode = prefs.all ?? 'chat'
  const own = CHAT_FIRST_KEYS.filter((k) => prefs.mods?.[k] && prefs.mods[k] !== all)
  const opts: { k: ChatFirstMode; label: string; sub: string }[] = [
    { k: 'chat', label: '대화창부터', sub: '물어보면 그 업체 판정 · 숫자로 답해요' },
    { k: 'direct', label: '바로 화면', sub: '예전처럼 목차 · 입력 칸이 바로 보여요' },
  ]
  return (
    <Panel title="모듈 첫 화면">
      <p className="text-[0.875rem] break-keep text-slate-600">
        정책자금 · 고용지원금 · 연구소 · 창업감면 · 세금 계산기 · 지원사업 · 크레탑 · 홍보 글 · 홈페이지를 메뉴로 열 때 처음 보이는 화면이에요. 어느 쪽이든 화면 위 [대화로 묻기] · [바로 화면] 으로 바로 오갈 수 있어요.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="모듈 첫 화면" data-testid="settings-chatfirst">
        {opts.map((o) => (
          <button
            key={o.k}
            type="button"
            role="radio"
            aria-checked={all === o.k}
            data-mode={o.k}
            onClick={() => writeChatFirst({ all: o.k, clearMods: true })}
            className={`tap flex min-h-11 flex-col items-start rounded-(--radius-control) border bg-white px-4 py-2.5 text-left ${all === o.k ? 'border-brand-600' : 'border-slate-200 hover:border-brand-400'}`}
          >
            <span className={`text-[0.9375rem] font-semibold ${all === o.k ? 'text-brand-700' : 'text-slate-800'}`}>
              {all === o.k ? '● ' : ''}
              {o.label}
            </span>
            <span className="text-[0.875rem] break-keep text-slate-500">{o.sub}</span>
          </button>
        ))}
      </div>
      {own.length > 0 && (
        <p className="mt-2 text-[0.875rem] break-keep text-slate-600" data-testid="settings-chatfirst-own">
          따로 고른 곳 {own.length}곳 — {own.map((k) => `${CHAT_FIRST_LABEL[k]}(${prefs.mods?.[k] === 'chat' ? '대화창부터' : '바로 화면'})`).join(' · ')}. 위에서 고르면 모두 같게 바뀌어요.
        </p>
      )}
    </Panel>
  )
}

/** D-201: PC 본문 폭 — 머리줄 [폭] 단추와 같은 값(글자 크기는 그대로) */
function ContentWidthControl() {
  const w = useContentWidth()
  return (
    <fieldset className="mt-5" data-testid="settings-content-width">
      <legend className="text-[0.9375rem] font-semibold text-slate-800">PC 본문 폭</legend>
      <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">글자 크기는 그대로 두고 본문 가로 길이만 바꿉니다 — 큰 모니터에서 눈이 좌우로 덜 움직이게. 머리줄 [폭] 단추와 같습니다.</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="PC 본문 폭">
        {(['narrow', 'normal', 'wide'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={w === k}
            onClick={() => setContentWidth(k)}
            data-width={k}
            className={`tap min-h-11 rounded-full border px-4 text-[0.9375rem] font-semibold ${w === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:border-brand-400'}`}
          >
            {CONTENT_WIDTH_LABEL[k]}
            <span className="ml-1 text-[0.875rem] font-medium text-slate-500">{CONTENT_WIDTH_PX[k].toLocaleString('ko-KR')}px{k === 'normal' ? ' · 기본' : ''}</span>
          </button>
        ))}
      </div>
    </fieldset>
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
          <span className="block text-[0.9375rem] font-semibold text-slate-800">고급 운영 기능 보기</span>
          <span className="block text-[0.875rem] break-keep text-slate-500">
            {advanced ? '목차 AX 스튜디오에 검증 · 기관 전략 · 사례가 보입니다.' : '지금은 핵심 흐름만 — 검증 · 기관 전략 · 사례는 목차에서 뺐습니다(주소로는 열립니다).'}
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
      <SettingRow label="저장 방식">{mode === 'supabase' ? '클라우드 저장' : '이 브라우저에만 저장(연습용)'}</SettingRow>
      <SettingRow label="연결 상태">{connection}</SettingRow>
      <SettingRow label="저장 형식">v{SCHEMA_VERSION} · stage12a</SettingRow>
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
          <span className="text-[0.875rem] text-slate-500">저장 형식 v{snapshot.schemaVersion} · 총 {snapshot.totalItems}건</span>
        </div>
        {summary.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {summary.map((s) => (
              <li key={s.domain} className="flex items-center justify-between text-[0.875rem] text-slate-600">
                <span className="truncate">{s.domain}</span>
                <span className="font-semibold text-slate-800">{s.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.875rem] text-slate-500">저장된 로컬 데이터가 없습니다.</p>
        )}
        <div>
          <Button variant="secondary" onClick={() => { downloadLocalBackup(); showToast('로컬 백업(JSON)을 내려받았습니다.') }}>
            로컬 데이터 내보내기(JSON)
          </Button>
          <p className="mt-2 text-[0.875rem] break-keep text-slate-400">
            클라우드 저장으로 옮기려면 로그인 후 설정 &gt; 데이터에서 가져오기를 실행하세요. 로컬 데이터는 자동으로 지워지지 않습니다.
          </p>
        </div>
      </div>
    </Panel>
  )
}
