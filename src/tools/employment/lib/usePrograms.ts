/**
 * 지원금 종류 — 기본 15종 + 대표가 더한 것 (D-91).
 *
 * 규칙표(`programs.ts` 의 DEFAULT_PROGRAMS)는 **고치지 않는다.** 원본 그대로 두고,
 * "이건 안 쓴다(끄기)" 와 "우리가 쓰는 지원금을 하나 더한다" 만 모듈 기록으로 쌓는다.
 * 그래야 규칙표를 다시 옮겨 와도 대표가 손댄 것이 안 지워진다.
 *
 * 저장: moduleData 의 `employment` 상자, `programs` 갈래.
 *   - 기본 15종을 끄면   { programId, enabled:false }
 *   - 직접 더한 지원금은 { programId, enabled, custom: {...} }
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteRow, listRows, saveRow, type ModuleRow } from '../../../services/moduleData'
import { useToolClient } from '../../shared/toolClientContext'
import { DEFAULT_PROGRAMS, PROGRAM_LIST, type Program, type ProgramRound } from './programs'

const MODULE = 'employment'
const BUCKET = 'programs'

export interface ProgramView extends Program {
  /** 직원 넣는 칸에 보이는가 */
  enabled: boolean
  /** 대표가 직접 더한 것인가 */
  custom: boolean
  /** 모듈 기록의 줄 id (끄기·고치기에 쓴다). 손대지 않은 기본 지원금은 빈 글자 */
  rowId: string
}

export interface ProgramsStore {
  /** 아직 못 읽었으면 null */
  programs: ProgramView[] | null
  /** 켜져 있는 것만 — 직원 넣는 칸이 쓴다 */
  enabled: ProgramView[]
  setEnabled: (programId: string, on: boolean) => Promise<void>
  saveCustom: (input: CustomProgramInput) => Promise<void>
  removeCustom: (rowId: string) => Promise<void>
  /** 끈 것·고친 것을 전부 지우고 기본 15종 그대로 (직접 더한 것은 남는다) */
  resetBuiltins: () => Promise<void>
}

export interface CustomProgramInput {
  rowId?: string
  id?: string
  name: string
  year: number
  note: string
  applyUrl: string
  rounds: ProgramRound[]
}

function customProgram(input: CustomProgramInput, id: string): Program {
  const total = input.rounds.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return {
    id,
    name: input.name,
    year: input.year,
    group: '커스텀',
    color: '#475569',
    totalAmount: total,
    rounds: input.rounds.map((r, i) => ({
      month: Number(r.month) || 0,
      label: r.label || `${i + 1}회차`,
      amount: Number(r.amount) || 0,
    })),
    companyDocs: [],
    employeeDocs: [],
    isCustom: true,
    isBuiltIn: false,
    note: input.note,
    applyUrl: input.applyUrl,
    match: {
      cats: [],
      ageMin: null,
      ageMax: null,
      gender: 'any',
      empTypes: ['정규직', '계약직', '인턴', '대체인력'],
      preApply: false,
      companyMax: null,
      regionSensitive: false,
      bosuFloor: false,
    },
  }
}

function viewsOf(rows: ModuleRow[]): ProgramView[] {
  const out: ProgramView[] = []
  const byId = new Map<string, ModuleRow>()
  for (const row of rows) {
    const pid = typeof row.data.programId === 'string' ? row.data.programId : ''
    if (pid) byId.set(pid, row)
  }

  for (const p of PROGRAM_LIST) {
    const row = byId.get(p.id)
    out.push({
      ...p,
      enabled: row ? row.data.enabled !== false : true,
      custom: false,
      rowId: row?.id ?? '',
    })
  }

  for (const row of rows) {
    const custom = row.data.custom as Program | undefined
    if (!custom || typeof custom.id !== 'string') continue
    if (DEFAULT_PROGRAMS[custom.id]) continue
    out.push({ ...custom, enabled: row.data.enabled !== false, custom: true, rowId: row.id })
  }

  return out
}

export function usePrograms(): ProgramsStore {
  const { workspaceId } = useToolClient()
  const [rows, setRows] = useState<ModuleRow[] | null>(null)

  const load = useCallback(async () => {
    setRows(await listRows(workspaceId, MODULE, BUCKET))
  }, [workspaceId])

  useEffect(() => {
    let alive = true
    void listRows(workspaceId, MODULE, BUCKET).then((r) => {
      if (alive) setRows(r)
    })
    return () => {
      alive = false
    }
  }, [workspaceId])

  const programs = useMemo(() => (rows === null ? null : viewsOf(rows)), [rows])

  const setEnabledFn = useCallback(
    async (programId: string, on: boolean) => {
      const current = (rows ?? []).find((r) => r.data.programId === programId)
      await saveRow(workspaceId, MODULE, BUCKET, {
        id: current?.id,
        clientId: '',
        data: { ...(current?.data ?? {}), programId, enabled: on },
      })
      await load()
    },
    [rows, workspaceId, load],
  )

  const saveCustom = useCallback(
    async (input: CustomProgramInput) => {
      const id = input.id ?? `custom_${Date.now().toString(36)}`
      await saveRow(workspaceId, MODULE, BUCKET, {
        id: input.rowId,
        clientId: '',
        data: { programId: id, enabled: true, custom: customProgram(input, id) as unknown as Record<string, unknown> },
      })
      await load()
    },
    [workspaceId, load],
  )

  const removeCustom = useCallback(
    async (rowId: string) => {
      await deleteRow(workspaceId, MODULE, BUCKET, rowId)
      await load()
    },
    [workspaceId, load],
  )

  const resetBuiltins = useCallback(async () => {
    for (const row of rows ?? []) {
      if (row.data.custom) continue
      await deleteRow(workspaceId, MODULE, BUCKET, row.id)
    }
    await load()
  }, [rows, workspaceId, load])

  return {
    programs,
    enabled: (programs ?? []).filter((p) => p.enabled),
    setEnabled: setEnabledFn,
    saveCustom,
    removeCustom,
    resetBuiltins,
  }
}
