/**
 * D-290 설정 › 계정 · 보기 — 예전 왼쪽 아래(사이드바 · 휴대폰 서랍)에 줄줄이 있던 것을 한 칸에.
 *
 * 대표: "목차들 좀 정리하자. 왼쪽 아래엔 김상호 대표, 로그아웃만 두고 나머지는 다 설정 안에."
 *  - 보는 화면(대표 ↔ 팀장 — 대표만) · 보기 방식(PC · Mobile · PC+Mobile) · 고객 플랫폼 열기(팀장에게는 없음 — D-162)
 *  - 클라우드에서는 계정 바꾸기 · 피드백 줄을 children 으로 받는다 — 로컬 모드 화면이 클라우드 코드를 끌어오지 않게
 *    여기서는 피드백 · 계정 부품을 import 하지 않는다.
 * PC 는 머리줄 오른쪽 위에도 보는 화면 · 보기 방식 단추가 그대로 있다(여기는 한곳에 모아 둔 자리).
 */
import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { ViewAsSwitch, useViewTargets } from '../../components/layout/ViewAsSwitch'
import { DeviceSwitch } from '../../components/layout/DeviceView'
import { useDeviceView } from '../../lib/deviceView'
import { brand } from '../../brand/brand.config'

/** 한 줄 — 왼쪽 이름 · 설명, 오른쪽 단추(좁으면 위아래로) */
export function AccountViewRow({ label, hint, children, testId }: { label: string; hint?: string; children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-2 border-b border-slate-100 py-3.5 last:border-0 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <p className="text-[0.95rem] font-semibold break-keep text-slate-800">{label}</p>
        {hint && <p className="t-sub mt-0.5 break-keep text-slate-500">{hint}</p>}
      </div>
      <div className="w-full min-w-0 md:w-[min(24rem,55%)] md:shrink-0">{children}</div>
    </div>
  )
}

export function AccountViewPanel({ children, portal = true }: { children?: ReactNode; portal?: boolean }) {
  const views = useViewTargets()
  const device = useDeviceView()
  return (
    <Panel title="계정 · 보기">
      <div data-testid="settings-account-view" className="flex flex-col">
        {views && (
          <AccountViewRow label="보는 화면" hint="다시 로그인하지 않고 팀장 화면을 그대로 봅니다." testId="settings-view-as">
            <ViewAsSwitch stacked />
          </AccountViewRow>
        )}
        {device.available && (
          <AccountViewRow label="보기 방식" hint="PC 화면 · 휴대폰 화면 · 둘을 나란히. 이 기기에만 기억합니다." testId="settings-device">
            <DeviceSwitch stacked />
          </AccountViewRow>
        )}
        {children}
        {/* D-162 팀장에게는 고객 플랫폼 문이 없다(대표 고객 플랫폼 — 머리줄과 같게) */}
        {portal && <AccountViewRow label={brand.customerPlatformLabel} hint="고객이 보는 화면을 새 창으로 엽니다." testId="settings-portal">
          <a
            href={brand.customerPlatformUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="settings-portal-link"
            className="tap inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-[0.95rem] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{brand.customerPlatformLabel} 열기</span>
          </a>
        </AccountViewRow>}
      </div>
    </Panel>
  )
}
