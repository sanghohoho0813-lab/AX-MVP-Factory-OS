/**
 * 도구를 "어느 업체 일로" 여는 길 (D-89).
 *
 * 업체 상세에서 도구를 누르면 주소에 `?client=<업체 id>` 가 붙는다. 그러면
 *   - 도구 화면 맨 위에 "○○(주) 일로 열었습니다 — 업체로 돌아가기" 띠가 뜨고,
 *   - 결과를 붙일 때 업체를 다시 고르지 않는다(한 번 눌러 그 업체로 간다).
 *
 * 업체 목록은 이 틀에서 **한 번만** 읽어 붙이기 단추와 나눠 쓴다.
 * 로컬 모드에는 AuthProvider 가 없으므로 다른 화면과 같이 데이터 모드로 갈라 부른다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { getDataModeConfig } from '../../data/dataMode'
import { listClients } from '../../services/clientOpsService'
import type { ClientOpsRecord } from '../../types/clientOps'

export interface ToolClientValue {
  /** 주소에 실린 업체 id (없으면 null) */
  clientId: string | null
  /** 그 업체 이름 (아직 못 읽었으면 빈 글자) */
  clientName: string
  /** 그 업체 기록 전체 — 도구가 아는 것을 미리 채울 때 쓴다 (D-90) */
  clientRecord: ClientOpsRecord | null
  workspaceId: string | null
  /** 업체 목록을 한 번만 읽어 돌려준다 (붙이기 시트와 공유) */
  loadClients: () => Promise<ClientOpsRecord[]>
}

/**
 * 틀 밖에서 쓰였을 때의 기본값. 로컬 모드는 작업실이 없으므로 이대로도 목록이 읽힌다.
 * (클라우드 모드에서는 작업실 id 가 없어 실패하고 빈 목록이 된다 — 그래서 도구 라우트는 전부 틀로 감싼다.)
 */
const EMPTY: ToolClientValue = {
  clientId: null,
  clientName: '',
  clientRecord: null,
  workspaceId: null,
  loadClients: () => listClients(null).catch(() => [] as ClientOpsRecord[]),
}

const ToolClientCtx = createContext<ToolClientValue>(EMPTY)

export function useToolClient(): ToolClientValue {
  return useContext(ToolClientCtx)
}

/** 도구 화면을 감싸는 틀 — 모든 `/tools/*` 라우트가 이것으로 감긴다 */
export function ToolClientFrame({ children }: { children: ReactNode }) {
  return getDataModeConfig().mode === 'supabase' ? (
    <CloudFrame>{children}</CloudFrame>
  ) : (
    <FrameInner workspaceId={null}>{children}</FrameInner>
  )
}

function CloudFrame({ children }: { children: ReactNode }) {
  const { currentWorkspaceId } = useAuth()
  return <FrameInner workspaceId={currentWorkspaceId}>{children}</FrameInner>
}

function FrameInner({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  const [params] = useSearchParams()
  const clientId = params.get('client')
  const [client, setClient] = useState<ClientOpsRecord | null>(null)
  const cache = useRef<Promise<ClientOpsRecord[]> | null>(null)

  // 작업실이 바뀌면 읽어 둔 목록을 버린다
  useEffect(() => {
    cache.current = null
  }, [workspaceId])

  const loadClients = useCallback(() => {
    if (!cache.current) {
      cache.current = listClients(workspaceId).catch(() => [] as ClientOpsRecord[])
    }
    return cache.current
  }, [workspaceId])

  useEffect(() => {
    if (!clientId) {
      setClient(null)
      return
    }
    let alive = true
    void loadClients().then((list) => {
      if (!alive) return
      setClient(list.find((c) => c.id === clientId) ?? null)
    })
    return () => {
      alive = false
    }
  }, [clientId, loadClients])

  const clientName = client?.companyName ?? ''
  const value = useMemo<ToolClientValue>(
    () => ({ clientId, clientName, clientRecord: client, workspaceId, loadClients }),
    [clientId, clientName, client, workspaceId, loadClients],
  )

  // 업체를 물고 온 때만 띠를 얹는다 — 그냥 연 도구 화면은 예전과 한 픽셀도 다르지 않다.
  return (
    <ToolClientCtx.Provider value={value}>
      {clientId ? (
        <div className="flex flex-col gap-4">
          <div
            data-testid="tool-client-banner"
            className="no-print flex items-center gap-x-3 gap-y-1 rounded-(--radius-panel) border border-brand-200 bg-brand-50 px-3 py-2 sm:flex-wrap"
          >
            {/* D-98: 휴대폰에서는 한 줄로 — 전에는 아이콘 한 줄 · 글 두 줄 · 돌아가기 한 줄로 모든 모듈 화면 위를 약 110px 차지했다 */}
            <Building2 aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
            <span className="t-sub min-w-0 flex-1 break-keep text-slate-700 sm:flex-none">
              <b className="font-bold text-slate-900">{clientName || '이 업체'}</b> 일로 열었습니다.
              <span className="max-sm:hidden"> 결과는 이 업체 기록으로 갑니다.</span>
            </span>
            <Link
              to={`/ops/clients/${clientId}`}
              className="t-sub ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" /> 업체로<span className="max-sm:sr-only"> 돌아가기</span>
            </Link>
          </div>
          {children}
        </div>
      ) : (
        children
      )}
    </ToolClientCtx.Provider>
  )
}
