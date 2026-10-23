/**
 * 좁은 칸에 갇힌 글자 찾기 — "글자가 세로로 길어지는" 현상 탐지.
 *
 *   node e2e/squeeze.mjs <baseUrl> [--all]
 *
 * 왜 필요한가:
 *   flex 줄 안에서 글자 칸이 `flex-1`(기준폭 0) 인데 옆의 버튼이 `shrink-0` 이면,
 *   브라우저는 줄바꿈(wrap)을 하지 않고 글자 칸만 20~60px 로 짜부라뜨린다.
 *   그러면 한 줄에 한 글자씩 세로로 흐른다. 스크린샷을 사람이 봐야만 보이던
 *   이 문제를 숫자로 잡는다.
 *
 * 판정:
 *   글자가 3줄 넘게 흐르는데 칸 너비가 화면의 35% 미만이고, 한 줄에 들어간
 *   글자 수가 평균 6자 미만이면 "짜부라짐" 으로 본다.
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const ALL = process.argv.includes('--all')

const SCREENS = [
  { name: '오늘', path: '/' },
  { name: '고객 운영', path: '/ops/clients' },
  { name: '업체 개요', path: '/ops/clients/cli_hansol' },
  { name: '업체 업무', path: '/ops/clients/cli_hansol?tab=work' },
  { name: '업체 서류', path: '/ops/clients/cli_hansol?tab=docs' },
  { name: '업체 수금', path: '/ops/clients/cli_hansol?tab=fees' },
  { name: '업체 자금', path: '/ops/clients/cli_daum?tab=funding' },
  { name: '이벤트함', path: '/ops/inbox' },
  { name: '업무 일기', path: '/journal' },
  { name: '일정', path: '/ops/calendar' },
  { name: '전체 도구', path: '/tools' },
  { name: '설정', path: '/settings' },
  { name: '기획의도', path: '/why' },
  { name: '성과 지표', path: '/kpi' },
  { name: '향후 확장', path: '/roadmap' },
  { name: '컨설팅 작업실', path: '/studio' },
  { name: '컨설팅 개요', path: '/studio/proj_hansol' },
  { name: '컨설팅 단계', path: '/studio/proj_hansol?adv=1&tab=stages' },
  { name: '컨설팅 사실표', path: '/studio/proj_hansol?adv=1&tab=factsheet' },
  { name: '컨설팅 줄기', path: '/studio/proj_hansol?adv=1&tab=thread' },
  { name: '컨설팅 특허', path: '/studio/proj_hansol?adv=1&tab=patent' },
  { name: '컨설팅 MVP', path: '/studio/proj_hansol?adv=1&tab=mvp' },
  { name: '컨설팅 벤처', path: '/studio/proj_hansol?adv=1&tab=venture' },
  { name: '컨설팅 증빙', path: '/studio/proj_hansol?adv=1&tab=evidence' },
  { name: '컨설팅 프롬프트', path: '/studio/proj_hansol?adv=1&tab=prompts' },
  { name: '컨설팅 산출물', path: '/studio/proj_hansol?adv=1&tab=artifacts' },
  { name: '컨설팅 실사', path: '/studio/proj_hansol?adv=1&tab=review' },
]
/*
 * D-273 대표 휴대폰에서 AI 전략실 첫 화면 제목 '바로 시작 — 타자 없이' 가 한 글자씩 세로로 흘렀다 — 이 검사 목록에 없던 화면.
 * --all 일 때는 메뉴에 있는 화면을 모두 본다(대표 전용 · 특허 · 벤처 · 마케팅 · 영업 · 돈 · 지원사업 · 기업인증 …).
 */
