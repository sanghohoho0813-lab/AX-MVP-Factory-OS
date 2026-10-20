/**
 * D-248 명세서 쓰기 — 도면 초안 그림(흑백 SVG). 도 1 블록도(시스템 100 안 구성요소) · 도 2 순서도(단계 S110 …).
 * 특허로 제출용 그림의 출발점일 뿐 — 선 굵기 · 글자 크기는 사람이 다듬는다. PNG 로 내려받을 수 있다.
 *
 * D-249: 그림 글은 엔진(services/patent/specFigureSvg) 하나 — 화면(이미지) · PNG · 제출 준비 묶음(ZIP)이 같은 그림을 쓴다.
 */
import { Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { SpecDraft } from '../../services/patent/specDraft'
import { FIG_W, blockSvg, flowSvg, svgDataUrl } from '../../services/patent/specFigureSvg'
import { downloadBytes, svgToPngBytes } from './specFigureFile'

export function FigurePreview({ d, which, onError }: { d: SpecDraft; which: 1 | 2; onError: (msg: string) => void }) {
  const fig = which === 1 ? blockSvg(d) : flowSvg(d)
  const empty = fig.boxes === 0
  const download = () => {
    void svgToPngBytes(fig.svg, fig.height)
      .then((bytes) => downloadBytes(`fig${which}-draft.png`, bytes, 'image/png'))
      .catch((e: unknown) => onError(e instanceof Error ? e.message : '그림을 만들지 못했습니다'))
  }
  return (
    <figure className="flex min-w-0 flex-col gap-2" data-testid={`spec-fig-${which}`} data-boxes={fig.boxes}>
      <figcaption className="t-sub flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-800">
        <span>도 {which} {which === 1 ? '블록도' : '순서도'} 초안</span>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={download} data-testid={`spec-fig-${which}-png`}>
            <Download aria-hidden="true" className="size-4 shrink-0" /> PNG
          </Button>
        )}
      </figcaption>
      {empty ? (
        <p className="t-sub break-keep rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-6 text-center text-slate-500">{which === 1 ? '구성요소를 넣으면 그림이 나옵니다' : '단계를 넣으면 그림이 나옵니다'}</p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white">
          <img src={svgDataUrl(fig.svg)} alt={which === 1 ? '도 1 블록도 초안' : '도 2 순서도 초안'} width={FIG_W} height={fig.height} className="block h-auto w-full" data-testid={`spec-fig-${which}-img`} />
        </div>
      )}
    </figure>
  )
}
