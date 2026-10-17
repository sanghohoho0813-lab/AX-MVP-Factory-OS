/**
 * 업체 상세 'AI 작업실' 탭(대표 전용) — 이 고객과 이어 둔 작업실이 있으면 그 자리에서 열고,
 * 없으면 '이 업체로 AI 작업실 열기' 한 번(고객 정보 · 관계를 채워 이어 만든다 — 업체 DB 를 따로 만들지 않는다).
 * D-219: 같은 사업자번호로 먼저 만든 작업실이 있으면(AI 작업실 목록에서 빠른 등록 등) 새로 만들지 않고 묻고 잇는다 —
 * 예전에는 DB 고유 규칙에 걸려 '저장에 실패했습니다' 만 뜨고 이 탭을 영영 열 수 없었다.
 */
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { findCaseForClient, relationForClient, withCaseActivity } from '../../services/ownerAi/caseUtil'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import type { CompanyCase } from '../../services/ownerAi/types'
import { patchCase, registerCase } from '../../services/ownerAi/workflow'
import type { ClientOpsRecord } from '../../types/clientOps'
import { useToast } from '../../components/ui/toastContext'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { CaseWorkspace } from './CaseWorkspace'
import { OwnerAiGate, useOwnerAiIdentity, useOwnerAiRepo } from './shared'

export default function ClientAiTab({ record }: { record: ClientOpsRecord }) {
  return (
    <OwnerAiGate>
      <Inner record={record} />
    </OwnerAiGate>
  )
}

function Inner({ record }: { record: ClientOpsRecord }) {
  const repo = useOwnerAiRepo()
  const ident = useOwnerAiIdentity()
  const { showToast } = useToast()
  const [linked, setLinked] = useState<CompanyCase | null | undefined>(undefined)
  const [dbSetup, setDbSetup] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    repo
      .listCases()
      .then((l) => alive && setLinked(findCaseForClient(l, { id: record.id }).linked))
      .catch((e) => {
        if (!alive) return
        if (e instanceof OwnerAiSetupError) setDbSetup(true)
        setLinked(null)
      })
    return () => {
      alive = false
    }
  }, [repo, record.id])

  if (dbSetup)
    return (
      <Surface>
        <p className="t-body font-semibold text-slate-900" data-testid="owner-ai-db-setup">AI 작업실 DB 설정이 필요합니다.</p>
        <p className="t-sub mt-1 break-keep text-slate-600">Supabase 에 0021 마이그레이션을 실행하면 열립니다.</p>
      </Surface>
    )
  if (linked === undefined) return <p className="t-sub text-slate-500" role="status">AI 작업실을 찾는 중…</p>
  if (linked) return <CaseWorkspace caseId={linked.id} embedded />

  return (
    <Surface className="flex flex-col items-start gap-3">
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <h2 className="t-section break-keep text-slate-900">이 업체로 AI 작업실 열기</h2>
          <p className="t-sub mt-1 break-keep text-slate-600">
            고객 관리의 회사 정보 · 서류를 그대로 쓰고, AX 전략 · 제안서 · 특허 · 정책자금 결과와 업체 기억을 이 업체에 이어 쌓습니다. 대표만 보입니다.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        disabled={saving}
        data-testid="client-ai-open"
        onClick={async () => {
          if (saving) return
          setSaving(true)
          try {
            const { linked: already, sameBiz } = findCaseForClient(await repo.listCases(), record)
            if (already) {
              setLinked(already)
              return
            }
            if (sameBiz) {
              const ask = sameBiz.clientId
                ? `같은 사업자번호로 만든 작업실 '${sameBiz.companyName}'이 다른 업체에 이어져 있습니다. 이 업체로 옮겨 이을까요?`
                : `같은 사업자번호로 만든 작업실 '${sameBiz.companyName}'이 이미 있습니다. 새로 만들지 않고 이 업체와 이을까요?`
              if (!window.confirm(ask)) return
              const at = new Date().toISOString()
              const c = await patchCase(repo, sameBiz, (x) => withCaseActivity({ ...x, clientId: record.id }, '고객 관리 업체와 이음(같은 사업자번호)', at))
              showToast(`${c.companyName} — 이 업체와 이었습니다. 쌓아 둔 결과 · 기억을 그대로 씁니다.`)
              setLinked(c)
              return
            }
            const c = await registerCase(repo, {
              companyName: record.companyName,
              bizNo: record.businessNumber,
              industry: record.industry,
              homepageUrl: record.homepage ?? '',
              relation: relationForClient(record),
              clientId: record.id,
              workspaceId: ident.workspaceId,
              userId: ident.userId,
            })
            setLinked(c)
          } catch (e) {
            if (e instanceof OwnerAiSetupError) setDbSetup(true)
            else showToast(e instanceof Error ? e.message : '만들지 못했습니다.')
          } finally {
            setSaving(false)
          }
        }}
      >
        AI 작업실 열기
      </Button>
    </Surface>
  )
}
