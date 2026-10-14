/**
 * AI 작업실 화면 공용 — 문지기(권한) · 저장소 고르기 · 짧은 글 그리기 · 작은 부품.
 *
 * 문지기는 화면만 막는다. 데이터는 DB 정책(owner_ai_can), AI 호출은 서버 함수(has_capability)가 따로 막는다.
 */
import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { listClients } from '../../services/clientOpsService'
import { fetchAiStatus, type AiStatus, AiCallError } from '../../services/ownerAi/aiClient'
import { ownerAiRepo, type OwnerAiRepo } from '../../services/ownerAi/repo'
import { TIER_LABEL } from '../../services/ownerAi/skillCatalog'
import type { Tier } from '../../services/ownerAi/types'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Badge, Surface } from '../../components/ui/primitives'

/* ---------------- 누가 · 어디에 ---------------- */

export interface OwnerAiIdentity {
  workspaceId: string | null
  userId: string | null
}

/** 클라우드면 지금 작업공간 · 로그인한 사람, 로컬이면 둘 다 null(이 기기) */
export function useOwnerAiIdentity(): OwnerAiIdentity {
  const auth = useContext(AuthContext)
  return { workspaceId: auth?.currentWorkspaceId ?? null, userId: auth?.session?.user.id ?? null }
}

export function useOwnerAiRepo(): OwnerAiRepo {
  const { workspaceId, userId } = useOwnerAiIdentity()
  return useMemo(() => ownerAiRepo({ workspaceId, userId }), [workspaceId, userId])
}

/** 고객 관리 업체 목록(같은 작업공간) — 실패하면 빈 목록(AI 작업실은 업체 없이도 쓴다) */
export function useClientList(): { clients: ClientOpsRecord[]; loaded: boolean; reload: () => void } {
  const { workspaceId } = useOwnerAiIdentity()
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    listClients(workspaceId)
      .then((l) => alive && setClients(l))
      .catch(() => alive && setClients([]))
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [workspaceId, tick])
  return { clients, loaded, reload: () => setTick((t) => t + 1) }
}

export function useFindClient(): (id: string) => Promise<ClientOpsRecord | null> {
  const { workspaceId } = useOwnerAiIdentity()
  return useCallback(async (id: string) => (await listClients(workspaceId)).find((c) => c.id === id) ?? null, [workspaceId])
}

/* ---------------- AI 설정 상태 ---------------- */

export type AiSetup = { state: 'checking' } | { state: 'ready'; status: AiStatus } | { state: 'missing'; missing: string[] } | { state: 'error'; message: string }

let statusCache: { at: number; value: AiSetup } | null = null

/** 서버에 AI 키 · 모델이 있는지(값은 오지 않는다 — 설정 이름과 있다/없다만) */
export function useAiSetup(): { setup: AiSetup; recheck: () => void } {
  const [setup, setSetup] = useState<AiSetup>(() => (statusCache && Date.now() - statusCache.at < 60_000 ? statusCache.value : { state: 'checking' }))
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (tick === 0 && statusCache && Date.now() - statusCache.at < 60_000) return
    let alive = true
    fetchAiStatus()
      .then((s) => {
        const v: AiSetup = s.configured ? { state: 'ready', status: s } : { state: 'missing', missing: s.missing }
        statusCache = { at: Date.now(), value: v }
        if (alive) setSetup(v)
      })
      .catch((e: unknown) => {
        const v: AiSetup = e instanceof AiCallError && e.code === 'setup_needed' ? { state: 'missing', missing: e.missing } : { state: 'error', message: e instanceof Error ? e.message : 'AI 설정을 확인하지 못했습니다.' }
        statusCache = { at: Date.now(), value: v }
        if (alive) setSetup(v)
      })
    return () => {
      alive = false
    }
  }, [tick])
  return { setup, recheck: () => setTick((t) => t + 1) }
}

