/**
 * D-247 특허 · 벤처 — 대표 "어디 있는지 못 찾겠다, 기업인증 밖으로 빼 줘(지금 기능들만)".
 *
 *   /patent-venture             첫 화면 — 벤처 사업계획서 쓰기(회사 고르기) · 특허 명세서 점검
 *   /patent-venture/plan        벤처 사업계획서 쓰기(?client=) — 기업인증 › 벤처 안 화면과 같은 기록
 *   /patent-venture/spec-check  명세서 점검(특허·MVP 안 화면과 같은 것)
 *
 * 기업인증 › 벤처 안 입구는 그대로 둔다(지운 것 없음). 메뉴 줄은 대표만(moduleRegistry 'patent-venture').
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FileSearch, PenLine } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Blank, Surface } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { ClientPickerOptions } from '../components/ops/ClientPickerOptions'
import { useToolClient } from '../tools/shared/toolClientContext'
import type { ClientOpsRecord } from '../types/clientOps'
import { useCertData } from '../certification/integration/useCertData'
import { VenturePlanWorkbench } from '../certification/ui/VenturePlanWorkbench'
import { sectionHref } from '../certification/ui/certNav'

const HOME = '/patent-venture'
const planHref = (clientId: string) => `${HOME}/plan?client=${encodeURIComponent(clientId)}`

/** 회사 고르기 — 고르고 [사업계획서 쓰기] */
function PlanClientPick({ autoFocus = false }: { autoFocus?: boolean }) {
  const { loadClients } = useToolClient()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [picked, setPicked] = useState('')
  useEffect(() => {
    let alive = true
    void loadClients().then((l) => alive && setClients(l.filter((c) => c.archivedAt === null)))
    return () => {
      alive = false
    }
  }, [loadClients])
  if (clients && clients.length === 0) return <Blank title="아직 업체가 없습니다. 고객 관리에서 회사를 먼저 등록해 주세요(우리 회사도 업체로 등록해 쓰면 됩니다)." />
  return (
    <div className="flex flex-col gap-2" data-testid="pv-plan-pick">
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">어느 회사 사업계획서인가요?</span>
        <select
          value={picked}
          autoFocus={autoFocus}
          onChange={(e) => setPicked(e.target.value)}
          className="tap t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none sm:max-w-md"
          data-testid="pv-plan-client"
        >
          <option value="">회사 고르기</option>
          {clients && <ClientPickerOptions clients={clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber, corporateNumber: c.corporateNumber }))} />}
        </select>
      </label>
      <div>
        <Button onClick={() => picked && navigate(planHref(picked))} disabled={!picked} data-testid="pv-plan-open">
          <PenLine aria-hidden="true" className="size-4 shrink-0" /> 사업계획서 쓰기
        </Button>
      </div>
      <p className="t-sub break-keep text-slate-500">목록에 없으면 고객 관리에서 회사를 먼저 등록하세요. 우리 회사 것도 업체로 등록해 두고 쓰면 됩니다.</p>
    </div>
  )
}

/** 큰 카드 한 장 — 무엇을 하는지 · 순서 · 단추 */
function ToolCard({ testId, icon, title, line, steps, children }: { testId: string; icon: ReactNode; title: string; line: string; steps: string[]; children: ReactNode }) {
  return (
    <Surface showEdge edge="brand">
      <section className="flex flex-col gap-3" data-testid={testId}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="t-section break-keep font-bold text-slate-900">{title}</h2>
            <p className="t-sub break-keep text-slate-600">{line}</p>
          </div>
        </div>
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 t-sub text-slate-600" aria-label="순서">
          {steps.map((s, i) => (
            <li key={s} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />}
              <span className="break-keep">
                <b className="text-slate-800">{i + 1}</b> {s}
              </span>
            </li>
          ))}
        </ol>
        {children}
      </section>
    </Surface>
  )
}

