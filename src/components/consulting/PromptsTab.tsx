/**
 * 프롬프트 — 수동 LLM 왕복의 나가는 쪽.
 *
 *   종류·대상 고르기 → 미리보기(개인정보 필터 보고 포함) →
 *   [프롬프트 복사] [Markdown 다운로드] [Context 다운로드] [ChatGPT 열기] [Claude 열기] [Claude Code용 복사]
 *   → 저장(꾸러미 기록) → 결과가 오면 "결과 들여오기" 로 산출물이 된다.
 *
 * 외부 API 를 부르지 않는다. '열기' 는 그 서비스의 새 탭을 여는 것뿐이다(붙여넣기는 사람이).
 */

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileDown, Inbox } from 'lucide-react'
import { Badge, Disclosure, ListRow, ListSurface, Surface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEditor } from './editorContext'
import {
  PROMPT_DEFAULT_STAGE,
  PROMPT_TARGET_LABEL,
  PROMPT_TYPES,
  PROMPT_TYPE_LABEL,
  buildPromptPackage,
  packageFileName,
} from '../../domain/consulting/promptPackageBuilder'
import { privacySummary } from '../../domain/consulting/privacyFilter'
import { EVIDENCE_SLOTS, PLAN_SECTIONS } from '../../domain/consulting/qaRules'
import { savePromptPackage } from '../../services/consultingStudioService'
import { formatDateTime } from '../../lib/format'
import type { ConsultingPromptPackage, PromptPackageType, PromptTarget } from '../../types/consulting'
import { copyText, downloadText } from './studioParts'
import { ImportResultSheet } from './ImportResultSheet'

const OPEN_URL: Partial<Record<PromptTarget, string>> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
}

