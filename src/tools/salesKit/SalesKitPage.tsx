/**
 * 영업 도구 모음 (D-91 → D-93) — 원본 영업 OS(corp-consult-sales-os · main)를 옮긴 것.
 *
 * D-93 부터 화면은 원본 App.jsx 를 그대로 쓴다(`orig/SalesApp.jsx`) — 글자·배치·색·계산까지.
 * 원본의 왼쪽 메뉴 14칸은 이 OS 의 모듈 목차 14칸과 같다. 화면을 고르면 주소가 바뀌고, 원본 안에서
 * 화면을 옮겨도(예: '미팅 준비로') 주소가 따라 바뀐다.
 *
 * 업체는 고객 운영 하나뿐이다 — 신규 고객·고객사를 등록할 때 고객 운영 업체를 고른다(orig/store.ts).
 * 첫 화면(오늘의 브리핑) 아래에는 고객 운영 업체와 연결된 모듈 대시보드가 붙는다.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { useToolClient } from '../shared/toolClientContext'
import SalesApp, { emptyData } from './orig/SalesApp.jsx'
import { hydrateSalesStore } from './orig/store'

/** 이 OS 목차 키 ↔ 원본 화면 키 (다른 것은 '미팅 준비' 하나뿐) */
const TO_TAB: Record<string, string> = { meeting: 'meetings' }
const TO_SECTION: Record<string, string> = { meetings: 'meeting' }

export function SalesKitPage() {
  const section = useModuleSection()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { loadClients, workspaceId, clientId } = useToolClient()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void loadClients()
      .then((list) => hydrateSalesStore({ workspaceId, clients: list, empty: emptyData }))
      .catch(() => undefined)
      .then(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId])

  if (!ready) return <p className="t-sub text-slate-400">영업 기록을 읽는 중…</p>

  const tab = TO_TAB[section] ?? section ?? 'briefing'
  const onTab = (t: string) => {
    const next = TO_SECTION[t] ?? t
    const qs = params.toString()
    void navigate(`/tools/sales-kit/${next}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <SalesApp tab={tab} onTab={onTab} focus={clientId ?? null} />
      {tab === 'briefing' && (
        <section className="flex flex-col gap-3" aria-label="고객 관리 업체와 연결">
          <h2 className="t-section text-slate-900">고객 관리 업체와 연결</h2>
          <ModuleDashboard toolKey="sales-kit" />
        </section>
      )}
    </div>
  )
}
