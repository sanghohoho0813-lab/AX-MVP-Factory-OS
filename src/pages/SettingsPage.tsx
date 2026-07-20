import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { HelpNote } from '../components/ui/HelpNote'
import { TextScaleControl } from '../components/ui/TextScaleControl'

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
      <PageHeader
        title="설정"
        description="화면 표시와 운영 환경을 관리합니다."
      />

      <Panel title="글자 크기">
        <HelpNote
          summary="화면 전체의 글자 크기를 조절합니다. 선택하면 즉시 모든 화면에 반영되고, 다음에 접속해도 유지됩니다."
        />
        <div className="mt-4">
          <TextScaleControl showPreview />
        </div>
      </Panel>

      <Panel title="워크스페이스">
        <p className="text-sm break-keep text-slate-500">
          워크스페이스·구성원·알림 설정은 다음 개발 단계에서 제공됩니다.
        </p>
      </Panel>
    </div>
  )
}
