/**
 * supabase 모드 전용 헤더 조각 (워크스페이스 선택기 + 사용자 메뉴).
 * 별도 모듈로 분리해 lazy import 함으로써 local 모드 entry 번들에 Supabase SDK 가
 * 포함되지 않게 한다.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building, Check, ChevronDown, LogOut, Plus, Settings } from 'lucide-react'
import { useDismissable } from '../../lib/useDismissable'
import { useToast } from '../ui/toastContext'
import { TextScaleControl } from '../ui/TextScaleControl'
import { useAuth } from '../../auth/AuthProvider'
import { createWorkspace } from '../../auth/workspaceService'

const ROLE_LABEL: Record<string, string> = { owner: '소유자', admin: '관리자', editor: '편집자', viewer: '뷰어' }

export function SupabaseWorkspaceSelector() {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  const { workspaces, currentWorkspaceId, selectWorkspace, refreshWorkspaces } = useAuth()
  const { showToast } = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const current = workspaces.find((w) => w.workspaceId === currentWorkspaceId)

  function handleSwitch(id: string) {
    if (id === currentWorkspaceId) {
      setOpen(false)
      return
    }
    selectWorkspace(id)
    setOpen(false)
    // 워크스페이스 전환 시 현재 화면을 홈으로 되돌려 이전 데이터 잔상을 막는다.
    window.location.assign('/')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      const ws = await createWorkspace(name.trim())
      await refreshWorkspaces()
      selectWorkspace(ws.id)
      showToast('워크스페이스를 만들었습니다.')
      window.location.assign('/')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '워크스페이스를 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-[34vw] shrink">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
      >
        <Building aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        <span className="truncate">{current?.workspace?.name ?? '워크스페이스'}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-72 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
          <ul role="listbox" aria-label="워크스페이스 선택" className="max-h-64 overflow-y-auto">
            {workspaces.map((ws) => (
              <li key={ws.workspaceId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ws.workspaceId === currentWorkspaceId}
                  onClick={() => handleSwitch(ws.workspaceId)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate">
                    {ws.workspace?.name ?? ws.workspaceId}
                    <span className="ml-1.5 text-[0.8125rem] text-slate-400">{ROLE_LABEL[ws.role]}</span>
                  </span>
                  {ws.workspaceId === currentWorkspaceId && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-slate-100 pt-1.5">
            {creating ? (
              <form onSubmit={handleCreate} className="flex items-center gap-1.5 px-1.5 py-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="새 워크스페이스 이름"
                  className="h-8 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-2 text-[13px]"
                />
                <button type="submit" disabled={busy} className="h-8 shrink-0 cursor-pointer rounded-(--radius-control) bg-brand-600 px-2.5 text-[13px] font-medium text-white disabled:opacity-50">
                  만들기
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-50"
              >
                <Plus aria-hidden="true" className="size-4" /> 새 워크스페이스 만들기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SupabaseUserMenu() {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''
  const initial = email ? email[0]?.toUpperCase() : 'U'
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="사용자 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-1.5 hover:bg-slate-100 sm:px-2"
      >
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-[13px] font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[180px] text-left leading-tight xl:block">
          <span className="block truncate text-[13px] font-semibold text-slate-800">{email}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-slate-400 xl:block" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-56 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-800">{email}</p>
          </div>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Settings aria-hidden="true" className="size-4 text-slate-400" /> 설정
          </Link>
          <button
            type="button"
            onClick={() => { setOpen(false); void signOut() }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut aria-hidden="true" className="size-4 text-slate-400" /> 로그아웃
          </button>
          <div className="mt-1 border-t border-slate-100 px-3 pt-2.5 pb-1.5">
            <p className="mb-1.5 text-[0.875rem] font-semibold text-slate-500">글자 크기</p>
            <TextScaleControl compact />
          </div>
        </div>
      )}
    </div>
  )
}