const MENU_SCREENS = [
  { name: 'AI 전략실', path: '/ai' },
  { name: 'AI 전략실 사용량', path: '/ai/usage' },
  { name: '특허 · 벤처', path: '/patent-venture' },
  { name: '특허 명세서', path: '/patent-venture/write' },
  { name: '기업인증', path: '/tools/cert-os' },
  { name: '기업인증 한솔', path: '/tools/cert-os?client=cli_hansol' },
  { name: '마케팅', path: '/marketing' },
  { name: '유튜브', path: '/marketing/youtube' },
  { name: '스레드', path: '/marketing/threads' },
  { name: '스레드 기록표', path: '/marketing/threads?tab=records' },
  { name: '스레드 틀', path: '/marketing/threads?tab=library' },
  { name: '스레드 10분', path: '/marketing/threads?tab=routine' },
  { name: '릴스 · 틱톡', path: '/marketing/shorts' },
  { name: '릴스 · 틱톡 기록표', path: '/marketing/shorts?tab=records' },
  { name: '릴스 · 틱톡 공식', path: '/marketing/shorts?tab=guide' },
  { name: '홍보 글', path: '/tools/content' },
  { name: '홈페이지', path: '/tools/homepage' },
  { name: '웹 스튜디오', path: '/website-studio' },
  { name: '영업 보드', path: '/sales/board' },
  { name: '1차 미팅', path: '/sales/first-meeting' },
  { name: '매출 · 비용', path: '/money' },
  { name: '지원사업', path: '/grants' },
  { name: '정책자금', path: '/funding' },
  { name: '정책자금 목록', path: '/funding/catalog' },
  { name: '진단', path: '/diagnosis' },
  { name: '상담신청함', path: '/ops/inbox' },
  { name: '결정', path: '/ops/decide' },
  { name: '업체 AI 전략실 탭', path: '/ops/clients/cli_hansol?tab=ai' },
]
if (ALL) SCREENS.push(...MENU_SCREENS)

const VIEWPORTS = ALL
  ? [
      { tag: '360', width: 360 },
      { tag: '390', width: 390 },
      { tag: '430', width: 430 },
      { tag: '360-large', width: 360, scale: 'extra_large' },
    ]
  : [{ tag: '390', width: 390 }]

/** 브라우저 안에서 도는 검사기. Range 로 실제 줄 수를 센다. */
const DETECTOR = `(() => {
  const bad = []
  const seen = new Set()
  for (const el of document.querySelectorAll('p, span, div, h1, h2, h3, h4, li, label, button, a, td, th')) {
    // 글자만 든 잎사귀 요소만 본다 (자식 요소가 있으면 그 자식이 잡힌다)
    const text = (el.textContent || '').trim()
    if (text.length < 8) continue
    if (el.children.length > 0 && Array.from(el.children).some((c) => (c.textContent || '').trim().length >= 8)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue

    // 실제로 몇 줄로 흘렀는지 — 글자 상자의 세로 위치 종류를 센다
    let lines = 1
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      // D-110: 한 줄 안에서도 글자 상자와 감싼 요소 상자의 top 이 1~2px 어긋난다(줄 간격 반쪽).
      // 그걸 다른 줄로 세면 2줄짜리가 4줄로 잡힌다 — 4px 안의 top 은 같은 줄로 묶는다.
      // 진짜 줄바꿈은 한 줄 높이(12px 이상)만큼 떨어지므로 그대로 잡힌다.
      const ys = []
      for (const r of range.getClientRects()) {
        if (r.width > 0 && r.height > 0) ys.push(r.top)
      }
      ys.sort((a, b) => a - b)
      let rows = 0
      let last = -Infinity
      for (const y of ys) {
        if (y - last > 4) rows += 1
        last = y
      }
      if (rows > 0) lines = rows
    } catch { /* 무시 */ }

    if (lines < 4) continue
    const perLine = text.length / lines
    const widthRatio = rect.width / window.innerWidth
    if (perLine < 6 && widthRatio < 0.35) {
      const key = text.slice(0, 30) + '|' + Math.round(rect.left)
      if (seen.has(key)) continue
      seen.add(key)
      bad.push({
        text: text.slice(0, 40),
        width: Math.round(rect.width),
        lines,
        perLine: Number(perLine.toFixed(1)),
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
      })
    }
  }
  return bad
})()`

const problems = []

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: 900 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    let page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(seedScript())
    if (vp.scale) {
      await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.scale)
    }

    for (const [i, screen] of SCREENS.entries()) {
      // D-273 화면을 많이 돌면 한 탭이 무거워져 브라우저가 탭을 죽인다 — 열 화면마다 새 탭(같은 저장소)
      if (i && i % 10 === 0) {
        await page.close()
        page = await ctx.newPage()
      }
      await page.goto(BASE + screen.path, { waitUntil: 'networkidle' })
      if (vp.scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), vp.scale)
      await page.waitForTimeout(600)
      const bad = await page.evaluate(DETECTOR)
      for (const b of bad) {
        problems.push(`[${vp.tag}] ${screen.name}: "${b.text}" — ${b.width}px 칸에 ${b.lines}줄 (줄당 ${b.perLine}자) <${b.tag} class="${b.cls}">`)
      }
    }
    await ctx.close()
  }

  await browser.close()

  if (problems.length === 0) {
    console.log('짜부라진 글자 없음 ✅')
  } else {
    console.log(`짜부라진 글자 ${problems.length}건:`)
    for (const p of problems) console.log('  ' + p)
  }
  process.exit(problems.length > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(2)
})
