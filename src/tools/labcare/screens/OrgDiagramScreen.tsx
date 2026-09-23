/**
 * 조직도 · 도면 (D-91).
 *
 * 설립신고 구비서류 ⑦⑧ — 조직도와 현판·내부 사진이다.
 * 원본(app/org-diagram)의 조직도 SVG 를 그대로 옮겼다(좌표·색·글자 크기까지).
 * 연구원 이름은 '연구소 고객사' 에 적어 둔 것을 그대로 끌어온다 — 두 번 적지 않는다.
 *
 * 도면 편집기(원본 FloorPlanner, 1,200줄 규모의 그림 도구)는 **아직 옮기지 않았다.**
 * 그 자리에 무엇이 필요한지와 촬영 가이드를 두고, 없는 것은 없다고 적는다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Printer, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Section, Surface } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { downloadSvgAsJpeg, printSvg } from '../lib/download'
import type { LabInfoData } from '../lib/labInfo'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

interface Dept {
  name: string
  count: number
}

/** 업무편람 기준 사진촬영 가이드 — 원본 PHOTO_GUIDE 그대로 */
const PHOTO_GUIDE: readonly { key: string; label: string; desc: string }[] = [
  { key: 'sign', label: '전용출입구 현판', desc: '현판 글자가 읽히도록 근접 촬영' },
  { key: 'door', label: '출입문 전체', desc: '출입문과 현판 위치가 함께 보이도록 촬영' },
  { key: 'front', label: '내부 — 전면', desc: '출입문 기준 정면 방향, 책상·기자재가 보이게' },
  { key: 'back', label: '내부 — 후면', desc: '반대 방향에서 공간 전체가 보이게' },
  { key: 'left', label: '내부 — 좌측', desc: '좌측 벽면과 기자재·좌석이 보이게' },
  { key: 'right', label: '내부 — 우측', desc: '우측 벽면과 기자재·좌석이 보이게' },
  { key: 'rooms', label: '2실 이상', desc: '각 실별로 전·후·좌·우 촬영' },
  { key: 'building', label: '독립공간 / 층 전체', desc: '필요 시 외부 전경 또는 층 구성 확인 사진 준비' },
]

const PHOTO_GOOD = ['현판 글자가 선명함', '출입문과 현판 위치가 함께 보임', '책상·PC·연구기자재가 함께 보임', '도면상 배치와 사진이 일치함']
const PHOTO_BAD = ['너무 가까운 부분 사진', '현판 글자가 흐림', '책상 일부만 보임', '도면과 실제 배치가 다름']

