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
import { setToolWorkspace } from './toolStorage'

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
  /**
   * D-130: 저장한 업체 기록을 읽어 둔 목록에도 넣는다 — 안 넣으면 같은 화면의 다른 단추(결과 붙이기)가
   * 예전 기록 위에 저장해 방금 저장한 것(주주명부 · 절세 현황)을 지운다.
   */
  replaceClient: (record: ClientOpsRecord) => void
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
  replaceClient: () => {},
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
  // D-165: 업체 없이 쓰는 도구 칸은 작업공간마다 따로 — 작업공간이 바뀌면 도구 화면을 새로 그린다(앞 작업공간 입력이 남지 않게)
  setToolWorkspace(currentWorkspaceId)
  return (
    <FrameInner key={currentWorkspaceId ?? 'none'} workspaceId={currentWorkspaceId}>
      {children}
    </FrameInner>
  )
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

  const replaceClient = useCallback(
    (record: ClientOpsRecord) => {
      const prev = cache.current ?? Promise.resolve([] as ClientOpsRecord[])
      cache.current = prev.then((list) => (list.some((c) => c.id === record.id) ? list.map((c) => (c.id === record.id ? record : c)) : [...list, record]))
      if (record.id === clientId) setClient(record)
    },
    [clientId],
  )

  const clientName = client?.companyName ?? ''
  const value = useMemo<ToolClientValue>(
    () => ({ clientId, clientName, clientRecord: client, workspaceId, loadClients, replaceClient }),
    [clientId, clientName, client, workspaceId, loadClients, replaceClient],
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
            {/* D-166: 업체 이름이 길면(띄어쓰기 없는 긴 이름) 말줄임 — 전에는 '← 업체로' 와 겹쳤다 */}
            <span className="t-sub min-w-0 flex-1 truncate text-slate-700 sm:flex-none sm:whitespace-normal">
              <b className="font-bold text-slate-900">{clientName || '이 업체'}</b> 일로 열었습니다.
              <span className="max-sm:hidden"> 결과는 이 업체 기록으로 갑니다.</span>
            </span>
            <Link
              to={`/ops/clients/${clientId}`}
              className="tap t-sub ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline"
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

/**
 * D-121: 도구 라우트 밖(영업 관리 › 미팅 준비 등)에서 도구 부품을 '이 업체 일로' 쓸 때.
 * 주소(?client=)가 아니라 넘겨준 업체 기록으로 틀을 세운다. 띠는 얹지 않는다(바깥 화면이 이미 업체를 보여 준다).
 */
export function ToolClientScope({ workspaceId, client, children }: { workspaceId: string | null; client: ClientOpsRecord | null; children: ReactNode }) {
  const cache = useRef<Promise<ClientOpsRecord[]> | null>(null)
  useEffect(() => {
    cache.current = null
  }, [workspaceId])
  const loadClients = useCallback(() => {
    if (!cache.current) cache.current = listClients(workspaceId).catch(() => [] as ClientOpsRecord[])
    return cache.current
  }, [workspaceId])
  const replaceClient = useCallback((record: ClientOpsRecord) => {
    const prev = cache.current ?? Promise.resolve([] as ClientOpsRecord[])
    cache.current = prev.then((list) => (list.some((c) => c.id === record.id) ? list.map((c) => (c.id === record.id ? record : c)) : [...list, record]))
  }, [])
  const value = useMemo<ToolClientValue>(
    () => ({ clientId: client?.id ?? null, clientName: client?.companyName ?? '', clientRecord: client, workspaceId, loadClients, replaceClient }),
    [client, workspaceId, loadClients, replaceClient],
  )
  return <ToolClientCtx.Provider value={value}>{children}</ToolClientCtx.Provider>
}
