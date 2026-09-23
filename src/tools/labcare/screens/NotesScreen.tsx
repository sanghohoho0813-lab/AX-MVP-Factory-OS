/**
 * 연구노트 — 달마다 한 장 (D-91).
 *
 * 연구소를 지키는 것은 인정서가 아니라 **매달 쌓인 연구노트**다. 실사에서 첫 번째로 본다.
 * 원본(ccs-post-management · app/notes)의 흐름을 그대로 옮겼다:
 *   업체·과제·달을 고른다 → 네 칸을 적는다 → 초안을 만든다 → 실사 관점으로 보완한다 → 저장한다.
 *
 * **AI 를 부르지 않는다.** 초안은 적은 것을 실사에서 읽히는 순서로 다시 놓는 규칙일 뿐이다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import {
  checkRelevance,
  currentMonth,
  enhanceForAudit,
  generateNoteDraft,
  NOTE_STATUSES,
  type NoteStatus,
  type ResearcherRole,
} from '../lib/noteDraft'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

interface ProjectData extends Record<string, unknown> {
  name: string
  productService: string
  startDate: string
  status: '진행중' | '완료' | '중단'
}

interface NoteData extends Record<string, unknown> {
  projectId: string
  month: string
  activities: string
  tests: string
  problems: string
  nextPlan: string
  roles: ResearcherRole[]
  relevance: string
  draft: string
  status: NoteStatus
  auditReviewed: boolean
}

const NOTE_TONE: Record<NoteStatus, Tone> = {
  '작성 필요': 'warning',
  작성중: 'neutral',
  '초안 완료': 'brand',
  '실사보완 완료': 'brand',
  '저장 완료': 'success',
}

function emptyNote(projectId: string, month: string): NoteData {
  return {
    projectId,
    month,
    activities: '',
    tests: '',
    problems: '',
    nextPlan: '',
    roles: [{ name: '', role: '' }],
    relevance: '',
    draft: '',
    status: '작성 필요',
    auditReviewed: false,
  }
}

export function NotesScreen() {
  const { loadClients, clientId } = useToolClient()
  const { showToast } = useToast()
  const projects = useModuleBucket<ProjectData>('labcare', 'projects')
  const notes = useModuleBucket<NoteData>('labcare', 'notes')

  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [pickedClient, setPickedClient] = useState(clientId ?? '')
  const [pickedProject, setPickedProject] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [form, setForm] = useState<NoteData | null>(null)
  const [newProject, setNewProject] = useState<{ name: string; productService: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      const live = list.filter((c) => c.archivedAt === null)
      if (!alive) return
      setClients(live)
      setPickedClient((cur) => cur || live[0]?.id || '')
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const clientProjects = useMemo(
    () => (projects.rows ?? []).filter((p) => p.clientId === pickedClient),
    [projects.rows, pickedClient],
  )

  useEffect(() => {
    setPickedProject((cur) => (clientProjects.some((p) => p.id === cur) ? cur : clientProjects[0]?.id ?? ''))
  }, [clientProjects])

  const existing = useMemo(
    () => (notes.rows ?? []).find((n) => n.clientId === pickedClient && n.data.projectId === pickedProject && n.data.month === month),
    [notes.rows, pickedClient, pickedProject, month],
  )

  useEffect(() => {
    setForm(existing ? { ...existing.data } : pickedProject ? emptyNote(pickedProject, month) : null)
  }, [existing, pickedProject, month])

  if (projects.rows === null || notes.rows === null) {
    return <p className="t-sub text-slate-400">연구노트를 읽는 중…</p>
  }

  const client = clients.find((c) => c.id === pickedClient)
  const project = clientProjects.find((p) => p.id === pickedProject)

  const set = <K extends keyof NoteData>(k: K, v: NoteData[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const makeDraft = () => {
    if (!form || !project || !client) return
    const draft = generateNoteDraft(form, client.companyName, project.data)
    setForm({ ...form, draft, status: '초안 완료' })
    showToast('초안을 만들었습니다. 사실과 다른 곳은 고쳐 주세요.')
  }

  const auditEnhance = () => {
    if (!form || !project) return
    if (!form.draft) {
      showToast('먼저 초안을 만들어 주세요.')
      return
    }
    setForm({ ...form, draft: enhanceForAudit(form.draft, project.data), status: '실사보완 완료', auditReviewed: true })
  }

  const saveNote = async () => {
    if (!form || !pickedProject) return
    await notes.save({ id: existing?.id, clientId: pickedClient, data: { ...form, status: '저장 완료' } })
    showToast('연구노트를 저장했습니다.')
  }

  const copyDraft = async () => {
    if (!form?.draft) return
    try {
      await navigator.clipboard.writeText(form.draft)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 긁는다 */
    }
  }

  const relevance = form && project ? checkRelevance(form, project.data) : null
  const monthNotes = (notes.rows ?? []).filter((n) => n.data.month === month)
  const done = monthNotes.filter((n) => n.data.status === '저장 완료').length

  return (
    <div className="flex flex-col gap-5" data-testid="lab-notes">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="업체" value={`${clients.length}곳`} hint="고객 운영에 있는 업체" />
        <MetricTile label="연구과제" value={`${(projects.rows ?? []).length}개`} />
        <MetricTile label={`${month} 노트`} value={`${monthNotes.length}장`} />
        <MetricTile label="이번 달 저장 완료" value={`${done}장`} tone={done > 0 ? 'success' : 'warning'} />
      </div>

      <Surface>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">업체</span>
            <select aria-label="업체" value={pickedClient} onChange={(e) => setPickedClient(e.target.value)} className={`mt-1 ${inputCls}`}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">연구과제</span>
            <select aria-label="연구과제" value={pickedProject} onChange={(e) => setPickedProject(e.target.value)} className={`mt-1 ${inputCls}`}>
              {clientProjects.length === 0 && <option value="">과제 없음</option>}
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">대상 월</span>
            <input type="month" aria-label="대상 월" value={month} onChange={(e) => setMonth(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Button variant="ghost" size="sm" onClick={() => setNewProject({ name: '', productService: '' })} data-testid="lab-project-add">
            <Plus aria-hidden="true" className="size-4" /> 연구과제 만들기
          </Button>
          {project && (
            <>
              <Badge tone="neutral">{project.data.status}</Badge>
              <span className="t-meta text-slate-500">{project.data.productService || '제품·서비스 미입력'}</span>
              <Button variant="ghost" size="sm" onClick={() => void projects.remove(project.id)} aria-label="연구과제 지우기">
                <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
              </Button>
            </>
          )}
          {client && (
            <Link to={`/ops/clients/${client.id}`} className="t-meta ml-auto text-brand-700 hover:underline">
              업체 기록 보기
            </Link>
          )}
        </div>
      </Surface>

      {newProject && (
        <Surface>
          <div className="flex flex-col gap-3">
            <span className="t-section text-slate-900">연구과제 만들기</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">과제명</span>
                <input aria-label="과제명" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">제품·서비스와의 연결 (실사 핵심)</span>
                <input
                  aria-label="제품 서비스"
                  value={newProject.productService}
                  onChange={(e) => setNewProject({ ...newProject, productService: e.target.value })}
                  className={`mt-1 ${inputCls}`}
                  placeholder="예: 자동차 부품 열처리 공정"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="lab-project-save"
                onClick={async () => {
                  if (!newProject.name.trim()) {
                    showToast('과제명을 적어 주세요.')
                    return
                  }
                  const row = await projects.save({
                    clientId: pickedClient,
                    data: {
                      name: newProject.name.trim(),
                      productService: newProject.productService.trim(),
                      startDate: new Date().toISOString().slice(0, 10),
                      status: '진행중',
                    },
                  })
                  setPickedProject(row.id)
                  setNewProject(null)
                  showToast('연구과제를 만들었습니다.')
                }}
              >
                저장
              </Button>
              <Button variant="ghost" onClick={() => setNewProject(null)}>
                그만두기
              </Button>
            </div>
          </div>
        </Surface>
      )}

      {!project ? (
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600">
            이 업체에는 아직 연구과제가 없습니다. 위의 <b>연구과제 만들기</b> 로 하나를 만들면 달마다 연구노트를 쌓을 수 있습니다.
          </p>
        </Surface>
      ) : (
        form && (
          <>
            <Section title={`${month} 연구노트`} action={<Badge tone={NOTE_TONE[form.status]}>{form.status}</Badge>}>
              <Surface>
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span className="t-sub font-medium text-slate-600">이번 달 연구개발 활동</span>
                    <textarea aria-label="연구활동" rows={3} value={form.activities} onChange={(e) => set('activities', e.target.value)} className={`mt-1 ${inputCls}`} />
                  </label>
                  <label className="block">
                    <span className="t-sub font-medium text-slate-600">테스트·개선</span>
                    <textarea aria-label="테스트 개선" rows={2} value={form.tests} onChange={(e) => set('tests', e.target.value)} className={`mt-1 ${inputCls}`} />
                  </label>
                  <label className="block">
                    <span className="t-sub font-medium text-slate-600">확인된 문제점</span>
                    <textarea aria-label="문제점" rows={2} value={form.problems} onChange={(e) => set('problems', e.target.value)} className={`mt-1 ${inputCls}`} />
                  </label>
                  <label className="block">
                    <span className="t-sub font-medium text-slate-600">다음 달 계획</span>
                    <textarea aria-label="다음 계획" rows={2} value={form.nextPlan} onChange={(e) => set('nextPlan', e.target.value)} className={`mt-1 ${inputCls}`} />
                  </label>
                  <label className="block">
                    <span className="t-sub font-medium text-slate-600">업종·제품·서비스와의 직접 관련성</span>
                    <textarea aria-label="관련성" rows={2} value={form.relevance} onChange={(e) => set('relevance', e.target.value)} className={`mt-1 ${inputCls}`} />
                  </label>

                  <div className="flex flex-col gap-2">
                    <span className="t-sub font-medium text-slate-600">참여 연구원별 역할</span>
                    {form.roles.map((r, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2">
                        <input
                          aria-label={`${i + 1}번째 연구원 이름`}
                          value={r.name}
                          onChange={(e) => set('roles', form.roles.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)))}
                          className={inputCls}
                          placeholder="이름"
                        />
                        <input
                          aria-label={`${i + 1}번째 연구원 역할`}
                          value={r.role}
                          onChange={(e) => set('roles', form.roles.map((x, j) => (i === j ? { ...x, role: e.target.value } : x)))}
                          className={inputCls}
                          placeholder="맡은 일"
                        />
                        <Button variant="ghost" size="sm" aria-label={`${i + 1}번째 연구원 지우기`} onClick={() => set('roles', form.roles.filter((_, j) => j !== i))}>
                          <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => set('roles', form.roles.concat([{ name: '', role: '' }]))}>
                      <Plus aria-hidden="true" className="size-4" /> 연구원 더하기
                    </Button>
                  </div>

                  {relevance && !relevance.ok && (
                    <Surface edge="warning" showEdge>
                      <ul className="flex list-disc flex-col gap-1 pl-5 t-meta text-amber-700" data-testid="lab-note-hints">
                        {relevance.hints.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </Surface>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={makeDraft} data-testid="lab-note-draft">
                      <Sparkles aria-hidden="true" className="size-4" /> 초안 만들기
                    </Button>
                    <Button variant="ghost" onClick={auditEnhance} data-testid="lab-note-audit">
                      실사 관점으로 보완
                    </Button>
                    <Button variant="ghost" onClick={() => void saveNote()} data-testid="lab-note-save">
                      저장
                    </Button>
                    <select
                      aria-label="노트 상태"
                      value={form.status}
                      onChange={(e) => set('status', e.target.value as NoteStatus)}
                      className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1 t-meta text-slate-700"
                    >
                      {NOTE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="t-meta break-keep text-slate-400">
                    초안은 적은 것을 실사에서 읽히는 순서로 다시 놓은 것입니다. 외부 AI 를 부르지 않습니다 — 사실과 다른 곳은 반드시 고쳐 주세요.
                  </p>
                </div>
              </Surface>
            </Section>

            {form.draft && (
              <Section
                title="연구노트 초안"
                action={
                  <Button size="sm" onClick={() => void copyDraft()}>
                    {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                    {copied ? '복사됨' : '복사'}
                  </Button>
                }
              >
                <Surface>
                  <pre className="t-meta max-h-96 overflow-auto whitespace-pre-wrap break-keep text-slate-600" data-testid="lab-note-text">
                    {form.draft}
                  </pre>
                </Surface>
              </Section>
            )}
          </>
        )
      )}

      {monthNotes.length > 0 && (
        <Section title={`${month} 에 쌓인 노트`} count={monthNotes.length}>
          <ul className="flex flex-col gap-2" data-testid="lab-note-list">
            {monthNotes.map((n) => {
              const c = clients.find((x) => x.id === n.clientId)
              const p = (projects.rows ?? []).find((x) => x.id === n.data.projectId)
              return (
                <li key={n.id}>
                  <Surface as="div" padded={false}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                      <span className="t-sub font-bold text-slate-900">{c?.companyName ?? '업체 없음'}</span>
                      <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{p?.data.name ?? '과제 없음'}</span>
                      <Badge tone={NOTE_TONE[n.data.status]}>{n.data.status}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => void notes.remove(n.id)} aria-label="노트 지우기">
                        <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                      </Button>
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
