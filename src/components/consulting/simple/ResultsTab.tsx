/**
 * 결과물 — 만들어진 문서만. 데이터베이스 목록처럼 보이면 실패다.
 *
 * 특허 / MVP / 벤처 / 실사 로 묶고, 버전은 문서 안에서 관리한다.
 */

import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useEditor } from '../editorContext'
import { artifactDef } from '../../../domain/consulting/artifactDefinitions'
import { STAGE_GROUP_LABEL, stageDef } from '../../../domain/consulting/workflowDefinition'
import { stripReturnBlock } from '../../../domain/consulting/returnBlock'
import { formatDateTime } from '../../../lib/format'
import type { ArtifactType, ConsultingArtifact, StageGroupKey } from '../../../types/consulting'
import { Badge, Blank, BottomSheet, ListRow, ListSurface } from '../../ui/primitives'
import { Button } from '../../ui/Button'
import { CopyButton } from '../studioParts'

const GROUP_ORDER: StageGroupKey[] = ['understand', 'patent', 'mvp', 'venture', 'submit']

export function ResultsTab() {
  const { artifacts } = useEditor()
  const [open, setOpen] = useState<ConsultingArtifact | null>(null)

  const grouped = useMemo(() => {
    // 종류별 최신 버전만 보여 준다. 이전 버전은 문서를 열었을 때 안에서 본다.
    const latest = new Map<ArtifactType, ConsultingArtifact>()
    for (const a of artifacts) {
      if (a.status === 'superseded') continue
      const cur = latest.get(a.type)
      if (!cur || a.version > cur.version) latest.set(a.type, a)
    }
    const byGroup = new Map<StageGroupKey, ConsultingArtifact[]>()
    for (const a of latest.values()) {
      const g = stageDef(a.stageKey).group
      byGroup.set(g, [...(byGroup.get(g) ?? []), a])
    }
    return GROUP_ORDER.map((g) => ({ group: g, items: (byGroup.get(g) ?? []).sort((x, y) => x.stageKey.localeCompare(y.stageKey)) })).filter((x) => x.items.length > 0)
  }, [artifacts])

  const olderOf = (a: ConsultingArtifact) => artifacts.filter((x) => x.type === a.type && x.id !== a.id).sort((x, y) => y.version - x.version)

  if (grouped.length === 0) {
    return <Blank icon={<FileText className="size-7" />} title="아직 만들어진 자료가 없습니다." />
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ group, items }) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="t-section text-slate-900">{STAGE_GROUP_LABEL[group]}</h2>
          <ListSurface>
            {items.map((a) => (
              <ListRow
                key={a.id}
                title={artifactDef(a.type).label}
                meta={a.title !== artifactDef(a.type).label ? a.title : undefined}
                badge={a.version > 1 ? <Badge tone="neutral">{a.version}번째</Badge> : undefined}
                right={formatDateTime(a.updatedAt).slice(5)}
                onClick={() => setOpen(a)}
              />
            ))}
          </ListSurface>
        </section>
      ))}

      {open && (
        <BottomSheet
          title={artifactDef(open.type).label}
          onClose={() => setOpen(null)}
          footer={
            <div className="flex justify-end gap-2">
              <CopyButton text={open.content} label="내용 복사" />
              <Button onClick={() => setOpen(null)}>닫기</Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="t-meta text-slate-500">
              {open.title} · {open.version}번째 · {formatDateTime(open.updatedAt)}
            </p>
            {/* 끝에 붙은 기계용 반환 블록은 사람이 읽을 때 감춘다 (데이터는 그대로 남아 있다) */}
            <pre className="t-sub max-h-[50vh] overflow-auto rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-3 break-words whitespace-pre-wrap text-slate-800">
              {stripReturnBlock(open.content)}
            </pre>
            {olderOf(open).length > 0 && (
              <details>
                <summary className="t-sub cursor-pointer font-medium text-slate-600">이전 버전 {olderOf(open).length}개</summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {olderOf(open).map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setOpen(o)} className="t-sub text-brand-700 hover:underline">
                        {o.version}번째 · {formatDateTime(o.updatedAt).slice(5)}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
