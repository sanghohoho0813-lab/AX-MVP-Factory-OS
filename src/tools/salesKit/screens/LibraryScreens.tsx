/**
 * 영업 자료 — 콘텐츠 전략 · 교육 아카이브 · 법령·공고 · 리포트 · 설정 (D-91).
 *
 * 원본의 '자료' 묶음을 옮긴 것이다. 공통점은 **자료 하나가 고객 연락거리로 이어진다**는 것 —
 * 그래서 교육·법령 화면은 그 주제에 관심을 표시해 둔 업체를 함께 보여 준다(영업 상태의 관심사).
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import { ModuleBackup } from '../../shared/ModuleBackup'
import { ToolResultAttach } from '../../shared/ToolResultAttach'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { todayLocalDate } from '../../../lib/appClock'
import { CONTENT_SEEDS, benchmarkTitles, channelTexts, type ContentSeed } from '../lib/contentSeeds'
import { INTERESTS, toAccount, type AccountData } from '../lib/salesAccounts'
import { STAGE_LABEL } from '../lib/pipeline'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/** 이 주제에 관심 있는 업체 — 영업 상태의 관심사와 겹치는 곳 */
function useInterested(topic: string) {
  const { loadClients } = useToolClient()
  const accounts = useModuleBucket<AccountData>('sales-kit', 'accounts')
  const [clients, setClients] = useState<ClientOpsRecord[]>([])

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  return useMemo(() => {
    if (!topic) return []
    return (accounts.rows ?? [])
      .map((r) => ({ clientId: r.clientId, data: toAccount(r.data) }))
      .filter((r) => r.data.interests.some((i) => i === topic || topic.includes(i) || i.includes(topic)))
      .map((r) => ({
        clientId: r.clientId,
        name: clients.find((c) => c.id === r.clientId)?.companyName ?? '업체',
        stage: r.data.stage,
      }))
  }, [accounts.rows, clients, topic])
}

function InterestedList({ topic }: { topic: string }) {
  const list = useInterested(topic)
  if (list.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2" data-testid="sales-interested">
      <span className="t-meta text-slate-500">이 주제에 관심 있는 업체</span>
      {list.map((c) => (
        <Link
          key={c.clientId}
          to={`/tools/sales-kit/companies`}
          className="t-meta inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700 hover:bg-brand-100"
        >
          {c.name} · {STAGE_LABEL[c.stage]}
        </Link>
      ))}
    </div>
  )
}

function CopyLine({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1 rounded-(--radius-panel) bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="t-meta font-bold text-slate-500">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            } catch {
              /* 복사 못 하면 화면에서 긁는다 */
            }
          }}
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? '복사됨' : '복사'}
        </Button>
      </div>
      <p className="t-sub whitespace-pre-wrap break-keep text-slate-700">{text}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ① 콘텐츠 전략                                                        */
/* ------------------------------------------------------------------ */

