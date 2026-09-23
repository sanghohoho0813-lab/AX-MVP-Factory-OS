/**
 * 연구개발활동조사 — 해마다 한 번, 안 내면 인정이 취소된다 (D-91).
 *
 * 원본(app/activity-survey)의 흐름을 옮겼다: 업체별·연도별 제출 상태와 이력, 요청 문구.
 * 조사 자체는 국가 시스템에서 낸다 — 여기서는 **누가 아직 안 냈는지**를 놓치지 않는 것이 일이다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { currentYear } from '../lib/labTasks'
import { surveyRequestText } from '../lib/surveyText'
import type { LabInfoData } from '../lib/labInfo'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

export type SurveyStatus = '미제출' | '자료 요청함' | '작성중' | '제출 완료'

const STATUSES: readonly SurveyStatus[] = ['미제출', '자료 요청함', '작성중', '제출 완료']

const STATUS_TONE: Record<SurveyStatus, Tone> = {
  미제출: 'danger',
  '자료 요청함': 'warning',
  작성중: 'brand',
  '제출 완료': 'success',
}

interface SurveyData extends Record<string, unknown> {
  year: number
  status: SurveyStatus
  submittedAt: string
  memo: string
}

export function SurveyScreen() {
  const { loadClients, clientId } = useToolClient()
  const { showToast } = useToast()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const surveys = useModuleBucket<SurveyData>('labcare', 'surveys')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [year, setYear] = useState(currentYear())
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const rowOf = useMemo(() => {
    const map = new Map<string, { id: string; data: SurveyData }>()
    for (const r of surveys.rows ?? []) {
      if (Number(r.data.year) !== year) continue
      map.set(r.clientId, { id: r.id, data: r.data })
    }
    return map
  }, [surveys.rows, year])

  if (clients === null || info.rows === null || surveys.rows === null) {
    return <p className="t-sub text-slate-400">활동조사 기록을 읽는 중…</p>
  }

  // 연구소 정보를 적어 둔 업체만 본다 — 연구소가 없는 업체는 이 조사의 대상이 아니다
  const watched = clients.filter((c) => info.rows?.some((r) => r.clientId === c.id))
  const shown = clientId ? watched.filter((c) => c.id === clientId) : watched
  const submitted = watched.filter((c) => rowOf.get(c.id)?.data.status === '제출 완료')

  const setStatus = async (client: ClientOpsRecord, status: SurveyStatus) => {
    const cur = rowOf.get(client.id)
    await surveys.save({
      id: cur?.id,
      clientId: client.id,
      data: {
        year,
        status,
        submittedAt: status === '제출 완료' ? new Date().toISOString().slice(0, 10) : (cur?.data.submittedAt ?? ''),
        memo: cur?.data.memo ?? '',
      },
    })
  }

  const setMemo = async (client: ClientOpsRecord, memo: string) => {
    const cur = rowOf.get(client.id)
    await surveys.save({
      id: cur?.id,
      clientId: client.id,
      data: { year, status: cur?.data.status ?? '미제출', submittedAt: cur?.data.submittedAt ?? '', memo },
    })
  }

  const copyRequest = async (client: ClientOpsRecord) => {
    try {
      await navigator.clipboard.writeText(surveyRequestText(client.companyName, year))
      setCopied(client.id)
      window.setTimeout(() => setCopied(''), 1500)
      showToast('요청 문구를 복사했습니다.')
    } catch {
      showToast('복사하지 못했습니다. 화면의 글을 직접 긁어 주세요.')
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lab-survey">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="대상 연구소" value={`${watched.length}곳`} hint="연구소 정보를 적은 업체" />
        <MetricTile label={`${year} 제출 완료`} value={`${submitted.length}곳`} tone={submitted.length > 0 ? 'success' : 'neutral'} />
        <MetricTile
          label="아직 안 낸 곳"
          value={`${watched.length - submitted.length}곳`}
          tone={watched.length - submitted.length > 0 ? 'danger' : 'success'}
          hint="미제출은 인정 취소 사유"
        />
        <MetricTile label="조사 연도" value={`${year}년`} />
      </div>

      <label className="flex flex-wrap items-center gap-2">
        <span className="t-sub font-medium text-slate-600">연도</span>
        <input
          type="number"
          aria-label="조사 연도"
          value={year}
          onChange={(e) => setYear(Number(e.target.value) || currentYear())}
          className="w-28 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 t-sub tabular-nums text-slate-800"
        />
      </label>

      {watched.length === 0 ? (
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600">
            연구소 정보를 적은 업체가 없습니다.{' '}
            <Link to="/tools/labcare/clients" className="font-bold text-brand-700 hover:underline">
              연구소 고객사
            </Link>{' '}
            에서 먼저 적어 주세요.
          </p>
        </Surface>
      ) : (
        <Section title={`${year}년 연구개발활동조사`} count={shown.length}>
          <ul className="flex flex-col gap-2" data-testid="lab-survey-list">
            {shown.map((c) => {
              const row = rowOf.get(c.id)
              const status = row?.data.status ?? '미제출'
              return (
                <li key={c.id}>
                  <Surface as="div" edge={STATUS_TONE[status]} showEdge>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                        {row?.data.submittedAt && <span className="t-meta text-slate-500">제출 {row.data.submittedAt}</span>}
                        <span className="ml-auto flex items-center gap-2">
                          <select
                            aria-label={`${c.companyName} 제출 상태`}
                            value={status}
                            onChange={(e) => void setStatus(c, e.target.value as SurveyStatus)}
                            data-client={c.id}
                            className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1 t-meta text-slate-700"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <Button variant="ghost" size="sm" onClick={() => void copyRequest(c)}>
                            {copied === c.id ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                            자료 요청 문구
                          </Button>
                        </span>
                      </div>
                      <input
                        aria-label={`${c.companyName} 메모`}
                        defaultValue={row?.data.memo ?? ''}
                        onBlur={(e) => void setMemo(c, e.target.value)}
                        placeholder="메모 (연락한 날, 남은 자료 등)"
                        className={inputCls}
                      />
                    </div>
                  </Surface>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}