export function PromptsTab({ focus }: { focus?: string }) {
  const { project: p, artifacts, evidence, prompts, workspaceId, refresh, toast, goTo } = useEditor()
  const [type, setType] = useState<PromptPackageType>('GENERAL_PROJECT_REVIEW')
  const [target, setTarget] = useState<PromptTarget>('general')
  const [section, setSection] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1)
  const [slot, setSlot] = useState(1)
  const [saved, setSaved] = useState<ConsultingPromptPackage | null>(null)
  const [importFor, setImportFor] = useState<ConsultingPromptPackage | null>(null)
  const [showContext, setShowContext] = useState(false)

  useEffect(() => {
    if (!focus) return
    const [t, s] = focus.split(':')
    if ((PROMPT_TYPES as string[]).includes(t)) setType(t as PromptPackageType)
    if (s && /^[1-7]$/.test(s)) setSection(Number(s) as 1 | 2 | 3 | 4 | 5 | 6 | 7)
  }, [focus])

  const built = useMemo(
    () => buildPromptPackage({ project: p, type, target, section, slot, artifacts, evidence }),
    [p, type, target, section, slot, artifacts, evidence],
  )

  const persist = async (): Promise<ConsultingPromptPackage | null> => {
    try {
      const pkg = await savePromptPackage(workspaceId, {
        projectId: p.id,
        type,
        target,
        stageKey: built.stageKey,
        title: built.title,
        prompt: built.prompt,
        context: built.context,
        privacy: built.privacy,
        section: built.section,
      })
      setSaved(pkg)
      await refresh()
      return pkg
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '기록하지 못했습니다.')
      return null
    }
  }

  const copyAndSave = async (text: string, note: string) => {
    const ok = await copyText(text)
    toast(ok ? `${note} 복사했습니다. 붙여 넣은 뒤 결과를 '결과 들여오기' 로 가져오세요.` : '복사하지 못했습니다. 다운로드를 이용하세요.')
    await persist()
  }

  const openAndSave = async (t: 'chatgpt' | 'claude') => {
    await copyText(built.prompt)
    window.open(OPEN_URL[t], '_blank', 'noopener,noreferrer')
    toast('프롬프트를 복사했습니다. 새 탭에 붙여 넣으세요. Context 파일은 따로 첨부합니다.')
    await persist()
  }

  return (
    <div className="flex flex-col gap-4">
      <Surface edge="brand" showEdge>
        <h2 className="t-section text-slate-900">프롬프트 꾸러미 — 사람이 들고 나간다</h2>
        <p className="t-sub mt-1 break-keep text-slate-500">
          이 화면은 외부 AI 를 부르지 않습니다. 현재 단계 규칙 20~40줄 + 사실표 발췌 + 핵심 줄기로 프롬프트를 만들고, 복사해 ChatGPT·Claude·Claude Code 에 붙여 넣습니다. 결과는 '결과 들여오기' 로 산출물이 됩니다.
        </p>
      </Surface>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr] lg:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className="t-sub block font-medium text-slate-600">종류</span>
          <select aria-label="프롬프트 종류" value={type} onChange={(e) => setType(e.target.value as PromptPackageType)} className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3">
            {PROMPT_TYPES.map((t) => (
              <option key={t} value={t}>{PROMPT_DEFAULT_STAGE[t]} · {PROMPT_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="t-sub block font-medium text-slate-600">대상</span>
          <select aria-label="대상" value={target} onChange={(e) => setTarget(e.target.value as PromptTarget)} className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3">
            {(Object.keys(PROMPT_TARGET_LABEL) as PromptTarget[]).map((t) => (
              <option key={t} value={t}>{PROMPT_TARGET_LABEL[t]}</option>
            ))}
          </select>
        </label>
        {type === 'VENTURE_PLAN_SECTION' && (
          <label className="block">
            <span className="t-sub block font-medium text-slate-600">사업계획서 항목</span>
            <select aria-label="항목" value={section} onChange={(e) => setSection(Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 7)} className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3">
              {PLAN_SECTIONS.map((s) => (
                <option key={s.no} value={s.no}>{s.no}. {s.title}</option>
              ))}
            </select>
          </label>
        )}
        {type === 'INFOGRAPHIC_BRIEF' && (
          <label className="block">
            <span className="t-sub block font-medium text-slate-600">첨부 슬롯</span>
            <select aria-label="슬롯" value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3">
              {EVIDENCE_SLOTS.map((s) => (
                <option key={s.slot} value={s.slot}>{s.slot}. {s.where}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Surface>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="t-card text-slate-900">{built.title}</h3>
          <Badge tone="neutral">{built.stageKey}</Badge>
          <Badge tone={built.privacy.total > 0 ? 'warning' : 'success'}>{privacySummary(built.privacy)}</Badge>
          <span className="t-meta text-slate-400">{built.prompt.length.toLocaleString()}자 · Context {built.context.length.toLocaleString()}자</span>
        </div>
        <p className="t-meta mt-1 break-keep text-slate-500">아래 미리보기가 실제로 복사되는 내용입니다. 주민번호·계좌·비밀번호·인증서·API 키·이메일·휴대폰은 자동으로 가려집니다.</p>
        <textarea readOnly value={built.prompt} rows={14} aria-label="프롬프트 미리보기" className="t-sub mt-3 w-full resize-y rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-3 font-mono leading-relaxed text-slate-800" />
        <button type="button" onClick={() => setShowContext((v) => !v)} className="t-sub mt-2 font-medium text-brand-700 hover:underline">
          {showContext ? 'Context 감추기' : 'Context 문서 미리보기'}
        </button>
        {showContext && <textarea readOnly value={built.context} rows={12} aria-label="Context 미리보기" className="t-sub mt-2 w-full resize-y rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-3 font-mono leading-relaxed text-slate-800" />}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void copyAndSave(built.prompt, '프롬프트를')}>프롬프트 복사</Button>
          <Button onClick={() => { downloadText(packageFileName(p, type, 'prompt'), built.prompt); void persist() }}>
            <FileDown aria-hidden="true" className="size-4" /> Markdown 다운로드
          </Button>
          <Button onClick={() => { downloadText(packageFileName(p, type, 'context'), built.context); void persist() }}>
            <FileDown aria-hidden="true" className="size-4" /> Context 다운로드
          </Button>
          <Button onClick={() => void openAndSave('chatgpt')}>
            <ExternalLink aria-hidden="true" className="size-4" /> ChatGPT 열기
          </Button>
          <Button onClick={() => void openAndSave('claude')}>
            <ExternalLink aria-hidden="true" className="size-4" /> Claude 열기
          </Button>
          <Button onClick={() => void copyAndSave(buildPromptPackage({ project: p, type, target: 'claude_code', section, slot, artifacts, evidence }).prompt, 'Claude Code 용 프롬프트를')}>
            Claude Code용 복사
          </Button>
        </div>
        {saved && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-success-200 bg-success-50 px-3 py-2">
            <span className="t-sub text-success-700">꾸러미를 기록했습니다 ({formatDateTime(saved.createdAt)}). 결과가 오면:</span>
            <Button size="sm" variant="primary" onClick={() => setImportFor(saved)}>
              <Inbox aria-hidden="true" className="size-4" /> 결과 들여오기
            </Button>
          </div>
        )}
      </Surface>

      <Disclosure title="지금까지 만든 꾸러미" hint={`${prompts.length}건`} defaultOpen={prompts.length > 0 && prompts.length <= 5}>
        <ListSurface>
          {prompts.length === 0 && <ListRow title="아직 없습니다" meta="복사·다운로드·열기를 누르면 여기 기록됩니다." />}
          {prompts.map((k) => {
            const hasResult = artifacts.some((a) => a.promptPackageId === k.id)
            return (
              <ListRow
                key={k.id}
                title={k.title}
                meta={`${PROMPT_TYPE_LABEL[k.type]} · ${PROMPT_TARGET_LABEL[k.target]} · ${k.stageKey}${k.section ? ` · ${k.section}번` : ''} · ${privacySummary(k.privacy)}`}
                badge={hasResult ? <Badge tone="success">결과 있음</Badge> : <Badge tone="warning">결과 대기</Badge>}
                right={formatDateTime(k.createdAt)}
                onClick={() => setImportFor(k)}
              />
            )
          })}
        </ListSurface>
        {prompts.length > 0 && <p className="t-meta mt-2 text-slate-500">줄을 누르면 그 꾸러미의 결과를 들여옵니다. 프롬프트를 다시 복사하려면 종류를 골라 새로 만듭니다(항상 최신 사실표로).</p>}
      </Disclosure>

      <p className="t-meta text-slate-400">
        저장되는 것은 필터를 통과한 본문뿐입니다. 결과 들여오기 · 산출물 탭에서 버전이 쌓입니다.{' '}
        <button type="button" className="text-brand-700 hover:underline" onClick={() => goTo('artifacts')}>산출물 보기</button>
      </p>

      {importFor && <ImportResultSheet pkg={importFor} onClose={() => setImportFor(null)} />}
    </div>
  )
}