export function OrgDiagramScreen() {
  const { loadClients, clientId } = useToolClient()
  const info = useModuleBucket<LabInfoData>('labcare', 'labInfo')
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [picked, setPicked] = useState(clientId ?? '')
  const [ceo, setCeo] = useState('')
  const [depts, setDepts] = useState<Dept[]>([
    { name: '경영지원팀', count: 2 },
    { name: '영업팀', count: 3 },
  ])
  const orgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      const live = list.filter((c) => c.archivedAt === null)
      if (!alive) return
      setClients(live)
      setPicked((cur) => cur || live[0]?.id || '')
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const client = clients.find((c) => c.id === picked)
  const labInfo = (info.rows ?? []).find((r) => r.clientId === picked)?.data

  useEffect(() => {
    setCeo((cur) => cur || client?.representativeName || '')
  }, [client])

  const members = useMemo(() => {
    const list = labInfo?.researchers ?? []
    const head = list.find((r) => r.role.includes('소장') || r.role.includes('부서장'))
    const rest = list.filter((r) => r !== head)
    return {
      head: head?.name ?? '',
      dedicated: rest.filter((r) => r.dedicated).map((r) => r.name),
      others: rest.filter((r) => !r.dedicated).map((r) => r.name),
    }
  }, [labInfo])

  const company = client?.companyName ?? '회사'

  return (
    <div className="flex flex-col gap-5" data-testid="lab-org">
      <Surface>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">업체</span>
            <select aria-label="조직도 업체" value={picked} onChange={(e) => setPicked(e.target.value)} className={`mt-1 ${inputCls}`}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">대표이사</span>
            <input aria-label="대표이사" value={ceo} onChange={(e) => setCeo(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>

        <div className="flex flex-col gap-2 pt-3">
          <span className="t-sub font-medium text-slate-600">연구소 밖 부서</span>
          {depts.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-2">
              <input
                aria-label={`${i + 1}번째 부서 이름`}
                value={d.name}
                onChange={(e) => setDepts(depts.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)))}
                className={inputCls}
              />
              <input
                aria-label={`${i + 1}번째 부서 인원`}
                inputMode="numeric"
                value={d.count}
                onChange={(e) => setDepts(depts.map((x, j) => (i === j ? { ...x, count: Number(e.target.value) || 0 } : x)))}
                className={`${inputCls} text-right tabular-nums`}
              />
              <Button variant="ghost" size="sm" aria-label={`${i + 1}번째 부서 지우기`} onClick={() => setDepts(depts.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setDepts(depts.concat([{ name: '', count: 1 }]))}>
            <Plus aria-hidden="true" className="size-4" /> 부서 더하기
          </Button>
        </div>

        <p className="t-meta break-keep pt-2 text-slate-500">
          연구소장·연구전담요원은 <b>연구소 고객사</b> 에 적어 둔 명단을 그대로 씁니다. 고치려면 그 화면에서 고치세요.
        </p>
      </Surface>

      <Section
        title="조직도"
        action={
          <span className="flex gap-2">
            <Button size="sm" onClick={() => downloadSvgAsJpeg(orgRef.current, `${company}_조직도.jpg`)}>
              <Download aria-hidden="true" className="size-4" /> JPEG
            </Button>
            <Button variant="ghost" size="sm" onClick={() => printSvg(orgRef.current, `${company} 조직도`)}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄·PDF
            </Button>
          </span>
        }
      >
        <Surface>
          <OrgChartSvg
            innerRef={orgRef}
            company={company}
            ceo={ceo}
            depts={depts}
            labHead={members.head}
            researchers={members.dedicated}
            assistants={members.others}
          />
          <p className="t-meta break-keep pt-2 text-slate-500">
            전담 = 연구전담요원 · 보조 = 연구보조원 — 연구전담요원·보조원은 타 업무 겸직이 안 됩니다.
          </p>
        </Surface>
      </Section>

      <Section title="현판·내부 사진촬영 가이드" count={PHOTO_GUIDE.length}>
        <Surface>
          <ul className="flex flex-col gap-2">
            {PHOTO_GUIDE.map((g) => (
              <li key={g.key} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600">
                  ✓
                </span>
                <p className="t-sub break-keep text-slate-700">
                  <b className="text-slate-900">{g.label}</b>
                  <span className="text-slate-500"> — {g.desc}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <div className="rounded-(--radius-panel) border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="t-sub font-bold text-emerald-700">좋은 예</p>
              <ul className="t-meta mt-1 flex flex-col gap-1 text-slate-700">
                {PHOTO_GOOD.map((t) => (
                  <li key={t}>· {t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-(--radius-panel) border border-rose-200 bg-rose-50/60 p-3">
              <p className="t-sub font-bold text-rose-700">피할 것</p>
              <ul className="t-meta mt-1 flex flex-col gap-1 text-slate-700">
                {PHOTO_BAD.map((t) => (
                  <li key={t}>· {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </Surface>
      </Section>

      <Section title="연구공간 도면">
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600" data-testid="lab-floorplan-note">
            도면 <b>편집기</b>(공간을 직접 그리는 도구)는 아직 옮기지 않았습니다. 지금은 기존 도면 파일을
            업체 서류함에 올려 두고 쓰세요 — 도면은 <b>실제 배치와 사진이 일치</b>하는 것이 핵심이며,
            그 판단은 위의 촬영 가이드와 현장조사 대비 화면이 맡습니다.
          </p>
        </Surface>
      </Section>
    </div>
  )
}

/* ═════════════ 조직도 SVG — 원본 OrgChartSvg 그대로 ═════════════ */

function OrgChartSvg({
  innerRef,
  company,
  ceo,
  depts,
  labHead,
  researchers,
  assistants,
}: {
  innerRef: React.Ref<SVGSVGElement>
  company: string
  ceo: string
  depts: Dept[]
  labHead: string
  researchers: string[]
  assistants: string[]
}) {
  const cols = depts.length + 1
  const colW = 158
  const gap = 18
  const totalW = Math.max(560, cols * colW + (cols - 1) * gap + 48)
  const startX = (totalW - (cols * colW + (cols - 1) * gap)) / 2
  const labX = startX + depts.length * (colW + gap)
  const labMembers = [
    ...researchers.map((r) => ({ t: '전담', n: r, c: '#1d4ed8' })),
    ...assistants.map((a) => ({ t: '보조', n: a, c: '#7c3aed' })),
  ]
  const labBoxH = 92 + labMembers.length * 30
  const totalH = 150 + Math.max(110, labBoxH) + 16
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')

  return (
    <svg ref={innerRef} viewBox={`0 0 ${totalW} ${totalH}`} className="w-full rounded-lg bg-white ring-1 ring-slate-200" role="img" aria-label={`${company} 조직도`}>
      <rect x="0" y="0" width={totalW} height="44" fill="#13233b" />
      <text x="20" y="28" fontSize="17" fontWeight="bold" fill="#ffffff">
        {company} 조직도
      </text>
      <text x={totalW - 20} y="19" fontSize="11" fill="#cbd5e1" textAnchor="end">
        설립신고 첨부용 조직도 초안
      </text>
      <text x={totalW - 20} y="35" fontSize="11" fill="#94a3b8" textAnchor="end">
        작성일 {today}
      </text>

      <rect x={totalW / 2 - 90} y={60} width="180" height="44" rx="10" fill="#1b2d49" />
      <text x={totalW / 2} y={79} fontSize="11" fill="#93c5fd" textAnchor="middle">
        대표이사
      </text>
      <text x={totalW / 2} y={96} fontSize="15" fontWeight="bold" fill="#ffffff" textAnchor="middle">
        {ceo || '-'}
      </text>

      <line x1={totalW / 2} y1={104} x2={totalW / 2} y2={126} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={startX + colW / 2} y1={126} x2={labX + colW / 2} y2={126} stroke="#94a3b8" strokeWidth="1.5" />

      {depts.map((d, i) => {
        const x = startX + i * (colW + gap)
        return (
          <g key={i}>
            <line x1={x + colW / 2} y1={126} x2={x + colW / 2} y2={146} stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={x} y={146} width={colW} height="54" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x={x} y={146} width={colW} height="7" fill="#cbd5e1" />
            <text x={x + colW / 2} y={174} fontSize="14" fontWeight="bold" fill="#334155" textAnchor="middle">
              {d.name || '부서'}
            </text>
            <text x={x + colW / 2} y={192} fontSize="12" fill="#64748b" textAnchor="middle">
              {d.count}명
            </text>
          </g>
        )
      })}

      <line x1={labX + colW / 2} y1={126} x2={labX + colW / 2} y2={146} stroke="#1d4ed8" strokeWidth="2" />
      <rect x={labX} y={146} width={colW} height={labBoxH} rx="12" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="2.5" />
      <rect x={labX} y={146} width={colW} height="30" rx="10" fill="#1d4ed8" />
      <text x={labX + colW / 2} y={166} fontSize="13" fontWeight="bold" fill="#ffffff" textAnchor="middle">
        연구소 / 전담부서
      </text>
      <rect x={labX + 14} y={186} width={colW - 28} height="32" rx="8" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1.5" />
      <text x={labX + colW / 2} y={207} fontSize="13" fontWeight="bold" fill="#1d4ed8" textAnchor="middle">
        연구소장 {labHead || '-'}
      </text>
      {labMembers.map((m, i) => (
        <g key={i}>
          <rect x={labX + 14} y={228 + i * 30} width={colW - 28} height="24" rx="6" fill="#ffffff" stroke="#dbeafe" />
          <rect x={labX + 18} y={232 + i * 30} width="34" height="16" rx="4" fill={m.c} />
          <text x={labX + 35} y={244 + i * 30} fontSize="10" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            {m.t}
          </text>
          <text x={labX + 60} y={245 + i * 30} fontSize="12" fill="#1e293b">
            {m.n}
          </text>
        </g>
      ))}
    </svg>
  )
}
