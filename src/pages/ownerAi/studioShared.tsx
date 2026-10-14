/**
 * 스튜디오 공용 — 업체 작업실 묶음 + 결과 한 개 불러오기 · 고친 글(구조) 저장 · SVG → PNG · 인쇄(PDF).
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import type { AiRun, SkillId } from '../../services/ownerAi/types'
import { loadBundle, saveRevision, type CaseBundle } from '../../services/ownerAi/workflow'
import { useFindClient, useOwnerAiRepo } from './shared'

export type StudioState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'db_setup' } | { kind: 'error'; message: string } | { kind: 'ready'; bundle: CaseBundle; run: AiRun }

export function useStudioRun(caseId: string, runId: string, skill: SkillId) {
  const repo = useOwnerAiRepo()
  const findClient = useFindClient()
  const [state, setState] = useState<StudioState>({ kind: 'loading' })
  useEffect(() => {
    let alive = true
    loadBundle(repo, caseId, findClient)
      .then((b) => {
        if (!alive) return
        const run = b?.runs.find((r) => r.id === runId && r.skillId === skill)
        setState(b && run ? { kind: 'ready', bundle: b, run } : { kind: 'missing' })
      })
      .catch((e) => alive && setState(e instanceof OwnerAiSetupError ? { kind: 'db_setup' } : { kind: 'error', message: e instanceof Error ? e.message : '불러오지 못했습니다.' }))
    return () => {
      alive = false
    }
  }, [repo, findClient, caseId, runId, skill])

  /** 고친 구조를 수정 이력 새 번호로(원래 결과는 그대로) */
  const save = useCallback(
    async (content: unknown, note: string) => {
      if (state.kind !== 'ready') return null
      const r = await saveRevision(repo, state.bundle, state.run, content, note)
      setState((s) => {
        if (s.kind !== 'ready') return s
        const m = new Map(s.bundle.latestRevision)
        m.set(s.run.id, r.rev)
        return { ...s, bundle: { ...s.bundle, c: r.c, latestRevision: m } }
      })
      return r.rev
    },
    [repo, state],
  )
  return { state, setState, save, repo }
}

/** 화면에 그린 SVG 를 PNG 로(글자는 이 기기 글꼴로 다시 그린다) */
export async function svgToPng(svg: SVGSVGElement, width: number, height: number, scale = 2): Promise<Blob | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('그림을 만들지 못했습니다.'))
    img.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

export function downloadBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 30_000)
}

export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '자료'

/** 인쇄용 종이 — 화면에는 숨기고, 인쇄할 때만 이것만 찍는다(index.css .print-solo 규칙) */
export function PrintSheet({ children, pageCss }: { children: React.ReactNode; pageCss: string }) {
  return createPortal(
    <div className="print-solo hidden print:block" data-testid="print-sheet">
      <style>{`@media print { @page { ${pageCss} } }`}</style>
      {children}
    </div>,
    document.body,
  )
}

/** 슬라이드 · 화면 글꼴 — PNG 로 옮겨도 이 기기 한글 글꼴로 보이게 시스템 글꼴을 함께 */
export const STUDIO_FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"
