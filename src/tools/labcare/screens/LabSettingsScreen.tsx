/**
 * 연구소 모듈 설정·백업 (D-91).
 *
 * 원본 설정 화면의 글자 크기·화면 안내는 이 OS 가 이미 갖고 있다(머리띠의 글자 크기·온보딩).
 * 여기서는 이 모듈이 쌓은 기록만 다룬다.
 */

import { MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { ModuleBackup } from '../../shared/ModuleBackup'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { LabInfoData } from '../lib/labInfo'

const BUCKETS = ['labInfo', 'projects', 'notes', 'surveys', 'inspections'] as const

export function LabSettingsScreen() {
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const notes = useModuleBucket<Record<string, unknown>>('labcare', 'notes')
  const projects = useModuleBucket<Record<string, unknown>>('labcare', 'projects')

  return (
    <div className="flex flex-col gap-5" data-testid="lab-settings">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="연구소 정보" value={`${info.rows?.length ?? 0}곳`} />
        <MetricTile label="연구과제" value={`${projects.rows?.length ?? 0}개`} />
        <MetricTile label="연구노트" value={`${notes.rows?.length ?? 0}장`} />
      </div>

      <Section title="백업">
        <ModuleBackup
          moduleKey="labcare"
          buckets={BUCKETS}
          label="연구소"
          onRestored={() => {
            void info.reload()
            void notes.reload()
            void projects.reload()
          }}
        />
      </Section>

      <Section title="이 모듈이 지키는 것">
        <Surface>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 t-sub text-slate-600">
            <li>신고관리시스템 비밀번호를 저장하지 않습니다. 원본에 있던 메모 칸은 옮기지 않았습니다.</li>
            <li>연구노트 초안은 규칙으로 글을 짭니다 — 외부 AI 를 부르지 않습니다.</li>
            <li>업체 명단은 이 모듈이 따로 갖지 않습니다 — 고객 운영의 업체를 그대로 씁니다.</li>
            <li>판정은 2026 업무편람 기준 1차 검토이며, 신고 기관의 심사를 대신하지 않습니다.</li>
          </ul>
        </Surface>
      </Section>
    </div>
  )
}