/** 'AI 기능 설정이 필요합니다.' — 무엇을 넣어야 하는지(이름만) */
export function AiSetupBanner({ setup }: { setup: AiSetup }) {
  if (setup.state !== 'missing' && setup.state !== 'error') return null
  return (
    <div role="status" data-testid="ai-setup-banner" className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 px-4 py-3">
      <p className="t-body font-semibold break-keep text-warning-700">AI 기능 설정이 필요합니다.</p>
      <p className="t-sub mt-1 break-keep text-warning-700">
        {setup.state === 'missing'
          ? `서버 환경변수에 ${setup.missing.length ? setup.missing.join(' · ') : 'AI 키 · 모델'} 을(를) 넣으면 AI 버튼이 켜집니다. 그 전에도 업체 등록 · 자료 · 기억 · ChatGPT 결과 붙여넣기는 그대로 쓸 수 있습니다.`
          : setup.message}
      </p>
    </div>
  )
}

/* ---------------- 문지기 ---------------- */

/**
 * 대표 전용. 팀장 · 권한 없는 사람은 주소로 와도 안내만(데이터를 읽지 않는다).
 * DB 0021 이 없으면 '설정 필요' 만.
 */
export function OwnerAiGate({ children }: { children: ReactNode }) {
  const access = useOwnerAiAccess()
  if (access === 'yes') return <>{children}</>
  if (access === 'setup')
    return (
      <Surface className="mx-auto max-w-xl" >
        <div className="flex items-start gap-3" data-testid="owner-ai-db-setup">
          <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <h1 className="t-section break-keep text-slate-900">AI 작업실 DB 설정이 필요합니다</h1>
            <p className="t-sub mt-1 break-keep text-slate-600">
              Supabase SQL 편집기에서 <code className="rounded bg-slate-100 px-1">20261014000021_owner_ai_workspace.sql</code> 를 한 번 실행하면 대표 계정에만 AI 작업실이 열립니다(docs/OWNER_AI_WORKSPACE_V1.md · 수동 설정).
            </p>
          </div>
        </div>
      </Surface>
    )
  return (
    <Surface className="mx-auto max-w-xl">
      <div className="flex items-start gap-3" data-testid="owner-ai-denied">
        <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <h1 className="t-section break-keep text-slate-900">대표 전용 화면입니다</h1>
          <p className="t-sub mt-1 break-keep text-slate-600">이 계정에서는 열 수 없습니다.</p>
          <Link to="/" className="t-body mt-3 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
            오늘 화면으로
          </Link>
        </div>
      </div>
    </Surface>
  )
}

/* ---------------- 작은 부품 ---------------- */

export function TierBadge({ tier }: { tier: Tier }) {
  const tone = tier === 'deep' ? 'warning' : tier === 'manual' ? 'neutral' : 'brand'
  return <Badge tone={tone}>{TIER_LABEL[tier]}</Badge>
}

export const fmtDateTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const fmtUsd = (v: number | null) => (v == null ? '가격 미설정' : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`)

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/* ---------------- 짧은 글(Markdown 일부) — HTML 을 넣지 않고 글자로만 그린다 ---------------- */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  parts.forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) out.push(<strong key={`${key}-${i}`} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>)
    else if (p) out.push(p)
  })
  return out
}

export function Md({ text, className = '' }: { text: string; className?: string }) {
  const lines = (text ?? '').split('\n')
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = (k: number) => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`ul-${k}`} className="ml-4 list-disc space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="break-keep">{inline(b, `li-${k}-${i}`)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }
  lines.forEach((raw, i) => {
    const l = raw.trimEnd()
    if (/^\s*[-*]\s+/.test(l)) {
      bullets.push(l.replace(/^\s*[-*]\s+/, ''))
      return
    }
    flush(i)
    if (!l.trim()) return
    if (l.startsWith('### ')) blocks.push(<h4 key={i} className="t-card mt-2 font-bold break-keep text-slate-900">{inline(l.slice(4), `h4-${i}`)}</h4>)
    else if (l.startsWith('## ')) blocks.push(<h3 key={i} className="t-section break-keep text-slate-900">{inline(l.slice(3), `h3-${i}`)}</h3>)
    else if (l.startsWith('> ')) blocks.push(<p key={i} className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 break-keep text-warning-700">{inline(l.slice(2), `q-${i}`)}</p>)
    else blocks.push(<p key={i} className="break-keep">{inline(l, `p-${i}`)}</p>)
  })
  flush(lines.length)
  return <div className={`t-body flex flex-col gap-2 text-slate-700 ${className}`}>{blocks}</div>
}
