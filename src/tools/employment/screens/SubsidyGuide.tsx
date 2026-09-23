/**
 * 공식 사이트 바로가기 · 대표 지원금 한눈에 보기 (D-92) — 원본 OfficialSites · BeginnerSubsidyGuide 그대로.
 * 외부 사이트는 새 탭 + noopener noreferrer 로 연다.
 */

import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Section } from '../../../components/ui/primitives'

const OFFICIAL_SITES = [
  { name: '고용24', desc: '고용지원금 확인·신청·기업지원 통합 창구', url: 'https://www.work24.go.kr', emoji: '🏛️', color: '#1D4ED8', bg: '#EFF6FF', bd: '#BFDBFE' },
  { name: '노사발전재단', desc: '일터혁신·워라밸·재직자 유지 지원사업 확인', url: 'https://www.nosa.or.kr', emoji: '🤝', color: '#334155', bg: '#F1F5F9', bd: '#E2E8F0' },
  { name: '여성새로일하기센터', desc: '새일여성인턴제 등 경력단절여성 채용 지원', url: 'https://saeil.mogef.go.kr', emoji: '👩‍💼', color: '#BE185D', bg: '#FDF2F8', bd: '#FBCFE8' },
  { name: '한국노인인력개발원', desc: '시니어 인턴십 등 고령자 채용 지원 확인', url: 'https://www.seniorro.or.kr', emoji: '🧓', color: '#B45309', bg: '#FFFBEB', bd: '#FDE68A' },
  { name: '장애인고용공단 e-신고', desc: '장애인 고용장려금 신고·확인', url: 'https://www.esingo.or.kr', emoji: '♿', color: '#0E7490', bg: '#ECFEFF', bd: '#A5F3FC' },
]

const REP_SUBSIDIES = [
  { emoji: '⭐', name: '청년일자리도약장려금', grp: '신규채용', tag: '청년 채용', one: '청년을 새로 채용한 기업이 가장 먼저 확인할 지원금', use: '신규 채용 상담 때 우선 검토' },
  { emoji: '🤝', name: '고용촉진장려금', grp: '신규채용', tag: '취약계층 채용', one: '취업취약계층 채용 시 검토', use: '채용 전후 요건 확인 필요' },
  { emoji: '🧓', name: '고령자 계속고용 장려금', grp: '재직자유지', tag: '정년 이후 고용', one: '고령 직원을 계속 고용할 때 검토', use: '제조업·현장직 고객사에 유용' },
  { emoji: '👵', name: '시니어 인턴십', grp: '신규채용', tag: '시니어 채용', one: '고령 인력 채용 시 확인', use: '한국노인인력개발원 확인' },
  { emoji: '👩‍💼', name: '새일여성인턴제', grp: '신규채용', tag: '여성 채용', one: '경력단절여성 채용 관련', use: '여성새로일하기센터 확인' },
  { emoji: '🤱', name: '육아휴직/대체인력', grp: '육아', tag: '육아·대체인력', one: '육아휴직·대체인력·근로시간 단축 관련', use: '인사노무 상담과 함께 활용' },
]
const TINT: Record<string, { bg: string; bd: string; c: string; pill: string }> = {
  신규채용: { bg: '#F5F9FF', bd: '#DCEAFE', c: '#1D4ED8', pill: '#DBEAFE' },
  재직자유지: { bg: '#F8F6FD', bd: '#E6DEF7', c: '#7C3AED', pill: '#EDE4FB' },
  육아: { bg: '#F2FBF6', bd: '#CBF0DA', c: '#059669', pill: '#D1FAE5' },
}

export function SubsidyGuide() {
  const [open, setOpen] = useState(true)
  const [primary, ...rest] = OFFICIAL_SITES
  return (
    <div className="flex flex-col gap-4" data-testid="emp-guide">
      <Section title="🔗 공식 사이트 바로가기" action={<span className="t-meta text-slate-500">신청·공고 확인은 공식 사이트, 고객사 관리는 이곳에서</span>}>
        <a href={primary.url} target="_blank" rel="noopener noreferrer" className="tap mb-2 flex items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5" style={{ background: 'linear-gradient(135deg,#EFF6FF,#FFFFFF)', borderColor: '#BFDBFE' }}>
          <span className="text-2xl">{primary.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="t-card block font-extrabold" style={{ color: primary.color }}>
              {primary.name} ↗
            </span>
            <span className="t-meta block text-slate-500">{primary.desc}</span>
          </span>
          <span className="t-meta shrink-0 rounded-full px-3 py-1 font-extrabold text-[#1D4ED8]" style={{ background: '#DBEAFE' }}>
            대표 창구
          </span>
        </a>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="tap flex items-center gap-2.5 rounded-xl border px-3.5 py-3" style={{ background: s.bg, borderColor: s.bd }}>
              <span className="text-xl">{s.emoji}</span>
              <span className="min-w-0">
                <span className="t-sub block font-extrabold" style={{ color: s.color }}>
                  {s.name} ↗
                </span>
                <span className="t-meta block text-slate-500">{s.desc}</span>
              </span>
            </a>
          ))}
        </div>
      </Section>
      <Section
        title="📚 대표 지원금 한눈에 보기"
        action={
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? '접기 ▲' : '펼치기 ▼'}
          </Button>
        }
      >
        <p className="t-sub mb-2 text-slate-500">이름만 봐선 감이 안 잡히죠. 어떤 상황에 쓰는지 쉽게 정리했어요.</p>
        {open && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REP_SUBSIDIES.map((s) => {
              const t = TINT[s.grp] ?? TINT['신규채용']
              return (
                <div key={s.name} className="flex flex-col gap-2 rounded-2xl border px-4 py-3.5" style={{ background: t.bg, borderColor: t.bd }}>
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{s.emoji}</span>
                    <b className="t-body break-keep text-slate-900">{s.name}</b>
                  </span>
                  <span className="t-meta w-fit rounded-full px-3 py-0.5 font-bold" style={{ color: t.c, background: t.pill }}>
                    {s.tag}
                  </span>
                  <span className="t-sub break-keep text-slate-700">{s.one}</span>
                  <span className="t-meta border-t border-dashed pt-2 break-keep text-slate-500" style={{ borderColor: t.bd }}>
                    📍 활용: {s.use}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
