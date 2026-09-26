/**
 * 크레탑 한 번으로 잠재고객 등록 (D-119).
 *
 * 크레탑 보고서를 넣으면 — 분석 → 고객 기록(새로 만들거나 같은 업체에 붙이기) → 기본 정보 · 영업 칸 채우기 →
 * 도구 결과(크레탑 분석) 붙이기 → 크레탑 분석 이력에 이 업체로 남기기 → (클라우드면) 서류함에 보고서 파일 올리기.
 * 1차 미팅 날짜를 적으면 '1차 미팅 예정' 으로 옮기고 다음 할 일에 넣는다.
 *
 * 저장 순서가 중요하다: 고객 기록을 먼저 저장하고, 이력 · 파일은 실패해도 등록은 남긴다(알려만 준다).
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { canUploadFiles, createClient, saveClient, uploadDocumentFile, withToolResult } from './clientOpsService'
import { listRows, saveRow } from './moduleData'
import { applyCretopToClient, cretopResultInput, digestCretop } from './salesCretop'
import { salesStageOf, withSalesStage } from './salesPipeline'
import type { CretopMiniUi } from '../tools/cretop/mini/MiniApp.jsx'

export interface CretopIntakeInput {
  workspaceId: string | null
  ui: CretopMiniUi
  /** 붙일 업체 — 없으면 새로 만든다 */
  existing: ClientOpsRecord | null
  source?: string
  contactName?: string
  contactPhone?: string
  /** 1차 미팅 날짜 (YYYY-MM-DD) — 비우면 잠재 고객 그대로 */
  meetingDate?: string
  /** 올린 보고서 파일 — PDF 면 서류함 '크레탑 기업종합보고서' 칸에 올린다(클라우드일 때만) */
  file?: File | null
  /** 크레탑 분석기에서 '최종 선택' 한 항목 */
  selected?: string[]
  at?: string
}

export interface CretopIntakeResult {
  record: ClientOpsRecord
  created: boolean
  filled: string[]
  /** 서류함에 파일을 올렸는가 */
  uploaded: boolean
  /** 등록은 됐지만 따로 실패한 것 (이력 · 파일) */
  warnings: string[]
}

/** 크레탑 분석 이력(cretop/analyses)에 이 업체로 남긴다 — 크레탑 분석기 '분석 이력' 에 그대로 뜬다 */
async function saveCretopHistory(workspaceId: string | null, clientId: string, ui: CretopMiniUi, at: string): Promise<void> {
  const co = ui.companyInfo ?? {}
  const company = co.companyName || '기업명 미상'
  const bizNo = co.businessNo || ''
  const rows = await listRows(workspaceId, 'cretop', 'analyses')
  const prev = rows.find((r) => (bizNo && r.data.bizNo === bizNo) || r.data.company === company)
  await saveRow(workspaceId, 'cretop', 'analyses', {
    id: prev?.id,
    clientId,
    data: { company, bizNo, ts: at, ui, sv: (prev?.data.sv as unknown) ?? null },
  })
}

export async function registerFromCretop(input: CretopIntakeInput): Promise<CretopIntakeResult> {
  const at = input.at ?? new Date().toISOString()
  const d = digestCretop(input.ui)
  const warnings: string[] = []
  const created = input.existing === null
  let base =
    input.existing ??
    (await createClient(input.workspaceId, {
      companyName: d.company.name || '회사 이름 확인 필요',
      contactName: input.contactName ?? '',
      contactPhone: input.contactPhone ?? '',
      businessNumber: d.company.bizNo,
      status: 'waiting',
    }))
  if (!created) {
    if (base.contactName.trim() === '' && input.contactName) base = { ...base, contactName: input.contactName.trim() }
    if (base.contactPhone.trim() === '' && input.contactPhone) base = { ...base, contactPhone: input.contactPhone.trim() }
  }
  const applied = applyCretopToClient(base, d, { at, source: input.source ?? '' })
  let record = withToolResult(applied.record, { ...cretopResultInput(input.ui, input.selected ?? []), createdAt: at })
  const date = (input.meetingDate ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    record = { ...record, nextAction: '1차 미팅', nextActionDueDate: date }
    if (salesStageOf(record) === 'lead') record = withSalesStage(record, 'm1sched', at)
  }
  let saved = await saveClient(record)

  try {
    await saveCretopHistory(input.workspaceId, saved.id, input.ui, at)
  } catch (e) {
    warnings.push(`크레탑 분석 이력 저장 실패 — ${e instanceof Error ? e.message : '오류'}`)
  }

  let uploaded = false
  const f = input.file
  if (f && /\.pdf$/i.test(f.name) && canUploadFiles()) {
    try {
      saved = await uploadDocumentFile(saved, 'cretopReport', f)
      uploaded = true
    } catch (e) {
      warnings.push(`서류함에 보고서 올리기 실패 — ${e instanceof Error ? e.message : '오류'}`)
    }
  }
  return { record: saved, created, filled: applied.filled, uploaded, warnings }
}
