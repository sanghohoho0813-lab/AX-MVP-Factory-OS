/**
 * D-255 AI 전략실 첫 화면 '바로 시작' — 대표: "기존 고객도 여기서 바로 · 업체 등록도 간단하게 · PDF 만 넣어도(크레탑 · 사업자등록증) 시작 · 타자는 거의 없게".
 *  ① 고객 관리에서 고르기 — 아직 작업실과 잇지 않은 고객 단추(최근 순 8개 · 찾기). 누르면 그 고객 정보 · 관계로 바로 만든다.
 *  ② 서류 한 장으로 — 사업자등록증 · 크레탑 보고서 · 등기를 넣으면 업체명 · 사업자번호 · 대표자를 읽어(새 업체 등록 창과 같은 읽기)
 *     같은 고객 · 작업실이 있으면 그쪽으로 잇기를 먼저, 없으면 [이 서류로 AI 전략실 만들기]. 읽은 글은 개인정보를 지운 뒤 '자료' 로 같이 들어간다.
 *     사업자번호가 확실하지 않으면 칸에 넣지 않고 후보 단추(D-255 사업자번호 읽기와 같음).
 * 직접 적는 빠른 등록은 그대로(머리줄 [업체 등록]).
 */
import { useMemo, useState } from 'react'
import { FileUp, Search, Users } from 'lucide-react'
import { NewClientDocDrop } from '../../../components/ops/NewClientDocDrop'
import { Badge, Surface } from '../../../components/ui/primitives'
import { Button } from '../../../components/ui/Button'
import { clientsToStart, findDuplicates, guessMaterialKind, makeMaterial } from '../../../services/ownerAi/caseUtil'
import { EMPTY_DOCS_READ, type NewClientDocsRead } from '../../../services/newClientFromDocs'
import type { CaseMaterial, CompanyCase } from '../../../services/ownerAi/types'
import type { ClientOpsRecord } from '../../../types/clientOps'

export interface DocStart {
  companyName: string
  bizNo: string
  contactName: string
  materials: CaseMaterial[]
}