export function PatentVentureHomePage() {
  return (
    <div className="flex flex-col gap-5" data-testid="pv-home">
      <PageHeader title="특허 · 벤처" description="벤처 사업계획서 쓰기와 특허 명세서 점검을 여기서 바로 엽니다." showOnPhone />
      <div className="grid gap-4 lg:grid-cols-2">
        <ToolCard
          testId="pv-card-plan"
          icon={<PenLine className="size-5" />}
          title="벤처 사업계획서 쓰기"
          line="벤처 혁신성장유형 신청서 칸 순서 그대로 씁니다. 칸마다 [복사] 해서 신청 사이트에 붙이면 됩니다."
          steps={['재료(특허 명세서 · AX)', '칸 채우기', '점검 · 내려받기']}
        >
          <PlanClientPick />
        </ToolCard>
        <ToolCard
          testId="pv-card-spec"
          icon={<FileSearch className="size-5" />}
          title="특허 명세서 점검"
          line="특허로에 넣기 전에 형식 · 도면 · 청구항이 서로 맞는지 봅니다. 규칙 점검이라 AI 를 쓰지 않습니다."
          steps={['명세서 파일 올리기(HWPX · MD)', '고칠 곳 보기']}
        >
          <div>
            <Link to={`${HOME}/spec-check`} className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 py-2.5 t-body font-semibold text-white hover:bg-brand-700" data-testid="pv-spec-open">
              <FileSearch aria-hidden="true" className="size-4 shrink-0" /> 명세서 점검 열기
            </Link>
          </div>
        </ToolCard>
      </div>
      <p className="t-sub break-keep text-slate-500" data-testid="pv-note">
        벤처 확인 받을 수 있는지 · 준비 서류 · 실사 준비는 기업인증 › 벤처기업에 그대로 있습니다. 여기서 쓴 사업계획서는 그 화면의 [사업계획서 쓰기]와 같은 기록입니다.
      </p>
    </div>
  )
}

export function VenturePlanPage() {
  const d = useCertData()
  const navigate = useNavigate()
  const head = <PageHeader title={d.clientName ? `${d.clientName} 벤처 사업계획서` : '벤처 사업계획서'} description="벤처 혁신성장유형 신청서 칸 순서 그대로 — 칸마다 복사해 신청 사이트에 붙입니다" descriptionAsHint />
  if (!d.clientId) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <Surface>
          <PlanClientPick autoFocus />
        </Surface>
      </div>
    )
  }
  if (!d.ctx || !d.loaded) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        {d.loadError ? (
          <div role="alert" data-testid="pv-plan-load-error" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
            <p className="t-sub min-w-0 flex-1 break-keep font-semibold text-amber-900">사업계획서 기록을 읽지 못했습니다. 저장해 둔 기록은 그대로 있고, 다시 읽기 전에는 바꾸지 않습니다.</p>
            <Button variant="secondary" size="sm" onClick={() => void d.reloadAll()}>
              다시 읽기
            </Button>
          </div>
        ) : (
          <p className="t-sub text-slate-500" role="status">
            회사 기록을 읽는 중…
          </p>
        )}
      </div>
    )
  }
  const work = d.workOf('venture')
  return (
    <div className="flex flex-col gap-5" data-testid="pv-plan-page">
      {head}
      <VenturePlanWorkbench ctx={d.ctx} notes={work.notes} onSave={(patch) => d.saveWork('venture', { notes: patch })} onBack={() => navigate(HOME)} backLabel="특허 · 벤처로" />
      <p className="t-sub break-keep text-slate-500">
        벤처 확인 준비(받을 수 있는지 · 서류 · 실사)는{' '}
        <Link to={sectionHref('venture', d.clientId)} className="font-semibold text-brand-700 underline underline-offset-2" data-testid="pv-plan-cert-link">
          기업인증 › 벤처기업
        </Link>
        에 있습니다.
      </p>
    </div>
  )
}
