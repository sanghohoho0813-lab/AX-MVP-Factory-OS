/**
 * localStorage → Supabase 가져오기 마법사 (supabase 모드).
 * 단계: 로컬 찾기 → 검사(Dry Run) → 가져오기 → 결과/재시도.
 * 원칙: 원본 localStorage 는 지우지 않는다. 멱등(같은 계획 재실행 시 중복 없음).
 * 실패를 성공처럼 표시하지 않는다. 진행률·이어받기를 지원한다.
 */

import { useMemo, useState } from 'react'
import { CloudUpload, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { getSupabaseClient } from '../../lib/supabase/client'
import { buildLocalSnapshot, summarizeSnapshot, type ImportDomain } from '../../services/dataImport/localSnapshot'
import { buildImportPlan } from '../../services/dataImport/importPlan'
import { runImportPlan, type ImportProgress, type ImportRunResult } from '../../services/dataImport/importExecutor'
import { useAuth } from '../../auth/AuthProvider'

const DOMAIN_LABEL: Partial<Record<ImportDomain, string>> = {
  organizations: '고객사',
  projects: '프로젝트',
  questions: '질문',
  survey_modules: '설문 모듈',
  survey_templates: '설문 양식',
  survey_blueprints: '설문 초안',
  survey_distributions: '설문 배포',
  survey_responses: '설문 응답',
  assessments: '진단 결과',
  automation_candidates: '자동화 후보',
  selection_decisions: '과제 선정',
  mvp_designs: 'MVP 설계',
  website_designs: '홈페이지 설계',
  validation_workspaces: '검증',
  deliverable_packages: '제출자료',
  institutions: '기관',
  support_programs: '지원 프로그램',
  funding_strategies: '자금 연계',
  case_studies: '사례',
}

export function ImportWizard() {
  const { session, currentWorkspaceId } = useAuth()
  const snapshot = useMemo(() => buildLocalSnapshot(), [])
  const summary = useMemo(() => summarizeSnapshot(snapshot), [snapshot])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canImport = Boolean(session && currentWorkspaceId) && snapshot.totalItems > 0

  async function handleImport(resumeJobId?: string) {
    if (!session || !currentWorkspaceId || running) return
    setRunning(true)
    setError(null)
    setProgress(null)
    try {
      const plan = await buildImportPlan(snapshot, currentWorkspaceId)
      const res = await runImportPlan(
        getSupabaseClient(),
        plan,
        snapshot.schemaVersion,
        {
          workspaceId: currentWorkspaceId,
          actorId: session.user.id,
          onProgress: (p) => setProgress(p),
        },
        resumeJobId,
      )
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가져오기에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 검사 결과 (Dry Run) */}
      <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">로컬 데이터 검사</p>
          <span className="text-[13px] text-slate-500">
            스키마 v{snapshot.schemaVersion} · 총 {snapshot.totalItems}건
          </span>
        </div>
        {!snapshot.schemaMatches && (
          <p className="mt-2 rounded border border-warning-200 bg-warning-50 px-3 py-2 text-[13px] break-keep text-warning-700">
            로컬 스키마(v{snapshot.schemaVersion})가 앱 기대 버전(v{snapshot.expectedSchemaVersion})과 다릅니다.
            가져오기 전에 최신 앱으로 한 번 접속해 마이그레이션을 완료하세요.
          </p>
        )}
        {summary.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate-500">가져올 로컬 데이터가 없습니다.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {summary.map((s) => (
              <li key={s.domain} className="flex items-center justify-between text-[13px] text-slate-600">
                <span className="truncate">{DOMAIN_LABEL[s.domain] ?? s.domain}</span>
                <span className="font-semibold text-slate-800">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 2. 진행률 */}
      {running && progress && (
        <div className="flex items-center gap-2 rounded-(--radius-card) border border-brand-200 bg-brand-50/60 px-4 py-3 text-[13px] text-brand-700">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {DOMAIN_LABEL[progress.domain as ImportDomain] ?? progress.domain} 가져오는 중… {progress.done}/{progress.total}
        </div>
      )}

      {/* 3. 오류 */}
      {error && (
        <p className="rounded-(--radius-card) border border-danger-200 bg-danger-50/70 px-4 py-3 text-[13px] break-keep text-danger-700">
          {error}
        </p>
      )}

      {/* 4. 결과 */}
      {result && (
        <div
          className={`rounded-(--radius-card) border px-4 py-3 text-[13px] ${
            result.status === 'completed'
              ? 'border-success-200 bg-success-50/70 text-success-700'
              : result.status === 'partial'
                ? 'border-warning-200 bg-warning-50/70 text-warning-800'
                : 'border-danger-200 bg-danger-50/70 text-danger-700'
          }`}
        >
          <p className="font-semibold">
            {result.status === 'completed' ? '가져오기 완료' : result.status === 'partial' ? '일부만 가져옴' : '가져오기 실패'}
          </p>
          <p className="mt-1">
            추가 {result.imported} · 건너뜀 {result.skipped} · 실패 {result.failed}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc break-words">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e.domain}: {e.message}</li>
              ))}
            </ul>
          )}
          {result.failed > 0 && (
            <Button size="sm" variant="secondary" className="mt-3" disabled={running} onClick={() => handleImport(result.jobId)}>
              <RefreshCw aria-hidden="true" className="size-4" /> 실패 항목 재시도(이어서)
            </Button>
          )}
        </div>
      )}

      {/* 실행 버튼 */}
      <div>
        <Button variant="primary" disabled={!canImport || running} onClick={() => handleImport()}>
          {running ? (
            <><Loader2 aria-hidden="true" className="size-4 animate-spin" /> 가져오는 중…</>
          ) : (
            <><CloudUpload aria-hidden="true" className="size-4" /> 이 워크스페이스로 가져오기</>
          )}
        </Button>
        {!canImport && snapshot.totalItems > 0 && (
          <p className="mt-2 text-[12px] text-slate-500">워크스페이스를 선택한 뒤 가져올 수 있습니다.</p>
        )}
        <p className="mt-2 text-[12px] break-keep text-slate-400">
          가져오기는 멱등입니다. 같은 데이터를 다시 실행해도 중복되지 않으며, 원본 로컬 데이터는 지워지지 않습니다.
        </p>
      </div>
    </div>
  )
}
