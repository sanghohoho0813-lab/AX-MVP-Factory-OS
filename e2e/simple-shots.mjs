/**
 * 간단 모드 보고용 화면 5장 (§55) — 실제 흐름을 밟으며 찍는다.
 *   node e2e/simple-shots.mjs <baseUrl> <outDir>
 *
 * 1 프로젝트 첫 화면 (지금 할 일)
 * 2 특허 흐름 — 후보 고르기
 * 3 프롬프트 생성 결과
 * 4 GPT 결과 가져오기
 * 5 목록 (누구 / 어디까지 / 지금 무엇)
 */

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript, SEED_PROJECT_ID } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? 'docs/qa/simple'
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function shot(page, file) {
  await page.screenshot({ path: `${OUT}/${file}` })
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${file} overflow=${o}`)
}

/* 모바일 390 — 실제 흐름 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())

  await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
  await wait(900)
  await shot(page, '05-list-390.png')

  await page.goto(BASE + `/studio/${SEED_PROJECT_ID}`, { waitUntil: 'networkidle' })
  await wait(900)
  await shot(page, '01-home-390.png')

  // 프롬프트 만들기 → 결과 패널
  await page.locator('button.bg-brand-600').first().click()
  await wait(1600)
  await shot(page, '03-prompt-390.png')

  // 결과 가져오기 시트
  await page.getByRole('button', { name: '결과 가져오기' }).first().click()
  await wait(600)
  await page.getByLabel('결과 붙여넣기').fill(
    '# 특허 아이디어\n현장 데이터에서 작업지연 위험을 산출하는 구조를 세 방향으로 정리했습니다.\n\n--- MIRAE_OS_RETURN ---\nTYPE: PATENT_IDEA\nSUMMARY: 공정 데이터 정규화 후 위험 산출 / 작업자 배정 최적화 / 납기 예측 세 방향\nDECISION_OPTIONS:\n1) 공정 데이터 정규화 후 위험 산출 및 우선순위 재배치\n2) 작업자 숙련도 기반 배정 최적화\n3) 공정 이력 기반 납기 예측\nMISSING_FACTS:\n- 최근 3개년 매출\nNEXT_RECOMMENDATION: 선행기술 검토로 넘어가세요\n--- END_MIRAE_OS_RETURN ---',
  )
  await wait(600)
  await shot(page, '04-import-390.png')

  // 저장 → 후보 고르기 (특허 흐름)
  await page.getByRole('button', { name: '저장하고 계속' }).click()
  await wait(1800)
  await shot(page, '02-patent-choice-390.png')
  await ctx.close()
}

/* 데스크톱 한 장 — 같은 첫 화면 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.goto(BASE + `/studio/${SEED_PROJECT_ID}`, { waitUntil: 'networkidle' })
  await wait(900)
  await shot(page, '06-home-1440.png')
  await ctx.close()
}

await browser.close()
