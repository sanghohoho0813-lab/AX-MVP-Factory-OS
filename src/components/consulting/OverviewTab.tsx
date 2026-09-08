/**
 * 개요 — 회사 · 프로젝트 · 현재 단계 · 진행도 · 막힘 · 다음 행동 3개 ·
 *        핵심 줄기 요약 · 단계 타임라인 · 사실 완성도 · 최근 산출물/결정 · 필요 자료.
 * 세 단계 규칙: 맨 위 = 지금 할 것(다음 행동), 가운데 = 상태, 아래 = 접힌 상세.
 */

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge, Disclosure, ListRow, ListSurface, MetricTile, Surface } from '../ui/primitives'
import { useEditor } from './editorContext'
import { resolveNextActions } from '../../domain/consulting/nextActionResolver'
import { blockedStages, projectProgress, CORE_THREAD_KEYS, CORE_THREAD_LABEL } from '../../domain/consulting/projectModel'
import { coreThreadWarnings } from '../../domain/consulting/coreThread'
import { factCompleteness, factDef, missingFacts } from '../../domain/consulting/factsheetSchema'
import { STAGES, stageDef, stagesByGroup, STAGE_GROUP_LABEL } from '../../domain/consulting/workflowDefinition'
import { artifactDef } from '../../domain/consulting/artifactDefinitions'
import { formatDateTime } from '../../lib/format'
import { MiniProgress, NextActionRow, StageBadge, stageTone } from './studioParts'