export function CaseQuickStart({
  cases,
  clients,
  busy,
  onPickClient,
  onStartDocs,
  onOpenCase,
  onTypeIt,
}: {
  cases: readonly CompanyCase[]
  clients: readonly ClientOpsRecord[]
  busy: boolean
  onPickClient: (clientId: string, materials?: CaseMaterial[]) => void
  onStartDocs: (d: DocStart) => void
  onOpenCase: (caseId: string) => void
  /** 서류에서 회사 이름을 못 찾았을 때 — 직접 적는 칸을 연다(읽은 글은 자료로 들고 간다) */
  onTypeIt: (materials: CaseMaterial[]) => void
}) {
  const [mode, setMode] = useState<'client' | 'docs'>('client')
  const [q, setQ] = useState('')
  const [read, setRead] = useState<NewClientDocsRead>(EMPTY_DOCS_READ)
  const [pickedBiz, setPickedBiz] = useState('')
  const [dropKey, setDropKey] = useState(0)
  const start = useMemo(() => clientsToStart(clients, cases, q), [clients, cases, q])

  const g = read.guess
  const companyName = g.companyName?.value ?? ''
  const bizChoices = g.businessNumber && !g.businessNumber.value ? (g.businessNumber.choices ?? []) : []
  const bizNo = g.businessNumber?.value || pickedBiz
  const contactName = g.contactName?.value ?? ''
  const doneDocs = read.docs.filter((d) => (d.text ?? '').trim())
  const materials = (): CaseMaterial[] => {
    const at = new Date().toISOString()
    return doneDocs.map((d) => makeMaterial({ kind: guessMaterialKind(d.file.name, d.text ?? ''), title: d.file.name.replace(/\.[^.]+$/, ''), text: d.text ?? '', fileName: d.file.name, fileSize: d.file.size, source: '서류로 시작' }, at))
  }
  const dups = companyName || bizNo ? findDuplicates({ name: companyName, bizNo }, cases, clients) : []
  const caseHit = dups.find((d) => d.kind === 'case' && d.strong)
  const clientHit = dups.find((d) => d.kind === 'client' && d.strong) ?? dups.find((d) => d.kind === 'client')
  const readDone = read.docs.length > 0 && !read.reading

  return (
    <div data-testid="case-quick">
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* D-273 기준폭 0(flex-1)이면 옆 단추 묶음에 밀려 한 글자씩 세로로 흘렀다(대표 휴대폰) — 12rem 아래로는 줄을 바꾼다 */}
        <h2 className="t-section min-w-[12rem] flex-1 break-keep text-slate-900">바로 시작 — 타자 없이</h2>
        <div className="flex max-w-full flex-wrap gap-1 rounded-(--radius-control) bg-slate-100 p-1" role="tablist" aria-label="어떻게 시작할까요">
          <button type="button" role="tab" aria-selected={mode === 'client'} onClick={() => setMode('client')} className={`tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 font-semibold ${mode === 'client' ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid="case-quick-tab-client">
            <Users aria-hidden="true" className="size-4" /> 고객 관리에서 고르기
          </button>
          <button type="button" role="tab" aria-selected={mode === 'docs'} onClick={() => setMode('docs')} className={`tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 font-semibold ${mode === 'docs' ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600'}`} data-testid="case-quick-tab-docs">
            <FileUp aria-hidden="true" className="size-4" /> 서류 한 장으로
          </button>
        </div>
      </div>

      {mode === 'client' ? (
        <div className="flex flex-col gap-2" data-testid="case-quick-clients">
          <p className="t-sub break-keep text-slate-600">고객 관리에 있는 업체를 누르면 회사 정보 · 서류 · 관계를 그대로 써서 바로 작업실을 엽니다(아직 작업실이 없는 고객 {start.total}곳).</p>
          {start.total > 8 || q ? (
            <label className="relative">
              <span className="sr-only">고객 찾기</span>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사명 · 대표 · 사업자번호로 찾기" className="t-body min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white pr-3 pl-9" data-testid="case-quick-search" />
            </label>
          ) : null}
          {start.list.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {start.list.map((c) => (
                <li key={c.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPickClient(c.id)}
                    className="tap flex min-h-14 w-full min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-60"
                    data-testid="case-quick-client"
                    data-id={c.id}
                  >
                    <span className="t-body w-full truncate font-semibold text-slate-900">{c.companyName}</span>
                    <span className="t-meta w-full truncate text-slate-600">{[c.contactName, c.businessNumber, c.contract?.signedAt ? '계약 고객' : c.sales ? '잠재고객' : ''].filter(Boolean).join(' · ') || '정보 없음'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-sub break-keep rounded-(--radius-control) bg-slate-50 px-3 py-2 text-slate-600" data-testid="case-quick-none">
              {q ? '찾는 고객이 없어요.' : '고객 관리의 업체는 모두 작업실이 있어요 — 아래 목록에서 여세요.'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="case-quick-docs">
          <p className="t-sub break-keep text-slate-600">사업자등록증 · 크레탑 보고서 · 등기부등본(PDF · 사진)을 넣으면 업체명 · 사업자번호 · 대표자를 읽어 바로 만들어요. 읽은 글은 자료로 같이 들어갑니다(주민번호 · 계좌 · 휴대폰은 지움).</p>
          <NewClientDocDrop key={dropKey} onChange={setRead} title="서류만 넣으면 업체가 만들어집니다" hint="사업자등록증 · 크레탑 보고서 · 등기부등본 — 읽은 글은 이 작업실 '자료' 로 들어갑니다" />
          {readDone && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/60 px-3 py-3" data-testid="case-quick-found">
              {companyName ? (
                <>
                  <p className="t-body font-semibold break-keep text-slate-900">
                    {companyName}
                    {contactName && <span className="t-sub font-normal text-slate-600"> · 대표 {contactName}</span>}
                    {bizNo && <span className="t-sub font-normal text-slate-600 tabular-nums"> · {bizNo}</span>}
                  </p>
                  {bizChoices.length > 0 && !pickedBiz && (
                    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-warning-300 bg-warning-50 px-2.5 py-2" data-testid="case-quick-biz-choices">
                      <span className="t-meta break-keep text-warning-900">{g.businessNumber?.note || '사업자번호를 확실히 못 읽었어요 — 서류를 보고 맞는 것을 눌러 주세요'}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {bizChoices.map((v) => (
                          <button key={v} type="button" onClick={() => setPickedBiz(v)} className="tap t-sub rounded-(--radius-control) border border-warning-400 bg-white px-2.5 font-bold tabular-nums text-slate-900 hover:bg-warning-100" data-testid="case-quick-biz-choice">
                            {v}
                          </button>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {caseHit ? (
                      <>
                        <Badge tone="warning">이미 작업실 있음 · {caseHit.reason}</Badge>
                        <Button size="sm" variant="primary" onClick={() => onOpenCase(caseHit.id)} data-testid="case-quick-open-case">'{caseHit.name}' 작업실 열기</Button>
                      </>
                    ) : clientHit ? (
                      <>
                        <Badge tone="brand">고객 관리에 있음 · {clientHit.reason}</Badge>
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => onPickClient(clientHit.id, materials())} data-testid="case-quick-link-client">'{clientHit.name}' 고객과 이어 만들기</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => onStartDocs({ companyName, bizNo, contactName, materials: materials() })} data-testid="case-quick-create">
                        이 서류로 AI 전략실 만들기
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setRead(EMPTY_DOCS_READ); setPickedBiz(''); setDropKey((k) => k + 1) }}>
                      다른 서류로
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2" data-testid="case-quick-noname">
                  <p className="t-sub min-w-0 flex-1 break-keep text-slate-700">서류에서 회사 이름을 찾지 못했어요 — 이름만 적으면 읽은 글은 자료로 같이 들어갑니다.</p>
                  <Button size="sm" variant="secondary" onClick={() => onTypeIt(materials())}>이름만 적고 만들기</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Surface>
    </div>
  )
}
