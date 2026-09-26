/**
 * 크레탑 분석기 (D-88) — corp-consult-sales-os 의 `cretop-engine` 을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 흐름: 크레탑 기업종합보고서 PDF 를 넣거나 원문을 붙여넣는다 → 엔진이 회사 정보·핵심 15개·3개년 추이·
 * 재무비율 5영역을 뽑는다 → 1차 미팅 포인트(원본 영업 OS 의 15개 규칙)를 만든다 → 업체 기록에 붙인다.
 *
 * 모든 수치는 '후보' 다 — 엔진이 그렇게 설계됐고(비단정 톤), 화면도 그 말을 지운다거나 바꾸지 않는다.
 * 골든 회귀 3벌(`npm run test:cretop`)이 원본과 같은 숫자를 지킨다. OCR 은 하지 않는다.
 */

import { useState } from 'react'
import { KanbanSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { ExtractorScreen } from './screens/ExtractorScreen'
import { CoreCheckScreen } from './screens/CoreCheckScreen'
import { Button } from '../../components/ui/Button'
import type { CretopMiniUi } from './mini/MiniApp.jsx'
import { CretopWorkbench } from './CretopWorkbench'
import { cretopCompany, findClientForCretop } from '../../services/salesCretop'
import { registerFromCretop } from '../../services/salesIntake'
import { useToast } from '../../components/ui/toastContext'
import { useToolClient } from '../shared/toolClientContext'

/**
 * 분석 화면 = 크레탑 분석기 작업대(CretopWorkbench) + 영업으로 넘기는 단추.
 * D-121: 분석기 본체 · 업체 연결은 작업대로 옮겼다(미팅 준비 1차도 같은 작업대를 쓴다). 영업 연결은 여기(바깥)에만 둔다.
 */
function CretopScreen() {
  const { clientRecord, clientName, loadClients, workspaceId } = useToolClient()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [salesBusy, setSalesBusy] = useState(false)

  /**
   * D-119: 분석 → 영업으로 한 번에. 이 업체로 열었으면 그 업체에, 아니면 같은 업체(사업자번호 · 이름)를 찾아 붙이고,
   * 없으면 잠재고객으로 새로 만든다 — 빈 기본 정보 · 영업 칸 · 도구 결과를 채우고 미팅 준비(1차)로 간다.
   */
  const toSales = async (ui: CretopMiniUi, selected: string[]) => {
    setSalesBusy(true)
    try {
      const existing = clientRecord ?? findClientForCretop(await loadClients(), cretopCompany(ui))
      const res = await registerFromCretop({ workspaceId, ui, existing, selected })
      showToast(`${res.created ? '잠재고객으로 등록했습니다' : `${res.record.companyName}에 붙였습니다`} — 기본 정보 ${res.filled.length}칸.`)
      for (const w of res.warnings) showToast(w)
      navigate(`/sales/meeting?client=${res.record.id}&round=1`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '영업으로 넘기지 못했습니다.')
    } finally {
      setSalesBusy(false)
    }
  }

  return (
    <CretopWorkbench
      actions={(ui, selected) => (
        <>
          <Button size="sm" variant="secondary" onClick={() => void toSales(ui, selected)} disabled={salesBusy} data-testid="cretop-to-sales">
            <KanbanSquare aria-hidden="true" className="size-4" />
            {salesBusy ? '넘기는 중…' : clientRecord ? `${clientName} 미팅 준비로` : '잠재고객 등록 · 미팅 준비'}
          </Button>
          <span className="t-meta break-keep text-slate-500">붙이기 = 업체 기록에 결과만 · 미팅 준비 = 빈 기본 정보 · 영업 칸까지 채우고 1차 미팅 준비로</span>
        </>
      )}
    />
  )
}

/* ------------------------------------------------------------------ */
/* 목차                                                                 */
/* ------------------------------------------------------------------ */

/** 목차에서 고른 화면 → 이 자리에 선다. 목차 자체는 `toolRegistry` 의 sections 가 정한다. */
export function CretopPage() {
  const section = useModuleSection()
  const meta = toolOf('cretop')?.sections?.find((s) => s.key === section)

  if (section === 'analyze') return <CretopScreen />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="크레탑 분석기"
        description={meta?.hint ? `${meta.label} — ${meta.hint}` : '크레탑 기업종합보고서를 넣으면 핵심 재무와 미팅 포인트를 뽑습니다.'}
      />
      {section === 'core-check' && <CoreCheckScreen />}
      {section === 'extractor' && <ExtractorScreen />}
      {section !== 'core-check' && section !== 'extractor' && <ModuleDashboard toolKey="cretop" />}
    </div>
  )
}