export function ContentScreen() {
  const [picked, setPicked] = useState<ContentSeed>(CONTENT_SEEDS[0])
  const [bench, setBench] = useState('')
  const titles = benchmarkTitles(bench)

  return (
    <div className="flex flex-col gap-5" data-testid="sales-content">
      <Section title="콘텐츠 주제" count={CONTENT_SEEDS.length}>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_SEEDS.map((s) => (
            <button
              key={s.cat}
              type="button"
              aria-pressed={picked.cat === s.cat}
              data-topic={s.cat}
              onClick={() => setPicked(s)}
              className={`tap rounded-full border px-2.5 py-1 t-meta font-medium ${
                picked.cat === s.cat ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {s.cat}
            </button>
          ))}
        </div>
      </Section>

      <Surface>
        <div className="flex flex-col gap-3">
          <p className="t-card font-bold break-keep text-slate-900" data-testid="sales-content-title">
            {picked.title}
          </p>
          <p className="t-meta break-keep text-slate-500">대상 — {picked.target}</p>
          {channelTexts(picked).map((c) => (
            <CopyLine key={c.channel} label={c.channel} text={c.text} />
          ))}
          <InterestedList topic={picked.cat} />
        </div>
      </Surface>

      <Section title="벤치마킹 변환">
        <Surface>
          <div className="flex flex-col gap-2">
            <p className="t-sub break-keep text-slate-600">
              경쟁 콘텐츠 제목을 붙여넣으면 <b>단정하지 않는 제목 후보</b>로 바꿔 줍니다.
            </p>
            <textarea
              aria-label="벤치마킹 문구"
              rows={2}
              value={bench}
              onChange={(e) => setBench(e.target.value)}
              placeholder="예: 직원 먼저 뽑으면 지원금 못 받습니다"
              className={inputCls}
            />
            {titles.length > 0 && (
              <ul className="flex flex-col gap-1.5" data-testid="sales-bench">
                {titles.map((t) => (
                  <li key={t}>
                    <CopyLine label="제목 후보" text={t} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Surface>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ② 교육 아카이브                                                      */
/* ------------------------------------------------------------------ */

interface EducationData extends Record<string, unknown> {
  field: string
  title: string
  date: string
  takeaway: string
}

const EDUCATION_FIELDS: readonly string[] = [
  '가업승계',
  '가지급금',
  '미처분이익잉여금',
  '정관정비',
  '법인세',
  '종소세',
  '세액공제',
  '법인보험',
  '정책자금',
  '고용지원금',
  '인증',
  '판례/예규',
  '기타',
]

export function EducationScreen() {
  const items = useModuleBucket<EducationData>('sales-kit', 'education')
  const { showToast } = useToast()
  const [form, setForm] = useState<EducationData>({ field: EDUCATION_FIELDS[0], title: '', date: todayLocalDate(), takeaway: '' })

  if (items.rows === null) return <p className="t-sub text-slate-400">교육 기록을 읽는 중…</p>

  const rows = [...items.rows].sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)))

  return (
    <div className="flex flex-col gap-5" data-testid="sales-education">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="교육 기록" value={`${rows.length}건`} />
        <MetricTile label="올해" value={`${rows.filter((r) => String(r.data.date).startsWith(String(new Date().getFullYear()))).length}건`} />
        <MetricTile label="분야" value={`${new Set(rows.map((r) => r.data.field)).size}개`} />
      </div>

      <Section title="교육 기록 남기기">
        <Surface>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">분야</span>
                <select aria-label="교육 분야" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} className={`mt-1 ${inputCls}`}>
                  {EDUCATION_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="t-sub font-medium text-slate-600">교육 제목</span>
                <input aria-label="교육 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
            </div>
            <label className="block">
              <span className="t-sub font-medium text-slate-600">상담에 쓸 한 줄</span>
              <textarea
                aria-label="상담에 쓸 한 줄"
                rows={2}
                value={form.takeaway}
                onChange={(e) => setForm({ ...form, takeaway: e.target.value })}
                placeholder="배운 것 중 고객에게 그대로 말할 수 있는 문장"
                className={`mt-1 ${inputCls}`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="교육 날짜"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 t-sub text-slate-800"
              />
              <Button
                variant="primary"
                data-testid="sales-education-save"
                onClick={async () => {
                  if (!form.title.trim()) {
                    showToast('교육 제목을 적어 주세요.')
                    return
                  }
                  await items.save({ data: { ...form, title: form.title.trim() } })
                  setForm({ field: form.field, title: '', date: todayLocalDate(), takeaway: '' })
                  showToast('교육 기록을 남겼습니다.')
                }}
              >
                <Plus aria-hidden="true" className="size-4" /> 남기기
              </Button>
            </div>
          </div>
        </Surface>
      </Section>

      {rows.length > 0 && (
        <Section title="쌓인 교육" count={rows.length}>
          <ul className="flex flex-col gap-2" data-testid="sales-education-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Surface as="div">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{r.data.field}</Badge>
                      <span className="t-sub font-bold text-slate-900">{r.data.title}</span>
                      <span className="t-meta text-slate-500">{r.data.date}</span>
                      <Button variant="ghost" size="sm" className="ml-auto" aria-label="교육 기록 지우기" onClick={() => void items.remove(r.id)}>
                        <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                      </Button>
                    </div>
                    {r.data.takeaway && <p className="t-sub break-keep text-slate-600">{r.data.takeaway}</p>}
                    <InterestedList topic={r.data.field} />
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ③ 법령·공고                                                          */
/* ------------------------------------------------------------------ */

interface UpdateData extends Record<string, unknown> {
  source: string
  field: string
  title: string
  date: string
  summary: string
}

const UPDATE_SOURCES: readonly string[] = ['국세청', '법제처', '조세심판원', '대법원', '기업마당', '고용노동부', '중기부', '중진공', '기타']

export function UpdatesScreen() {
  const items = useModuleBucket<UpdateData>('sales-kit', 'updates')
  const { showToast } = useToast()
  const [form, setForm] = useState<UpdateData>({ source: UPDATE_SOURCES[0], field: INTERESTS[0], title: '', date: todayLocalDate(), summary: '' })

  if (items.rows === null) return <p className="t-sub text-slate-400">법령·공고를 읽는 중…</p>

  const rows = [...items.rows].sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)))

  return (
    <div className="flex flex-col gap-5" data-testid="sales-updates">
      <Section title="법령·공고 넣기">
        <Surface>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">출처</span>
                <select aria-label="출처" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={`mt-1 ${inputCls}`}>
                  {UPDATE_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">주제</span>
                <select aria-label="주제" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} className={`mt-1 ${inputCls}`}>
                  {INTERESTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">날짜</span>
                <input type="date" aria-label="공고 날짜" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
            </div>
            <label className="block">
              <span className="t-sub font-medium text-slate-600">제목</span>
              <input aria-label="공고 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="t-sub font-medium text-slate-600">고객에게 할 말 한 줄</span>
              <textarea aria-label="공고 요약" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <div>
              <Button
                variant="primary"
                data-testid="sales-update-save"
                onClick={async () => {
                  if (!form.title.trim()) {
                    showToast('제목을 적어 주세요.')
                    return
                  }
                  await items.save({ data: { ...form, title: form.title.trim() } })
                  setForm({ source: form.source, field: form.field, title: '', date: todayLocalDate(), summary: '' })
                  showToast('법령·공고를 넣었습니다.')
                }}
              >
                <Plus aria-hidden="true" className="size-4" /> 넣기
              </Button>
            </div>
          </div>
        </Surface>
      </Section>

      {rows.length > 0 && (
        <Section title="쌓인 법령·공고" count={rows.length}>
          <ul className="flex flex-col gap-2" data-testid="sales-update-list">
            {rows.map((r) => (
              <li key={r.id}>
                <Surface as="div">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{r.data.source}</Badge>
                      <Badge tone="brand">{r.data.field}</Badge>
                      <span className="t-sub font-bold text-slate-900">{r.data.title}</span>
                      <span className="t-meta text-slate-500">{r.data.date}</span>
                      <Button variant="ghost" size="sm" className="ml-auto" aria-label="공고 지우기" onClick={() => void items.remove(r.id)}>
                        <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                      </Button>
                    </div>
                    {r.data.summary && <p className="t-sub break-keep text-slate-600">{r.data.summary}</p>}
                    <CopyLine
                      label="연락 문구"
                      text={`대표님, ${r.data.field} 관련해서 ${r.data.source} 쪽에 이런 변화가 있었습니다.\n\n${r.data.title}\n${r.data.summary}\n\n대표님 회사에 해당되는지 한 번 같이 보시면 좋을 것 같습니다.`}
                    />
                    <InterestedList topic={r.data.field} />
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ⑤ 설정·백업                                                          */
/* ------------------------------------------------------------------ */

const SALES_BUCKETS = ['accounts', 'education', 'updates'] as const

export function SalesSettingsScreen() {
  const accounts = useModuleBucket<AccountData>('sales-kit', 'accounts')
  const education = useModuleBucket<EducationData>('sales-kit', 'education')
  const updates = useModuleBucket<UpdateData>('sales-kit', 'updates')

  return (
    <div className="flex flex-col gap-5" data-testid="sales-settings">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="영업 중인 업체" value={`${accounts.rows?.length ?? 0}곳`} />
        <MetricTile label="교육 기록" value={`${education.rows?.length ?? 0}건`} />
        <MetricTile label="법령·공고" value={`${updates.rows?.length ?? 0}건`} />
      </div>

      <Section title="백업">
        <ModuleBackup
          moduleKey="sales-kit"
          buckets={SALES_BUCKETS}
          label="영업"
          onRestored={() => {
            void accounts.reload()
            void education.reload()
            void updates.reload()
          }}
        />
      </Section>

      <Section title="이 모듈이 지키는 것">
        <Surface>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 t-sub text-slate-600">
            <li>업체 명단은 이 모듈이 따로 갖지 않습니다 — 고객 운영의 업체를 그대로 씁니다.</li>
            <li>미팅 대본·전략 추천은 규칙표로 만듭니다. 외부 AI 를 부르지 않습니다.</li>
            <li>세무사 검토가 필요한 전략은 그렇게 표시합니다 — 단정하지 않습니다.</li>
          </ul>
        </Surface>
      </Section>
    </div>
  )
}

/** 리포트 화면에서 쓰는 붙이기 — 도구 결과를 업체 기록으로 */
export function SalesAttach({ clientId, title, summary }: { clientId: string; title: string; summary: string }) {
  return (
    <ToolResultAttach
      toolKey="sales-kit"
      title={title}
      verdict={null}
      verdictLabel=""
      summary={summary}
      data={{ tab: 'reports', clientId }}
      presetClientId={clientId}
    />
  )
}