export function OverviewTab() {
  const ed = useEditor()
  const { project: p, artifacts, prompts, evidence, decisions, today, goTo } = ed
  const actions = useMemo(() => resolveNextActions(p, { artifacts, prompts, evidence, today }), [p, artifacts, prompts, evidence, today])
  const progress = projectProgress(p)
  const blocked = blockedStages(p)
  const warnings = useMemo(() => coreThreadWarnings(p).filter((w) => w.severity !== 'info'), [p])
  const facts = factCompleteness(p.factsheet)
  const def = stageDef(p.currentStage)
  const missingNow = missingFacts(p.factsheet, def.requiredFacts)
  const threadFilled = CORE_THREAD_KEYS.filter((k) => p.coreThread[k].trim() !== '').length
  const recentArtifacts = artifacts.slice(0, 4)
  const recentDecisions = decisions.slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      {/* 1단계 — 지금 할 것 */}
      <section className="flex flex-col gap-3 rounded-(--radius-panel) border-2 border-brand-200 bg-brand-50/30 p-4 sm:p-5">
        <h2 className="t-section text-slate-900">다음 행동</h2>
        {actions.length === 0 ? (
          <p className="t-body text-slate-500">지금 할 것이 없습니다. 프로젝트가 끝났거나 보류 상태입니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => (
              <NextActionRow key={`${a.kind}-${a.focus ?? ''}-${a.stageKey}`} action={a} index={i} onOpen={() => goTo(a.tab, a.focus)} />
            ))}
          </div>
        )}
        <p className="t-meta break-keep text-slate-500">규칙이 정한 순서입니다 — 막힘 → 게이트 → 필요 사실 → 산출물 → 참고자료 → 최신 기준 → 단계 완료.</p>
      </section>

      {/* 2단계 — 상태 */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricTile label="현재 단계" value={p.currentStage} hint={def.label} tone={p.stages[p.currentStage].status === 'blocked' ? 'danger' : 'neutral'} onClick={() => goTo('stages', p.currentStage)} />
        <MetricTile label="단계 진행" value={`${progress.done}/${progress.total}`} hint={`${progress.percent}%`} onClick={() => goTo('stages')} />
        <MetricTile label="사실표" value={`${facts.filled}/${facts.total}`} hint={facts.demoCount > 0 ? `시연용 ${facts.demoCount}` : facts.unverifiedCount > 0 ? `미확인 ${facts.unverifiedCount}` : '채움'} tone={facts.demoCount > 0 ? 'warning' : 'neutral'} onClick={() => goTo('factsheet')} />
        <MetricTile label="핵심 줄기" value={`${threadFilled}/8`} hint={warnings.length > 0 ? `경고 ${warnings.length}` : '경고 없음'} tone={warnings.some((w) => w.severity === 'p0') ? 'danger' : warnings.length > 0 ? 'warning' : 'neutral'} onClick={() => goTo('thread')} />
      </div>

      {(blocked.length > 0 || warnings.length > 0) && (
        <Surface edge="danger" showEdge>
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger-600" />
            <div className="min-w-0 flex-1">
              <p className="t-card text-slate-900">막힘 · 경고</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {blocked.map((k) => (
                  <li key={k} className="t-body break-keep text-slate-700">
                    <button type="button" className="text-left hover:underline" onClick={() => goTo('stages', k)}>
                      <span className="font-semibold text-danger-700">{k} 막힘</span> · {p.stages[k].blockedBy || '이유 미기록'}
                    </button>
                  </li>
                ))}
                {warnings.map((w) => (
                  <li key={w.code} className="t-body break-keep text-slate-700">
                    <button type="button" className="text-left hover:underline" onClick={() => goTo(w.tab, w.focus)}>
                      <Badge tone={w.severity === 'p0' ? 'danger' : 'warning'}>{w.severity.toUpperCase()}</Badge> {w.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Surface>
      )}

      {/* 핵심 줄기 요약 */}
      <Surface>
        <div className="flex items-center justify-between gap-2">
          <h3 className="t-card text-slate-900">핵심 줄기 (One Core Thread)</h3>
          <button type="button" onClick={() => goTo('thread')} className="t-sub font-medium text-brand-700 hover:underline">
            고치기
          </button>
        </div>
        <ol className="mt-3 flex flex-col gap-1.5">
          {CORE_THREAD_KEYS.map((k, i) => (
            <li key={k} className="flex items-start gap-2">
              <span aria-hidden="true" className="t-meta mt-0.5 w-5 shrink-0 text-right text-slate-400">{i + 1}</span>
              <span className="min-w-0">
                <span className="t-meta block text-slate-500">{CORE_THREAD_LABEL[k]}</span>
                <span className={`t-body block break-keep ${p.coreThread[k].trim() ? 'text-slate-900' : 'text-slate-400'}`}>{p.coreThread[k].trim() || '아직 비어 있음'}</span>
              </span>
            </li>
          ))}
        </ol>
      </Surface>

      {/* 단계 타임라인 */}
      <Surface>
        <h3 className="t-card text-slate-900">단계 타임라인</h3>
        <div className="mt-3 flex flex-col gap-3">
          {stagesByGroup().map(({ group, stages }) => (
            <div key={group}>
              <p className="t-meta font-semibold text-slate-500">{STAGE_GROUP_LABEL[group]}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {stages.map((s) => {
                  const st = p.stages[s.key].status
                  const tone = stageTone(st)
                  const cur = s.key === p.currentStage
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => goTo('stages', s.key)}
                      title={`${s.key} ${s.label}`}
                      className={`t-meta rounded-full border px-2.5 py-1 font-semibold ${
                        tone === 'danger' ? 'border-danger-200 bg-danger-50 text-danger-700'
                          : tone === 'success' ? 'border-success-200 bg-success-50 text-success-700'
                            : tone === 'warning' ? 'border-warning-200 bg-warning-50 text-warning-700'
                              : tone === 'brand' ? 'border-brand-300 bg-brand-50 text-brand-700'
                                : 'border-slate-200 bg-white text-slate-500'
                      } ${cur ? 'ring-2 ring-brand-400' : ''}`}
                    >
                      {s.key} {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* 3단계 — 접힌 상세 */}
      <Disclosure title="사실표 완성도" hint={`${facts.filled}/${facts.total} · 묶음별`}>
        <div className="flex flex-col gap-3">
          {Object.entries(facts.bySection).map(([sec, v]) => (
            <MiniProgress key={sec} value={v.filled} max={v.total} label={sectionLabel(sec)} />
          ))}
        </div>
      </Disclosure>

      <Disclosure title="이 단계에 필요한 자료" hint={missingNow.length === 0 ? '모두 있음' : `비어 있음 ${missingNow.length}`}>
        <ul className="flex flex-col gap-1.5">
          {def.requiredFacts.length === 0 && def.requiredArtifacts.length === 0 && <li className="t-body text-slate-500">이 단계는 필수 사실·산출물이 없습니다. exit checklist 만 확인합니다.</li>}
          {def.requiredFacts.map((k) => (
            <li key={k} className="t-body flex items-center gap-2">
              <Badge tone={missingNow.includes(k) ? 'warning' : 'success'}>{missingNow.includes(k) ? '없음' : '있음'}</Badge>
              <button type="button" className="text-left hover:underline" onClick={() => goTo('factsheet', k)}>
                사실표 · {factDef(k).label}
              </button>
            </li>
          ))}
          {def.requiredArtifacts.map((t) => {
            const have = artifacts.some((a) => a.type === t && a.status !== 'superseded')
            return (
              <li key={t} className="t-body flex items-center gap-2">
                <Badge tone={have ? 'success' : 'warning'}>{have ? '있음' : '없음'}</Badge>
                <button type="button" className="text-left hover:underline" onClick={() => goTo('artifacts', t)}>
                  산출물 · {artifactDef(t).label}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="t-meta mt-3 break-keep text-slate-500">exit checklist: {def.exitChecklist.join(' · ')}</p>
      </Disclosure>

      <Disclosure title="최근 산출물 · 결정" hint={`산출물 ${artifacts.length} · 결정 ${decisions.length}`}>
        <ListSurface>
          {recentArtifacts.length === 0 && recentDecisions.length === 0 && <ListRow title="아직 없습니다" meta="프롬프트를 만들어 결과를 들여오면 여기 쌓입니다." />}
          {recentArtifacts.map((a) => (
            <ListRow key={a.id} title={a.title} meta={`${artifactDef(a.type).label} v${a.version} · ${a.stageKey}`} right={formatDateTime(a.updatedAt)} onClick={() => goTo('artifacts', a.id)} />
          ))}
          {recentDecisions.map((d) => (
            <ListRow key={d.id} title={d.summary} meta={`결정 · ${d.stageKey}${d.reason ? ` · ${d.reason}` : ''}`} right={formatDateTime(d.createdAt)} onClick={() => goTo('decisions')} />
          ))}
        </ListSurface>
      </Disclosure>

      <p className="t-meta text-slate-400">
        {STAGES.length}단계 · 현재 {p.currentStage} <StageBadge status={p.stages[p.currentStage].status} /> · Master 활성 PART: {def.activeParts}
      </p>
    </div>
  )
}

function sectionLabel(sec: string): string {
  const map: Record<string, string> = { company: '회사 기본', org: '조직', finance: '재무', business: '고객·사업', tech: '기술', market: '시장', plan3y: '3년 계획' }
  return map[sec] ?? sec
}
