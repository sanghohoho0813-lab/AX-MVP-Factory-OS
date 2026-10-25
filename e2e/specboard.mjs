/**
 * qa:specboard — D-252 명세서 AI 작업판(AI 가 다 쓰는 명세서). 실행: npm run qa:specboard -- http://localhost:4390 [사진 폴더]
 *  - D-271 기획 대화: 새 명세서 → AI 의 회사 이해 · 의견 · 질문(누를 답)까지만 저절로 → 답을 누르면 다음 질문 → '충분' 이면 그 답대로 아이디어 5개
 *    · [자료 넣기] 창(업체 서류함 · 파일 · 글 붙여넣기 · 빼기) · 휴지통(되살리기 · 두 번 확인 영구 삭제 · 새로 쓰기)
 *  - D-269 기획 먼저: 새 명세서 → 아이디어 5개(순위 · 이유)까지만 저절로 → [제일 좋은 게 뭐야?] · [자체점검으로 더 짜내기] → 골라 [이걸로 시작]
 *    → 조사 · 구성 · 자체점검 ① 에서 멈춤(구성 확인) → [이 구성으로 본문 · 청구항 쓰기] → 전문 보기(기본) · 나눠서 보기(칸마다 복사)
 *  - D-269 모델: 쓰는 중에 모델을 바꾸면 다음 단계부터 그 모델 · 단계마다 쓴 모델 표시 · 회사 이야기가 없으면 '회사 정보부터'
 *  - 새 명세서 → AI 작업판이 먼저(대표) · 모델 고르기 단추 · 칸 여섯(접어 둠) · 타자 칠 칸 0
 *  - [전부 써줘] 한 번 → 아이디어 → 조사 → 구성 → 본문 a~d → 청구항 → 점검대로 고치기 차례로 · 칸마다 결과
 *  - 아이디어 후보 3 · 추천 1번이 바로 들어감 · 다른 것 고르기(한 번 더 묻기 · 구성 이후 비움 · 되돌리기)
 *  - 조사: 검색 근거 · 출처 · KIPRIS 검색어 · 청구항 묶음에 차별화가 감
 *  - 쓰는 중에 목록으로 나갔다 와도 그 사이 받은 글이 들어감 · 다시 부르지 않음
 *  - [직접 고치기] = 예전 단계 화면 · ?step= 으로 열어도 대표는 작업판 먼저(D-261) · 자료 넣기(파일 → 읽은 글만)
 *  - 360 · 390 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}` : ''}`)
}
const shot = async (page, name, full = true) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const CLIENT = 'cli_hansol'

// 시험용 발명(실제 고객 발명 아님)
const IDEAS = [
  { title: '공구 진동정보 기반 마모 단계 판정 및 교체시점 산출 시스템 및 방법', body: 'SYSTEM AND METHOD FOR JUDGING TOOL WEAR STAGE AND SCHEDULING REPLACEMENT BASED ON VIBRATION', detail: '상담 메모의 공구 교체 불량 이야기에서 나왔습니다.', outline: ['① 현재 문제: 공구 교체 시점을 감으로 정해 불량과 과잉 교체가 반복된다', '기존 방식: 정해진 사용 시간이 지나면 일괄 교체한다', '진동 특성을 기준값과 비교해 마모 단계를 나눈다', '진동 수집 → 정규화 → 마모 지수 갱신 → 판정 → 교체 알림 → 결과 재반영', '마모 지수 누적 갱신과 작업 일정을 함께 써서 교체 시점을 정하는 연결'] },
  { title: '작업지시 데이터 기반 설비 가동 순서 추천 시스템 및 방법', body: 'SYSTEM AND METHOD FOR RECOMMENDING EQUIPMENT RUN ORDER', detail: '납기 지연 이야기에서 나왔습니다.', outline: ['납기가 겹치면 설비 순서를 사람이 정한다', '엑셀로 순서를 짠다', '작업지시와 설비 상태를 함께 본다', '작업지시 수집 → 설비 상태 → 순서 점수 → 추천 → 실행 결과 반영', '설비 상태와 납기를 함께 쓴 순서 점수'] },
  { title: '불량 사진 기반 공정 원인 분류 시스템 및 방법', body: '불량 사진 영문', detail: '(추정 — 대표 확인)', outline: ['불량 원인을 사람이 추정한다', '경험으로 판단한다', '사진 특징과 공정 기록을 잇는다', '사진 → 특징 → 공정 기록 매칭 → 원인 → 알림 → 재반영', '사진 특징과 공정 기록의 연결'] },
  { title: '공구 재고 기반 발주 시점 산출 시스템 및 방법', body: 'SYSTEM AND METHOD FOR CALCULATING TOOL ORDER TIME', detail: '공구 재고 메모에서 나왔습니다.', outline: ['공구 재고가 떨어져 라인이 선다', '재고표를 눈으로 본다', '마모 예측과 재고를 잇는다', '재고 수집 → 소진 예측 → 발주 시점 → 알림 → 재반영', '마모 예측과 재고 소진의 연결'] },
  { title: '작업자 숙련도 기반 공정 배치 시스템 및 방법', body: 'SYSTEM AND METHOD FOR ASSIGNING WORKERS', detail: '인력 메모에서 나왔습니다.', outline: ['숙련도와 공정이 맞지 않는다', '반장이 정한다', '숙련도 기록과 공정 난이도를 잇는다', '기록 수집 → 점수 → 배치 → 결과 반영', '숙련도와 불량률의 연결'] },
].map((x, i) => ({ ...x, amount: String([88, 76, 64, 55, 48][i]), tag: i < 3 ? `${i + 1}순위` : '후보', when: ['상담 메모의 공구 교체 불량과 바로 이어지고 진동 데이터가 이미 있음', '납기 문제와 맞지만 엑셀 순서표와 차이가 약함', '사진 자료가 아직 없음', '마모 예측에 기대는 파생 아이디어', '회사 자료와 연결이 약함'][i] }))
/* D-269 [이 중 제일 좋은 게 뭐야?] — 후보 2(작업지시)가 가장 낫다고 다시 매김 */
const IDEA_RANK = { headline: '후보 2 — 납기 지연이 회사의 가장 큰 문제', items: [{ title: '후보 1', amount: '90', tag: '2순위', when: '진동 데이터는 있으나 흔한 방식과 차이가 작음' }, { title: '후보 2', amount: '95', tag: '1순위', when: '납기 지연이 상담 메모에서 가장 크게 나옴' }, { title: '후보 3', amount: '60', tag: '후보', when: '사진 자료 없음' }, { title: '후보 4', amount: '58' }, { title: '후보 5', amount: '41' }] }
/* D-269 [자체점검으로 더 짜내기] — 새 아이디어 2개 */
const IDEA_MORE = {
  headline: '지금 후보는 마모 판정이 흔한 임계값 비교에 머문다',
  items: [
    { title: '공구 마모 지수와 작업 일정 연계 교체 배치 시스템 및 방법', body: 'SYSTEM AND METHOD FOR SCHEDULING TOOL REPLACEMENT', detail: '공구 교체 불량과 납기 지연 메모를 함께 씀', outline: ['교체가 작업 중간에 끼어 납기가 밀린다', '교체 시점과 일정이 따로 논다', '마모 지수와 일정 빈 시간을 함께 쓴다', '진동 → 마모 지수 → 일정 → 교체 배치 → 결과 반영', '마모 지수와 일정 빈 시간의 연결'], amount: '92', tag: '새 아이디어', when: '흔한 임계값 비교를 넘어 일정과 잇는다' },
    { title: '절삭유 상태 기반 공구 수명 보정 시스템 및 방법', body: 'SYSTEM AND METHOD FOR CORRECTING TOOL LIFE', detail: '절삭유 교체 메모', outline: ['절삭유 상태가 수명에 반영되지 않는다', '수명은 고정값이다', '절삭유 상태로 수명을 보정한다', '절삭유 측정 → 보정 → 수명 → 알림 → 재반영', '절삭유 상태와 수명 보정의 연결'], amount: '70', tag: '새 아이디어', when: '다른 데이터에서 출발' },
  ],
}
const PARTS = [
  ...['input', 'process', 'state', 'judge', 'output', 'feedback', 'link'].map((k, i) => ({ title: `axis.${k}`, body: ['공구의 진동신호를 수집하는', '진동신호를 측정항목으로 정규화한다', '마모 지수를 누적 갱신하는', '마모 지수와 기준값을 비교하여 마모 단계를 판정하는', '교체 시점을 산출하여 알리는', '교체 결과를 기준값에 다시 반영하는', '누적 갱신한 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는'][i] })),
  { title: 'system', body: '공구 마모 예측 시스템' },
  { title: 'comp', detail: '진동 수집부', body: '공구의 진동신호를 수집하는' },
  { title: 'comp', detail: '정규화부', body: '진동신호를 측정항목으로 정규화하는' },
  { title: 'comp', detail: '마모지수 갱신부', body: '마모 지수를 누적 갱신하는' },
  { title: 'comp', detail: '마모 판정부', body: '마모 단계를 판정하는' },
  { title: 'comp', detail: '교체시점 산출부', body: '작업 일정과 함께 교체 시점을 산출하는' },
  { title: 'step', body: 'S110 진동신호를 수집하는' },
  { title: 'step', body: '진동신호를 정규화하는' },
  { title: 'step', body: '마모 지수를 갱신하는' },
  { title: 'step', body: '마모 단계를 판정하는' },
  { title: 'step', body: '교체 시점을 산출하는' },
  { title: 'seed', detail: '마모 판정부', body: '마모 단계를 세 단계로 나누는' },
  { title: 'seed', detail: '교체시점 산출부', body: '다음 작업 일정의 빈 시간에 교체를 배치하는' },
]
/* D-271 기획 대화 — 'ask': 질문 두 번 뒤 '충분' · 'enough': 첫 번에 '충분'(바로 아이디어로) */
let talkMode = 'ask'
const talkAnswer = (ctx) => {
  const n = (JSON.stringify(ctx ?? '').match(/대표 답:/g) ?? []).length
  if (talkMode === 'enough' || n >= 2) return { headline: '진동 마모 지수 + 작업 일정으로 교체 시점', items: [{ tag: '의견', title: '마모 지수와 작업 일정 연결', detail: '흔한 임계값 비교보다 회피가 어려움' }, { tag: '충분', title: '고객 · 데이터 · 판단이 정해져 아이디어를 낼 수 있습니다' }] }
  if (n === 0)
    return {
      headline: '공구 교체를 데이터로',
      items: [
        { tag: '이해', title: '금속가공 라인의 절삭 공구 교체를 작업자 감으로 하는 회사', detail: '상담 메모 · 현장 메모' },
        { tag: '의견', title: '일반적인 공구 수명 타이머', detail: '너무 흔하고 진보성이 약함' },
        { tag: '의견', title: '진동 데이터로 마모 단계 판정', detail: '회사에 진동 기록이 있어 근거가 됨 — 다만 임계값 비교만이면 약함' },
        { tag: '질문', title: '어느 문제를 먼저 풀고 싶으세요?', detail: '권리화 중심을 정하려고', outline: ['① 공구 교체 불량', '② 납기 지연', '③ 공구 재고 부족', '잘 모르겠어요 — AI 가 정해 주세요'] },
      ],
    }
  return { headline: '교체 불량 중심', items: [{ tag: '의견', title: '교체 알림만', detail: '경쟁사가 쉽게 피함' }, { tag: '질문', title: '교체 시점을 무엇과 함께 정하면 좋을까요?', detail: '연결관계를 정하려고', outline: ['작업 일정', '공구 재고', '작업자 숙련도', '잘 모르겠어요 — AI 가 정해 주세요'] }] }
}
let bodyRound = 0
const answer = (id) => {
  switch (id) {
    case 'spec.idea':
      return { headline: '1번 — 상담 메모에 나온 문제와 바로 이어집니다', items: IDEAS, next: ['진동 데이터를 실제로 모으는지 확인'] }
    case 'spec.ideaRank':
      return IDEA_RANK
    case 'spec.ideaMore':
      return IDEA_MORE
    case 'spec.research':
      return {
        headline: '그대로 가도 되지만 작업 일정 연결을 독립항에 꼭 넣으세요',
        items: [
          { tag: '검색어', title: 'KIPRIS 검색어', outline: ['공구 마모 AND 진동', 'tool wear vibration', 'B23Q 17/09'] },
          { tag: '비슷한 기술', title: '진동 기반 공구 수명 예측', detail: '진동 RMS 로 수명을 추정하는 방식이 널리 알려져 있습니다.' },
          { tag: '차별화', title: '작업 일정과 마모 지수를 함께 쓰는 교체 시점 산출', detail: '독립항 1 에 일정 연결을 넣습니다.' },
          { tag: '위험', title: '단순 임계값 비교만으로는 진보성이 약함', detail: '누적 갱신 방식을 구체적으로.' },
        ],
        next: ['KIPRIS 에서 B23Q 17/09 최근 3년 확인'],
      }
    case 'spec.parts':
      return { headline: '진동 → 마모 지수 → 교체 시점', items: PARTS }
    case 'spec.a':
      return { headline: 'a', items: [{ title: 'field', body: `본 발명은 공구 마모 판정 시스템에 관한 것이다.${bodyRound > 1 ? ' (2차)' : ''}` }, { title: 'background', body: '종래에는 정해진 사용 시간이 지나면 공구를 교체하였다.', detail: '종래 기술 출처 확인' }, { title: 'problem', body: '본 발명은 교체 시점을 산출하는 것을 목적으로 한다.' }, { title: 'effect', body: '불필요한 교체를 줄일 수 있다.' }] }
    case 'spec.b':
      return { headline: 'b', items: [{ title: 'solution', body: '상기 목적을 달성하기 위한 본 발명의 일 실시예에 따른 시스템은 …' }, { title: 'abstract', body: `본 발명은 공구 마모 판정 시스템에 관한 것으로, ${'진동신호를 수집하고 마모 지수를 갱신한다. '.repeat(18)}` }] }
    case 'spec.c':
      return { headline: 'c', items: [{ title: 'detail', body: '이하, 첨부된 도면을 참조하여 진동 수집부(110)를 설명한다.' }] }
    case 'spec.d':
      return { headline: 'd', items: [{ title: 'detail2', body: '도 2 를 참조하면, 단계 S110 에서 …' }] }
    case 'spec.e':
      return { headline: 'e', items: [{ title: 'claims', body: '청구항 1. 공구의 진동신호를 수집하는 진동 수집부; 작업 일정과 함께 교체 시점을 산출하는 교체시점 산출부;를 포함하는 공구 마모 예측 시스템.\n\n청구항 2. 청구항 1에 있어서, 마모 단계를 세 단계로 나누는 것을 특징으로 하는 공구 마모 예측 시스템.\n\n청구항 3. 진동신호를 수집하는 단계; 교체 시점을 산출하는 단계;를 포함하는 공구 마모 예측 방법.' }] }
    case 'spec.fix':
      return { headline: '요약을 다듬었습니다', items: [{ title: 'abstract', body: '본 발명은 공구 진동정보 기반 마모 판정 시스템에 관한 것으로, 마모 지수를 누적 갱신하여 교체 시점을 산출한다.', detail: '요약 첫 문장' }] }
    default:
      return { headline: '', items: [] }
  }
}

/* D-263 자체점검 — ① 구성: 1번째 88점(권리축 마지막 줄 고침) → 고친 글로 다시 판정 93점 · ② 전체: 94점 · 청구항 고침 · 대표 확인 하나 */
let judgeParts = 0
const judgeAnswer = (purpose) => {
  if (/구성/.test(purpose)) {
    judgeParts += 1
    if (judgeParts % 2 === 1)
      return { headline: '점수 88/100 · P0 0개 · 고친 칸 1개', items: [{ title: 'score', amount: '88', detail: 'A9 B8 C8 D9 E9 F9 G9 H9 I9 J9' }, { title: 'verdict', tag: '감점', detail: '권리축 마지막 줄이 작업 일정 연결을 말하지 않아 회피가 쉽다', body: '연결관계를 권리축 마지막 줄에 넣었습니다' }, { title: 'axis.link', body: '마모 지수와 작업 일정을 함께 써서 교체 시점을 산출한다' }] }
    return { headline: '점수 93/100 · P0 0개 · 고친 칸 0개', items: [{ title: 'score', amount: '93', detail: 'A9 B9 C9 D9 E9 F9 G10 H9 I10 J10' }] }
  }
  return { headline: '점수 94/100 · P0 0개 · 고친 칸 1개', items: [{ title: 'score', amount: '94' }, { title: 'verdict', tag: '대표 확인', detail: '교체 시점 오차 실측값이 없다', body: '현장 시험 오차(%)를 알려 주세요' }, { title: 'claims', body: '청구항 1. 공구의 진동신호를 수집하는 진동 수집부; 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는 교체시점 산출부;를 포함하는 공구 마모 예측 시스템.\n\n청구항 2. 청구항 1에 있어서, 마모 단계를 세 단계로 나누는 것을 특징으로 하는 공구 마모 예측 시스템.\n\n청구항 3. 진동신호를 수집하는 단계; 교체 시점을 산출하는 단계;를 포함하는 공구 마모 예측 방법.' }] }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const sent = []
let partsMode = 'normal'
let partsCalls = 0
const MESSY_PARTS =
  '아래는 결과입니다.\n```json\n{"items":[' +
  [
    { title: 'axis.input', body: '공구의 진동신호를 받는다' },
    { title: '공구 마모 판정 시스템', tag: 'system' },
    { title: '진동 수집부', tag: 'comp', body: '공구의 진동신호를 모은다' },
    { title: '특징 추출부', tag: 'Comp', body: '진동신호에서 특징값을 뽑는다' },
    { title: '마모 지수 갱신부', tag: 'component', body: '마모 지수를 누적 갱신한다' },
    { title: '교체시점 산출부', tag: 'comp', body: '작업 일정과 함께 교체 시점을 산출한다' },
    { title: 'step 1', body: '진동신호를 수집하는 단계' },
    { title: 'step 2', body: '특징값을 뽑는 단계' },
  ]
    .map((x) => JSON.stringify(x))
    .join(',') +
  ',{"title":"step 3","body":"교체 시점을 산'
let delayMs = 30
/* D-268 실제로 본 문제 — 구성요소 이름이 문장 · 답이 길이 상한에서 잘림 · 자체점검 47점 · P0 · 명칭을 "한글{ENGLISH}" 한 줄로 */
let trial = false
let cutC = 0
const SENT = '판매 자료와 재고 자료를 채널마다 한 형식으로 모아 저장한다. '
const LONG_DETAIL = [`이하, 첨부된 도면을 참조하여 입력 자료 수집부(110)를 설명한다. ${SENT.repeat(30).trim()}`, SENT.repeat(50).trim(), `끝문단표식 — ${SENT.repeat(30).trim()}`].join('\n\n')
const SENTENCE_PARTS = [
  ...PARTS.filter((x) => x.title !== 'comp' && x.title !== 'seed'),
  { title: 'comp', detail: '입력 자료를 수집합니다.', body: '' },
  { title: 'comp', detail: '마모 판정부', body: '마모 단계를 판정하는' },
  { title: 'comp', detail: '그리고 결과를 잘 보여줍니다.', body: '' },
  { title: 'comp', detail: '교체시점 산출부', body: '작업 일정과 함께 교체 시점을 산출하는' },
  { title: 'seed', detail: '입력 자료를 수집합니다.', body: '채널마다 따로 모으는' },
]
const LOW_JUDGE = {
  headline: '점수 47/100 · P0 1개 · 고친 칸 3개',
  items: [
    { title: 'score', amount: '47', detail: 'A4 B4 C5 D5 E5 F5 G5 H5 I4 J5' },
    { title: 'verdict', tag: 'P0', detail: '청구항 1 에 차별 구조가 없다', body: '연결관계를 청구항 1 에 넣어야 합니다' },
    { title: 'title', body: '판매 재고 연계 운영상태 산출 시스템 및 방법{SYSTEM AND METHOD FOR CALCULATING OPERATION STATE}' },
    { title: 'abstract', body: '본 발명은 판매 자료와 재고 자료를 채널마다 모아 운영상태를 산출하는 시스템에 관한 것이다.' },
    { title: 'claims', body: '청구항 1. 잘린청구항표식' },
  ],
}
async function routeAi(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, providers: [{ id: 'gemini', label: 'Gemini', configured: true, keyName: 'GEMINI_API_KEY', models: [{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: '빠르게', tier: 'cheap', price: { in: 0.1, out: 0.4 } }, { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: '보통', tier: 'standard', price: { in: 0.3, out: 2.5 } }] }, { id: 'openai', label: 'OpenAI', configured: true, keyName: 'OPENAI_API_KEY', models: [{ id: 'gpt-5.4-mini', label: 'GPT 5.4 Mini', note: '보통', tier: 'standard', price: { in: 0.4, out: 1.6 } }] }], defaultChoice: { provider: 'gemini', model: 'gemini-3.1-flash-lite' } }) })
    const req = JSON.parse(route.request().postData() || '{}')
    sent.push(req)
    if (req.assistId === 'spec.a') bodyRound += 1
    await new Promise((r) => setTimeout(r, delayMs))
    // D-262 실제 모델처럼 어긋난 답 — 1번째는 JSON 없음, 2번째는 머리글 없음 · 이름표가 tag 에 · 끝 잘림(서버가 parse_fallback 으로 원문만 보냄)
    if (req.assistId === 'spec.parts' && partsMode === 'messy') {
      partsCalls += 1
      const raw = partsCalls === 1 ? '죄송합니다. 구성요소를 정리하면 진동 수집부, 마모 판정부 등이 있습니다.' : MESSY_PARTS
      const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'parse_fallback', structured: null, raw, usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString() }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
    }
    const research = req.assistId === 'spec.research'
    const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: req.choice?.provider || 'gemini', model: req.choice?.model || 'gemini-3.1-flash-lite', status: 'succeeded', structured: req.assistId === 'spec.judge' ? judgeAnswer(req.context?.purpose ?? '') : req.assistId === 'spec.talk' ? talkAnswer(req.context) : answer(req.assistId), raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString(), grounded: research, sources: research ? [{ title: 'KIPRIS 공구 마모', url: 'https://www.kipris.or.kr/example-1' }, { title: '논문 · 진동 기반 수명', url: 'https://example.org/paper' }] : [], finish: 'STOP' }
    if (trial) {
      const whole = req.assistId === 'spec.judge' && /전체/.test(req.context?.purpose ?? '')
      if (req.assistId === 'spec.parts') run.structured = { headline: '문장 이름', items: SENTENCE_PARTS }
      if (req.assistId === 'spec.c') {
        run.structured = { headline: 'c', items: [{ title: 'detail', body: LONG_DETAIL }] }
        // 1번째 본문 ① 은 길이 상한에서 잘림 → 더 짧게 다시
        cutC += 1
        if (cutC === 1) run.finish = 'MAX_TOKENS'
      }
      // 자체점검 ② 는 늘 잘림(다시 불러도) — 마지막 고친 칸(청구항)은 반쯤 쓴 글일 수 있어 넣지 않아야
      if (whole) {
        run.structured = LOW_JUDGE
        run.finish = 'length'
      }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
  })
}
const waitIdle = (page, timeout = 30000) => page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'no', null, { timeout })

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const dialogs = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.accept()
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)

  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  // 고른 모델(GPT)은 이 브라우저에 기억된 것 — 새 명세서도 그 모델로 쓴다
  await page.evaluate(() => localStorage.setItem('axmvp.ai.choice.v1', JSON.stringify({ provider: 'openai', model: 'gpt-5.4-mini' })))
  // D-263 대표가 붙여 넣은 /자체점검 정의 — 자체점검 · 쓰기 · 아이디어 단추마다 같이 가야 한다
  await page.evaluate(() => localStorage.setItem('axmvp.ai.judgeSkill.v1', '/자체점검 — 대표정의표식: 심사관처럼 공격하고 점수로 판정한다'))
  // 이 회사와 이어진 AI 전략실 자료 — 저절로 쓰기에도 재료로 들어가야 한다(회사 기록이 늦게 와도 자료를 읽은 뒤 시작)
  await page.evaluate((cid) => {
    const at = new Date().toISOString()
    localStorage.setItem('axmvp.v1.owner_ai.cases', JSON.stringify([{ id: 'case_spec_mat', workspaceId: null, ownerId: null, companyName: '(주)한솔테크', relation: 'client', clientId: cid, bizNo: '', homepageUrl: '', requester: '', industry: '', memo: '', materials: [{ id: 'm1', kind: 'memo', title: '현장 메모', text: '작업실재료표식 — 절삭 공구 교체를 작업자 감으로 함', chars: 30, hash: 'h1' }], facts: {}, activity: [], contextVersion: 0, origin: '', createdAt: at, updatedAt: at, archivedAt: null }]))
  }, CLIENT)
  await page.reload({ waitUntil: 'networkidle' })
  const listTyping = await page.locator('[data-testid="spec-new-ai"] textarea, [data-testid="spec-new-ai"] input[type="text"]').count()
  check('B0 새 명세서 칸 — 회사 고르기 · 모델 고르기(시작 전에) · 단추 하나 · 타자 칠 칸 0 · 견본은 작은 글자 단추로', (await page.getByTestId('spec-new-ai').isVisible()) && listTyping === 0 && (await page.getByTestId('spec-sample').isVisible()) && (await page.getByTestId('spec-new-model').getAttribute('data-model')) === 'gpt-5.4-mini', listTyping)
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  check('B0b 회사를 고르면 단추에 그 회사 이름 — "○○ 명세서 — 기획부터 시작"', /한솔테크.*기획부터 시작/.test(await page.getByTestId('spec-new').innerText()), await page.getByTestId('spec-new').innerText())
  await shot(page, 'B-start', false)
  const s0 = sent.length
  // 기획 대화 첫 질문 한 번만 부르므로 답을 천천히 — "쓰는 중" 을 볼 틈이 있게
  delayMs = 1500
  talkMode = 'ask'
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForURL(/draft=/)
  await page.getByTestId('spec-board').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  check('B7 쓰는 중 — "AI 가 쓰는 중" · "회사 서류 · 기록을 읽고 의견을 정리하는 중"', /쓰는 중/.test(await page.getByTestId('spec-board-head').innerText()) && (await page.getByTestId('spec-talk-wait').isVisible()))
  await waitIdle(page)
  delayMs = 30
  await page.waitForTimeout(300)
  const talk1 = sent.slice(s0)
  check('B1 단추 한 번 → 기획 대화 첫 질문까지만 저절로(아이디어는 대표가 답한 뒤) · 주소에서 auto 지움 · AI 작업판 먼저', talk1.map((r) => r.assistId).join() === 'spec.talk' && (await page.getByTestId('spec-board').getAttribute('data-phase')) === 'ideas' && (await page.getByTestId('spec-view-ai').getAttribute('aria-selected')) === 'true' && !page.url().includes('auto=1'), { ids: talk1.map((r) => r.assistId), url: page.url() })
  const opts = await page.getByTestId('spec-talk-option').allInnerTexts()
  check('B1a 첫 질문 — AI 가 이해한 회사 · 의견 2(흔한 것 · 약한 점) · 질문 하나 · 누를 답 4개(마지막 "AI 가 정해 주세요") · 직접 적기 · 머리 "AI 의 질문에 답해 주세요" · 질문 1/5', /금속가공 라인의 절삭 공구/.test(await page.getByTestId('spec-talk-understanding').innerText()) && /너무 흔하고/.test(await page.getByTestId('spec-talk-opinions').innerText()) && /어느 문제를 먼저/.test(await page.getByTestId('spec-talk-question').innerText()) && opts.length === 4 && opts[0] === '공구 교체 불량' && /AI 가 정해/.test(opts[3]) && (await page.getByTestId('spec-talk-own').isVisible()) && /AI 의 질문에 답해 주세요/.test(await page.getByTestId('spec-board-head').innerText()) && /질문 1\/5/.test(await page.getByTestId('spec-talk').innerText()), opts)
  const t1Ctx = JSON.stringify(talk1[0]?.context ?? '')
  check('B1d 기획 대화 자료 — 회사 기록 · 그 회사 AI 전략실 자료 · 대표 정의(skill) · 아직 대화 줄 없음', t1Ctx.includes('작업실재료표식') && /업종|종목|설립/.test(t1Ctx) && /대표정의표식/.test(talk1[0]?.skill ?? '') && !t1Ctx.includes('대표 답:'), t1Ctx.slice(0, 300))
  await shot(page, 'B-talk-1')
  const t1 = sent.length
  { const l289 = page.getByTestId('spec-talk-option').first(); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  await page.waitForTimeout(200)
  const talk2 = sent.slice(t1)
  check('B1e 답을 누르면 다음 질문 — 보낸 자료에 "질문 1 → 대표 답: 공구 교체 불량" · 답이 말풍선 · 질문 2/5', talk2.map((r) => r.assistId).join() === 'spec.talk' && JSON.stringify(talk2[0]?.context ?? '').includes('대표 답: 공구 교체 불량') && (await page.getByTestId('spec-talk-answer').count()) === 1 && (await page.getByTestId('spec-talk-round').count()) === 2 && /질문 2\/5/.test(await page.getByTestId('spec-talk').innerText()) && /무엇과 함께/.test(await page.getByTestId('spec-talk-question').last().innerText()), talk2.map((r) => r.assistId))
  const t2 = sent.length
  await page.getByTestId('spec-talk-own').fill('작업 일정 빈 시간에 교체하고 싶어요')
  await page.getByTestId('spec-talk-send').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="spec-plan-idea"]').length === 5, null, { timeout: 20000 }).catch(() => {})
  await waitIdle(page)
  await page.waitForTimeout(300)
  const talk3 = sent.slice(t2)
  const ideaReq = talk3.filter((r) => r.assistId === 'spec.idea')
  const i1Ctx = ideaReq[0]?.context ?? {}
  check('B1f 직접 적은 답도 보냄 → AI 가 "충분" → 기다리지 않고 그 대화대로 아이디어 5개(자료에 기획 대화 · 두 답 · "대표 답을 반드시 따른다")', talk3.map((r) => r.assistId).join() === 'spec.talk,spec.idea' && JSON.stringify(talk3[0]?.context ?? '').includes('대표 답: 작업 일정 빈 시간에 교체하고 싶어요') && (i1Ctx.sections ?? []).some((x) => x.name === '기획 대화' && JSON.stringify(x.rows).includes('대표 답: 공구 교체 불량') && JSON.stringify(x.rows).includes('대표 답: 작업 일정 빈 시간')) && (i1Ctx.rules ?? []).some((r) => /대표 답을 반드시 따른다/.test(r)), talk3.map((r) => r.assistId))
  check('B1g 아이디어가 나오면 기획 대화는 접어서 위에("기획 대화 2번 — 이 답대로 냈어요")', /기획 대화 2번/.test(await page.getByTestId('spec-talk').innerText()) && (await page.getByTestId('spec-talk-option').count()) === 0)
  const cards = await page.getByTestId('spec-plan-idea').evaluateAll((els) => els.map((e) => ({ rank: e.getAttribute('data-rank'), picked: e.getAttribute('data-picked'), text: e.textContent })))
  check('B1b 아이디어 5개 — 1순위(88점) · 순위 이유 · 회사 근거 · 1순위가 먼저 골라져 있음 · 명칭은 아직 비어 있음', cards.length === 5 && /1순위/.test(cards[0].text) && /88점/.test(cards[0].text) && /1순위인 이유/.test(cards[0].text) && /회사 근거/.test(cards[0].text) && cards[0].picked === 'yes' && /2순위/.test(cards[1].text) && /후보/.test(cards[3].text) && /아이디어를 골라 주세요/.test(await page.getByTestId('spec-board-head').innerText()), cards.map((c) => c.text?.slice(0, 40)))
  const steps = await page.getByTestId('spec-step').evaluateAll((els) => els.map((e) => `${e.textContent}:${e.getAttribute('data-now')}`))
  check('B1c 맨 위 차례 — 회사 정보 ✓ → 기획 · 아이디어(지금) → 구성 확인 → 본문 · 청구항 → 전문', steps.length === 5 && steps[1].includes('기획 · 아이디어:yes') && steps[0].includes('회사 정보:no'), steps)
  check('B2 칸 여섯은 [칸별로 보기] 안에 접혀 있음 · 모델 고르기 단추', (await page.getByTestId('spec-card').count()) === 0 && (await page.getByTestId('spec-cards-toggle').isVisible()) && (await page.getByTestId('model-pick').count()) === 1)
  const typing = await page.locator('[data-testid="spec-board"] textarea, [data-testid="spec-board"] input[type="text"]').count()
  check('B3 작업판에 타자 칠 칸 0', typing === 0, typing)
  check('B5 회사 기록이 재료로 보임', /기록 \d+줄/.test(await page.getByTestId('spec-board-sources').innerText()))
  await shot(page, 'B-ideas')

  // [이 중 제일 좋은 게 뭐야?] — 후보 2(작업지시)가 95점으로 1순위
  const s1 = sent.length
  { const l289 = page.getByTestId('spec-plan-rank'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  await page.waitForTimeout(200)
  const rankReq = sent.slice(s1)
  const rankCtx = JSON.stringify(rankReq[0]?.context ?? '')
  const afterRank = await page.getByTestId('spec-plan-idea').evaluateAll((els) => els.map((e) => ({ picked: e.getAttribute('data-picked'), text: e.textContent })))
  check('B3b [이 중 제일 좋은 게 뭐야?] → 후보 5개를 자체점검 기준으로 견줌(대표 정의 같이) → 작업지시 95점이 1순위로 · 그것이 골라짐 · 진행 줄에 이유', rankReq.map((r) => r.assistId).join() === 'spec.ideaRank' && /후보 5/.test(rankCtx) && /대표정의표식/.test(rankReq[0]?.skill ?? '') && /작업지시 데이터 기반/.test(afterRank[0].text) && /95점/.test(afterRank[0].text) && afterRank[0].picked === 'yes' && /납기 지연이 상담 메모/.test(afterRank[0].text) && /가장 나은 것/.test(await page.locator('[data-testid="spec-board-row"][data-stage="ideaRank"]').innerText()), afterRank.map((c) => c.text?.slice(0, 30)))

  // [자체점검으로 더 짜내기] — 새 아이디어 2개(새로 표시)
  const s2 = sent.length
  { const l289 = page.getByTestId('spec-plan-more'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  await page.waitForTimeout(200)
  const moreReq = sent.slice(s2)
  const afterMore = await page.getByTestId('spec-plan-idea').evaluateAll((els) => els.map((e) => ({ fresh: e.getAttribute('data-fresh'), text: e.textContent })))
  check('B4 [자체점검으로 더 짜내기] → 지금 후보를 보내고 · 새 아이디어 2개가 "새로 · 자체점검" 으로 · 점수 순(92점이 2순위) · 진행 줄에 지금 후보의 약점', moreReq.map((r) => r.assistId).join() === 'spec.ideaMore' && /지금 후보/.test(JSON.stringify(moreReq[0]?.context ?? '')) && afterMore.length === 7 && afterMore.filter((c) => c.fresh === 'yes').length === 2 && /공구 마모 지수와 작업 일정 연계/.test(afterMore[1].text) && /새로 · 자체점검/.test(afterMore[1].text) && /임계값 비교/.test(await page.locator('[data-testid="spec-board-row"][data-stage="ideaMore"]').innerText()), afterMore.map((c) => c.text?.slice(0, 30)))
  await shot(page, 'B-ideas-more')

  // D-269 쓰는 중에 모델을 바꾸면 다음 단계부터 그 모델 — 머리 줄의 모델 단추로 Gemini 3.8 Flash
  await page.getByTestId('model-pick').click()
  await page.getByTestId('model-pick-panel').waitFor()
  await page.locator('[data-testid="ai-assist-settings"] [data-provider="gemini"]').click()
  await page.locator('[data-testid="ai-assist-model-option"][data-model="gemini-3.8-flash"]').click()
  await page.waitForTimeout(200)
  await page.getByTestId('model-pick').click()
  check('B6 모델 고르기 → 바꾸면 단추 · 작업판 "지금 고른 모델" 에 그 모델 · 이 브라우저에 기억', (await page.getByTestId('model-pick').getAttribute('data-model')) === 'gemini-3.8-flash' && /Gemini 3\.8 Flash/.test(await page.getByTestId('spec-board-models').innerText()) && (await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('ai.choice') && localStorage.getItem(k).includes('gemini-3.8-flash')))))

  // 1순위가 아닌 것을 골라 시작 — 공구 진동정보(지금 3순위)
  const tool = page.getByTestId('spec-plan-idea').filter({ hasText: '공구 진동정보 기반 마모 단계 판정' })
  await tool.getByTestId('spec-plan-pick').click()
  check('B4b 다른 후보를 누르면 그것이 골라짐(하나만)', (await tool.getAttribute('data-picked')) === 'yes' && (await page.locator('[data-testid="spec-plan-idea"][data-picked="yes"]').count()) === 1)
  const s3 = sent.length
  { const l289 = page.getByTestId('spec-plan-start'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  await page.waitForTimeout(300)
  const partsReq = sent.slice(s3)
  check('B8a [이걸로 시작하자] → 조사 → 구성 → 자체점검 ①(88점 · 고친 뒤 93점) 까지만 · 본문은 아직 안 씀 · "구성을 확인해 주세요"', partsReq.map((r) => r.assistId).join() === 'spec.research,spec.parts,spec.judge,spec.judge' && (await page.getByTestId('spec-board').getAttribute('data-phase')) === 'review' && /구성을 확인해 주세요/.test(await page.getByTestId('spec-board-head').innerText()) && (await page.getByTestId('spec-plan-body').isVisible()), partsReq.map((r) => r.assistId))
  check('B9 바꾼 모델로 부름 — 기획 대화 · 아이디어 · 견주기 · 짜내기는 GPT, 바꾼 뒤 조사 · 구성 · 자체점검은 Gemini 3.8 Flash', sent.slice(s0, s3).every((r) => r.choice?.model === 'gpt-5.4-mini') && partsReq.every((r) => r.choice?.provider === 'gemini' && r.choice?.model === 'gemini-3.8-flash'), [...sent.slice(s0, s3), ...partsReq].map((r) => r.choice?.model))
  const reviewText = await page.getByTestId('spec-review').innerText()
  check('B16 구성 확인 — 조사 결론 · 구성요소 5개(110~150) · 단계 · 연결관계', /진동 수집부\(110\)/.test(reviewText) && /교체시점 산출부\(150\)/.test(reviewText) && /방법 단계 5개 · 종속항 씨앗 2개/.test(reviewText) && /선행기술 조사/.test(reviewText) && /연결관계/.test(reviewText), reviewText.slice(0, 200))
  const rowModels = await page.getByTestId('spec-board-row').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-stage'), e.getAttribute('data-model')])))
  check('B9b 진행 줄마다 쓴 모델 · 이 명세서를 쓴 모델 두 가지 다 보임', rowModels.idea === 'gpt-5.4-mini' && rowModels.parts === 'gemini-3.8-flash' && /GPT 5\.4 Mini/.test(await page.getByTestId('spec-board-rows').innerText()) && /gpt-5\.4-mini/.test((await page.getByTestId('spec-board-models').getAttribute('data-models')) ?? '') && /gemini-3\.8-flash/.test((await page.getByTestId('spec-board-models').getAttribute('data-models')) ?? ''), rowModels)
  await shot(page, 'B-review')

  const s4 = sent.length
  { const l289 = page.getByTestId('spec-plan-body'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  await page.waitForTimeout(500)
  check('B8 [이 구성으로 본문 · 청구항 쓰기] → 본문 a~d → 청구항 → 자체점검 ② → 점검대로 고치기', sent.slice(s4).map((r) => r.assistId).join() === 'spec.a,spec.b,spec.c,spec.d,spec.e,spec.judge,spec.fix', sent.slice(s4).map((r) => r.assistId))
  await page.getByTestId('spec-cards-toggle').click()
  const judges = sent.filter((r) => r.assistId === 'spec.judge')
  check('B8b 자체점검 범위 — ① 구성 · ② 전체 · 대표 정의(skill)가 자체점검 · 쓰기 · 아이디어 단추에 같이 감 · 조사에는 안 감', /구성/.test(judges[0]?.context?.purpose) && /전체/.test(judges[2]?.context?.purpose) && judges.every((r) => /대표정의표식/.test(r.skill ?? '')) && /대표정의표식/.test(sent.find((r) => r.assistId === 'spec.a')?.skill ?? '') && /대표정의표식/.test(sent.find((r) => r.assistId === 'spec.idea')?.skill ?? '') && !sent.find((r) => r.assistId === 'spec.research')?.skill, judges.map((r) => r.context?.purpose))
  const j2Ctx = judges[2]?.context ?? {}
  const j2Names = (j2Ctx.sections ?? []).map((s) => s.name)
  const j2Body = (j2Ctx.sections ?? []).find((s) => s.name === '명세서 지금 글')?.rows ?? []
  check('B8c 자체점검 ② 자료 — 명칭은 "한글{ENGLISH}" 한 줄(따로 줄 없음) · 청구항이 본문보다 앞 · "줄인 곳은 끝남 아님" 규칙', j2Body.some((r) => r.part === 'title{titleEn}' && /\{SYSTEM AND METHOD/.test(r.memo)) && !j2Body.some((r) => r.part === 'titleEn') && j2Names.indexOf('청구항') < j2Names.indexOf('명세서 지금 글') && (j2Ctx.rules ?? []).some((r) => /중간에 끝남/.test(r)), { j2Names, rows: j2Body.slice(0, 2) })
  const phases = await page.getByTestId('spec-board-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-phase')))
  check('B10 단계 줄 모두 다 씀', phases.every((p) => p === 'done'), phases)
  const ideaCtx = JSON.stringify(ideaReq[0].context)
  check('B11 아이디어 자료 = 회사 기록(업종 등) · 이름 · 연락처 없음', /업종|종목|설립/.test(ideaCtx) && !/010-\d{4}-\d{4}/.test(ideaCtx), ideaCtx.slice(0, 300))
  check('B11b 저절로 쓰기도 그 회사 AI 전략실 자료를 읽은 뒤 시작 — 첫 부름부터 자료가 들어감', ideaCtx.includes('작업실재료표식'), ideaCtx.slice(0, 400))
  check('B12 고른 아이디어(공구 진동정보)가 명칭 · 영문으로 들어감', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반 마모 단계 판정') && (await page.getByTestId('spec-board-title').innerText()).includes('{SYSTEM AND METHOD FOR JUDGING'))
  const ideas = await page.getByTestId('spec-idea').evaluateAll((els) => els.map((e) => e.getAttribute('data-current')))
  check('B13 칸별로 보기 — 지금 쓰는 것은 위에 하나 · 다른 후보 6개만 아래(겹치지 않음)', ideas.length === 6 && ideas.every((x) => x === 'no'), ideas)
  check('B14 조사: 검색 근거 2곳 · 출처 링크 · KIPRIS 검색어', (await page.getByTestId('spec-research-grounded').getAttribute('data-grounded')) === 'yes' && (await page.locator('[data-testid="spec-research-sources"] a').count()) === 2 && /B23Q 17\/09/.test(await page.getByTestId('spec-research-words').innerText()))
  const eCtx = JSON.stringify(sent.find((r) => r.assistId === 'spec.e').context)
  check('B15 청구항 묶음에 조사의 차별화가 감', eCtx.includes('조사에서 나온 차별화') && eCtx.includes('작업 일정과 마모 지수를 함께'))
  const body = await page.locator('[data-testid="spec-board-body"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-has')))
  check('B17 본문 7칸 모두 씀', body.length === 7 && body.every((x) => x === 'yes'), body)
  check('B18 청구항 3개', /청구항 3개/.test(await page.getByTestId('spec-board-claims').innerText()))
  check('B19 점검대로 고치기 — 걸린 것(요약 400자 넘음)을 보냄', JSON.stringify(sent.find((r) => r.assistId === 'spec.fix')?.context ?? '').includes('요약이'))
  check('B20 AI 가 확인해 달라는 점 따로(본문 · 자체점검 대표 확인)', /종래 기술 출처 확인/.test(await page.getByTestId('spec-board-asks').innerText()) && /현장 시험 오차/.test(await page.getByTestId('spec-board-asks').innerText()))
  check('B20b 자체점검 판정이 맨 위에 — ② 94점 · 통과 · 직접 고친 칸 청구항 · 대표 기준 표시', (await page.getByTestId('spec-judge').getAttribute('data-score')) === '94' && (await page.getByTestId('spec-judge').getAttribute('data-pass')) === 'yes' && /청구항/.test(await page.getByTestId('spec-judge').innerText()) && /대표 기준/.test(await page.getByTestId('spec-judge').innerText()))
  const store = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /spec|patent/i.test(k)).map(([, v]) => v).join('\n'))
  check('B20c 자체점검이 고친 글이 초안에 들어감 — 권리축 마지막 줄 · 청구항 1(마모 지수와 작업 일정 연결)', store.includes('마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는') && store.includes('교체 시점을 산출하는 교체시점 산출부'), store.length)
  const BANNED = new RegExp(['악마', '판사', '이상한\\s*(?:마케팅\\s*)?AI', 'Master v', 'Judge Scorecard'].join('|'), 'i')
  check('B20e 화면 어디에도 쓰지 않는 이름 · 출처 이름 없음 — 카드 이름 "자체점검"', !BANNED.test(await page.locator('body').innerText()) && /자체점검/.test(await page.getByTestId('spec-board').innerText()))
  const judgeRows = await page.locator('[data-testid="spec-board-row"][data-stage^="judge"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-stage')}:${e.getAttribute('data-phase')}:${e.textContent}`))
  check('B20d 진행 줄에 자체점검 ① · ② — 점수 · 고친 칸 · "고친 뒤 다시 판정"', judgeRows.length === 2 && /judge1:done:.*93점.*권리축.*고친 뒤 다시 판정/.test(judgeRows[0]) && /judge2:done:.*94점.*청구항/.test(judgeRows[1]), judgeRows)
  const doneCards = await page.getByTestId('spec-card').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-card')}:${e.getAttribute('data-done')}`))
  check('B21 칸 다섯 이상 다 됨 표시', doneCards.filter((x) => x.endsWith(':yes')).length >= 5, doneCards)
  await page.getByTestId('spec-cards-toggle').click()
  check('B21b 다 쓰면 맨 위에 "다 썼어요" · 명칭 · 청구항 수 · [전문 내려받기] · [제출 준비 묶음] · 차례 "전문 · 복사"', /다 썼어요/.test(await page.getByTestId('spec-board-head').innerText()) && (await page.getByTestId('spec-board-done-download').isVisible()) && (await page.getByTestId('spec-board-done-pack').isVisible()) && /청구항 3개/.test(await page.getByTestId('spec-board').innerText()) && (await page.getByTestId('spec-steps').getAttribute('data-phase')) === 'done')
  const summary = await page.getByTestId('spec-board-summary').innerText()
  check('B21d 맨 위 줄 — 형식 점검과 자체점검을 따로("형식 점검 통과 · 자체점검 94점") · 통과면 "손볼 곳" 없음', /형식 점검 (통과|고칠 것 \d+개)/.test(summary) && /자체점검 94점/.test(summary) && (await page.getByTestId('spec-board-head').getAttribute('data-needs-work')) === 'no', summary)
  check('B21e 회사 기록 · 작업실 자료가 있으면 "읽을 것이 거의 없어요" 안내 · 회사 정보 문 없음', (await page.getByTestId('spec-board-thin').count()) === 0 && (await page.getByTestId('spec-gate-company').count()) === 0)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.getByTestId('spec-board-done-download').click()])
  check('B21c 맨 위 [전문 내려받기] 한 번에 .txt', !!dl && /^patent-spec-\d{8}-full\.txt$/.test(dl.suggestedFilename()), dl?.suggestedFilename())

  // D-269 전문 보기(기본) · 나눠서 보기(칸마다 복사)
  const full = page.getByTestId('spec-full')
  const fullText = await page.getByTestId('spec-full-text').innerText()
  check('F1 다 쓰면 전문이 기본으로 — 【발명의 설명】 → 【발명의 명칭】 → 한글{영문} 한 줄 · 【해결하고자 하는 과제】 · 【청구항 1】 · 굵게(**) · 가로선 · # 없음', (await full.getAttribute('data-view')) === 'full' && fullText.startsWith('【발명의 설명】\n【발명의 명칭】\n공구 진동정보 기반 마모 단계 판정 및 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR JUDGING') && fullText.includes('【해결하고자 하는 과제】') && fullText.includes('【청구항 1】') && fullText.includes('【요약서】') && !fullText.includes('**') && !/^-{3,}$/m.test(fullText) && !/^#/m.test(fullText), fullText.slice(0, 160))
  check('F1b 청구항은 구성(;)마다 줄 · "를 포함하는 …" 끝 줄 · 부호의 설명은 "110 : 진동 수집부"', /【청구항 1】\n공구의 진동신호를 수집하는 진동 수집부;\n마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는 교체시점 산출부;\n를 포함하는 공구 마모 예측 시스템\./.test(fullText) && /\n110 : 진동 수집부\n/.test(fullText), fullText.slice(fullText.indexOf('【청구항 1】'), fullText.indexOf('【청구항 1】') + 160))
  await page.getByTestId('spec-full-copy').click()
  await page.waitForTimeout(200)
  const clip1 = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('F2 [전문 복사] → 클립보드에 전문 그대로', clip1.startsWith('【발명의 설명】') && clip1.includes('【청구항 3】'), clip1.slice(0, 40))
  await full.scrollIntoViewIfNeeded()
  await shot(page, 'F-full', false)
  await page.getByTestId('spec-full-view-split').click()
  const items = await page.getByTestId('spec-split-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('F3 나눠서 보기 — 명칭 · 기술분야 … 부호 · 청구항마다 · 요약 · 대표도 칸', (await full.getAttribute('data-view')) === 'split' && items[0] === 'title' && ['field', 'background', 'problem', 'solution', 'effect', 'figures', 'detail', 'signs', 'claim1', 'claim2', 'claim3', 'abstract', 'rep'].every((k) => items.includes(k)), items)
  await page.locator('[data-testid="spec-split-copy"][data-key="claim1"]').click()
  await page.waitForTimeout(200)
  const clip2 = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('F4 청구항 1 [복사] → 그 칸 글만("청구항 1" 머리 없이 · 구성마다 줄)', clip2 === '공구의 진동신호를 수집하는 진동 수집부;\n마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는 교체시점 산출부;\n를 포함하는 공구 마모 예측 시스템.', clip2)
  await page.locator('[data-testid="spec-split-copy"][data-key="title"]').click()
  await page.waitForTimeout(200)
  const clip3 = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('F5 발명의 명칭 [복사] → 한글{영문} 한 줄(줄바꿈 없음)', /^공구 진동정보 기반 마모 단계 판정 및 교체시점 산출 시스템 및 방법\{SYSTEM AND METHOD FOR JUDGING[^\n]*\}$/.test(clip3), clip3)
  await full.scrollIntoViewIfNeeded()
  await shot(page, 'F-split', false)
  await page.getByTestId('spec-full-view-full').click()
  await page.getByTestId('spec-cards-toggle').click()

  // 직접 고치기 = 예전 단계 화면에 AI 글이 그대로
  await page.locator('[data-testid="spec-card-edit"][data-card="body"]').click()
  await page.getByTestId('spec-tabs').waitFor()
  check('B22 [직접 고치기] → 예전 단계 화면(본문) · AI 글이 칸에', (await page.getByTestId('spec-tab-body').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').inputValue()).startsWith('본 발명은 공구 마모 판정'))
  await page.getByTestId('spec-view-ai').click()
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-cards-toggle').click()

  // 다른 아이디어로 바꾸기 → 한 번 더 묻고 · 구성 이후 비움 · 되돌리기
  dialogs.length = 0
  const other = (await page.getByTestId('spec-idea').first().innerText()).split('\n').find((l) => /시스템 및 방법/.test(l)) ?? ''
  await page.getByTestId('spec-idea-use').first().click()
  await page.waitForTimeout(400)
  check('B23 다른 아이디어 → 한 번 더 묻기 · 명칭 바뀜 · 구성 비움', dialogs.length === 1 && !!other && (await page.getByTestId('spec-board-title').innerText()).includes(other.replace(/^(추천|\d순위)\s*/, '').trim()) && (await page.getByTestId('spec-board-parts').count()) === 0, { dialogs, other })
  await page.getByRole('button', { name: '되돌리기' }).first().click()
  await page.waitForTimeout(400)
  check('B24 되돌리기 → 앞 아이디어 · 구성 · 본문 그대로', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반') && (await page.getByTestId('spec-board-parts').count()) === 1)

  // 쓰는 중에 나갔다 오기 — 본문만 다시(천천히)
  delayMs = 700
  const before = sent.length
  { const l289 = page.locator('[data-testid="spec-card-run"][data-card="body"]'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForTimeout(300)
  const url = page.url()
  await page.getByTestId('spec-back-list').click()
  await page.getByTestId('spec-list').waitFor()
  await page.waitForTimeout(3600)
  // 화면 안에서 다시 열기(목록 → 같은 명세서) — 나가 있는 동안 쓴 글이 붙는다
  const draftId = new URL(url).searchParams.get('draft')
  await page.locator(`[data-testid="spec-row-open"][href*="${draftId}"]`).click()
  await page.getByTestId('spec-board').waitFor()
  await page.waitForTimeout(600)
  delayMs = 30
  check('B25 쓰는 중에 목록으로 나갔다 와도 네 번(a~d)만 부름 · 다시 안 부름', sent.slice(before).map((r) => r.assistId).join() === 'spec.a,spec.b,spec.c,spec.d', sent.slice(before).map((r) => r.assistId))

  // ?step= 으로 열면 단계 화면
  const draft = new URL(url).searchParams.get('draft')
  await page.goto(`${BASE}/patent-venture/write?draft=${draft}&client=${CLIENT}&step=claims`, { waitUntil: 'networkidle' })
  await page.getByTestId('spec-editor').waitFor()
  await page.getByTestId('spec-board').waitFor()
  const boardFirst = (await page.getByTestId('spec-tabs').count()) === 0
  await page.getByTestId('spec-view-edit').click()
  check('B26 ?step= (진행판 [이어서 하기]) 로 열어도 대표는 AI 작업판 먼저(타자 칸 없음) · [직접 고치기] 를 누르면 그 단계(청구항)', boardFirst && (await page.getByTestId('spec-tab-claims').getAttribute('aria-selected')) === 'true')
  await page.getByTestId('spec-tab-body').click()
  const field2 = await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').inputValue()
  check('B27 새로 열어도 나가 있는 동안 쓴 AI 글이 저장돼 있음(본문 2차)', field2.includes('(2차)'), field2.slice(0, 80))
  await page.getByTestId('spec-view-ai').click()
  await page.getByTestId('spec-board').waitFor()
  check('B27b 다시 열어도 이 명세서를 쓴 모델이 남아 있음', /gpt-5\.4-mini/.test((await page.getByTestId('spec-board-models').getAttribute('data-models')) ?? '') && /gemini-3\.8-flash/.test((await page.getByTestId('spec-board-models').getAttribute('data-models')) ?? ''), await page.getByTestId('spec-board-models').getAttribute('data-models'))
  await page.getByTestId('spec-cards-toggle').click()

  // 자료 넣기 — 글 파일 → 읽은 글만 · 개인정보 가림 (한글 파일 이름은 버퍼로 — 이 시험 기계는 LANG 이 비어 경로가 깨짐)
  await page.getByTestId('spec-board-file-input').setInputFiles({ name: '현장메모.txt', mimeType: 'text/plain', buffer: Buffer.from('공구 교체를 감으로 합니다. 담당자 연락처 010-1234-5678. 불량이 한 달에 20건 나옵니다.') })
  await page.waitForTimeout(800)
  check('B28 자료 넣기 → 올린 자료 1개', /올린 자료 1개/.test(await page.getByTestId('spec-board-mats').innerText()))
  const before2 = sent.length
  { const l289 = page.locator('[data-testid="spec-card-run"][data-card="idea"]'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page)
  const ideaCtx2 = JSON.stringify(sent[before2].context)
  check('B29 다음 아이디어 내줘에 올린 자료가 감 · 휴대폰 번호는 가림', ideaCtx2.includes('공구 교체를 감으로') && !ideaCtx2.includes('010-1234-5678'), ideaCtx2.slice(0, 200))
  check('B30 이미 명칭이 있으면 후보만 바뀌고 명칭은 그대로', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반'))
  check('B31 JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- D-271 [자료 넣기] 창(업체 서류함 · 글 붙여넣기 · 빼기) · 휴지통(새로 쓰기 · 되살리기 · 두 번 확인 영구 삭제) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => void d.accept())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  delayMs = 30
  talkMode = 'ask'
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  const rows0 = await page.getByTestId('spec-row').count()
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-talk-option').first().waitFor({ timeout: 15000 }).catch(() => {})
  await waitIdle(page)
  check('D1 업체 서류함에 올린 파일(법인인감증명서)을 저절로 읽으려 함 — 이 시험 기기(로컬 저장)에서는 파일을 못 받아 "0/1개 읽음" · 그래도 회사 기록으로 기획 대화는 시작', /업체 서류 0\/1개 읽음/.test(await page.getByTestId('spec-board-docs').innerText()) && (await page.getByTestId('spec-talk-question').count()) === 1, await page.getByTestId('spec-board-docs').innerText())
  await page.getByTestId('spec-board-mats-open').click()
  await page.getByTestId('spec-mats-sheet').waitFor()
  check('D2 [자료 넣기 · 보기] 창 — ① 업체 서류함(그 파일 · 읽지 못한 이유) ② 파일 올리기 ③ 글 붙여넣기 · 넣은 자료 0', (await page.getByTestId('spec-mats-doc').count()) === 1 && /법인인감증명서/.test(await page.getByTestId('spec-mats-docs').innerText()) && /읽지 못한 서류/.test(await page.getByTestId('spec-mats-doc-fails').innerText()) && (await page.getByTestId('spec-mats-file').isVisible()) && (await page.getByTestId('spec-mats-paste-text').isVisible()) && (await page.getByTestId('spec-mats-item').count()) === 0)
  const chat = `나: 우리 회사 특허 뭐가 좋을까?\nGPT: ${'공구 교체 데이터를 생각해 보세요. '.repeat(260)}\n나: 담당 010-9876-5432 로 연락\nGPT: 결론 — 붙여넣기결론표식: 마모 지수와 작업 일정을 묶는 방향`
  await page.getByTestId('spec-mats-paste-title').fill('GPT 와 나눈 대화')
  await page.getByTestId('spec-mats-paste-text').fill(chat)
  await shot(page, 'D-mats', false)
  await page.getByTestId('spec-mats-paste-add').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="spec-mats-item"]').length === 1, null, { timeout: 5000 }).catch(() => {})
  const item = page.getByTestId('spec-mats-item').first()
  const store1 = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /spec|patent/i.test(k)).map(([, v]) => v).join('\n'))
  check('D3 GPT 대화 붙여넣기 → 넣은 자료 1개("붙여 넣은 글" · 이름) · 칸은 비워짐 · 전화번호는 가려서 저장', (await item.getAttribute('data-kind')) === '붙여 넣은 글' && /GPT 와 나눈 대화/.test(await item.innerText()) && (await page.getByTestId('spec-mats-paste-text').inputValue()) === '' && store1.includes('붙여넣기결론표식') && !store1.includes('010-9876-5432'))
  await page.keyboard.press('Escape')
  await page.getByTestId('spec-mats-sheet').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  const b4 = sent.length
  await page.getByTestId('spec-talk-again').click()
  await page.waitForTimeout(300)
  await waitIdle(page)
  await page.waitForTimeout(200)
  const again = sent.slice(b4)
  const againCtx = JSON.stringify(again[0]?.context ?? '')
  check('D4 [기획 대화 처음부터] → 대화를 비우고 새 첫 질문 · 붙여 넣은 대화가 재료로(긴 대화도 끝 결론까지) · 전화번호 없음', again.map((r) => r.assistId).join() === 'spec.talk' && againCtx.includes('붙여 넣은 글') && againCtx.includes('붙여넣기결론표식') && !againCtx.includes('010-9876-5432') && !againCtx.includes('대표 답:') && (await page.getByTestId('spec-talk-round').count()) === 1, again.map((r) => r.assistId))
  await page.getByTestId('spec-board-mats-open').click()
  await page.getByTestId('spec-mats-remove').first().click()
  await page.waitForTimeout(300)
  check('D5 넣은 자료 빼기 → 0개', (await page.getByTestId('spec-mats-item').count()) === 0 && /올린 자료 0개/.test(await page.getByTestId('spec-board-mats').innerText()))
  await page.keyboard.press('Escape')
  await page.getByTestId('spec-mats-sheet').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

  // [새로 쓰기] — 지금 글은 휴지통 · 같은 회사로 새 명세서(기획 대화부터)
  const id1 = new URL(page.url()).searchParams.get('draft')
  await page.getByTestId('spec-restart').click()
  await page.getByTestId('spec-restart-yes').click()
  await page.waitForFunction((id) => !location.search.includes(id), id1, { timeout: 10000 }).catch(() => {})
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-talk-option').first().waitFor({ timeout: 15000 }).catch(() => {})
  await waitIdle(page)
  const u2 = new URL(page.url())
  check('D6 [새로 쓰기] → 다른 명세서(같은 회사) · 다시 기획 대화 첫 질문부터', !!u2.searchParams.get('draft') && u2.searchParams.get('draft') !== id1 && u2.searchParams.get('client') === CLIENT && (await page.getByTestId('spec-talk-round').count()) === 1, page.url())
  await page.getByTestId('spec-back-list').click()
  await page.getByTestId('spec-list').waitFor()
  await page.waitForTimeout(300)
  check('D7 목록 — 새 명세서만(지운 것은 빠짐) · 아래 휴지통 1개', (await page.getByTestId('spec-row').count()) === rows0 + 1 && (await page.getByTestId('spec-trash-row').count()) === 1 && /휴지통/.test(await page.getByTestId('spec-trash').innerText()), { rows: await page.getByTestId('spec-row').count(), rows0 })
  await page.locator('[data-testid="spec-trash"] summary').click()
  await shot(page, 'D-trash', false)
  await page.getByTestId('spec-trash-restore').first().click()
  await page.waitForTimeout(400)
  check('D8 휴지통 [되살리기] → 목록으로 돌아옴 · 휴지통 0', (await page.getByTestId('spec-row').count()) === rows0 + 2 && (await page.getByTestId('spec-trash-row').count()) === 0)
  // 목록에서 휴지통으로 → 영구 삭제는 두 번 확인
  await page.getByTestId('spec-row-remove').first().click()
  await page.getByTestId('spec-row-remove-yes').click()
  await page.waitForTimeout(400)
  check('D9 목록 [휴지통으로] → 목록에서 빠지고 휴지통 1', (await page.getByTestId('spec-row').count()) === rows0 + 1 && (await page.getByTestId('spec-trash-row').count()) === 1)
  if (!(await page.locator('[data-testid="spec-trash"]').evaluate((el) => el.open))) await page.locator('[data-testid="spec-trash"] summary').click()
  await page.getByTestId('spec-trash-purge').first().click()
  const ask1 = await page.getByTestId('spec-trash-purge-ask').getAttribute('data-step')
  await page.getByTestId('spec-trash-purge-next').click()
  const ask2 = await page.getByTestId('spec-trash-purge-ask').getAttribute('data-step')
  const still = await page.getByTestId('spec-trash-row').count()
  await shot(page, 'D-purge', false)
  await page.getByTestId('spec-trash-purge-yes').click()
  await page.waitForTimeout(400)
  check('D10 영구 삭제 — 두 번 확인("되살릴 수 없어요" → "마지막 확인") 전에는 남아 있고 · 두 번째에 지움 · 이름을 다시 치게 하지 않음', ask1 === '1' && ask2 === '2' && still === 1 && (await page.getByTestId('spec-trash-row').count()) === 0 && (await page.getByTestId('spec-row').count()) === rows0 + 1 && (await page.locator('[data-testid="spec-trash"] input').count()) === 0, { ask1, ask2, still })
  // 편집기 [휴지통으로] → 목록 · 되돌리기
  await page.getByTestId('spec-row-open').first().click()
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-trash-this').click()
  await page.getByTestId('spec-trash-this-yes').click()
  await page.getByTestId('spec-list').waitFor()
  await page.waitForTimeout(300)
  check('D11 편집기 [휴지통으로] → 목록으로 · 그 명세서는 휴지통에', (await page.getByTestId('spec-row').count()) === rows0 && (await page.getByTestId('spec-trash-row').count()) === 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  if (!(await page.locator('[data-testid="spec-trash"]').evaluate((el) => el.open))) await page.locator('[data-testid="spec-trash"] summary').click()
  await page.getByTestId('spec-trash-purge').first().click()
  await page.getByTestId('spec-trash-purge-next').click()
  check('D12 휴지통 390 — 두 번째 확인까지 넘침 0', (await overflowX(page)) <= 0, await overflowX(page))
  for (const b of await page.getByRole('button', { name: '알림 닫기' }).all()) await b.click().catch(() => {})
  await page.getByTestId('spec-trash-purge-ask').scrollIntoViewIfNeeded()
  await shot(page, 'D-390-purge', false)
  check('D13 JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 대화창 [새 명세서] — 명세서 화면을 새로 여는 길(회사 기록이 늦게 옴) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate((cid) => {
    const at = new Date().toISOString()
    localStorage.setItem('axmvp.v1.owner_ai.cases', JSON.stringify([{ id: 'case_chat_mat', workspaceId: null, ownerId: null, companyName: '(주)한솔테크', relation: 'client', clientId: cid, bizNo: '', homepageUrl: '', requester: '', industry: '', memo: '', materials: [{ id: 'm1', kind: 'memo', title: '현장 메모', text: '대화창재료표식 — 설비 진동 기록이 쌓여 있음', chars: 24, hash: 'h2' }], facts: {}, activity: [], contextVersion: 0, origin: '', createdAt: at, updatedAt: at, archivedAt: null }]))
  }, CLIENT)
  await routeAi(page)
  await page.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('pv-chat-page').waitFor()
  await page.getByTestId('chat-hero').getByTestId('chat-starter').first().click()
  const act = page.locator('[data-testid="chat-action"][data-id="new-spec"]').last()
  await act.waitFor()
  const before = sent.length
  await act.click(); await page.waitForTimeout(450); await act.click() // D-289 AI 단추 두 번
  await page.getByTestId('spec-board').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  const first = sent[before]
  const firstCtx = JSON.stringify(first?.context ?? '')
  check('C1 대화창 [새 명세서] → 명세서 화면이 새로 열려도 단추 한 번으로 바로 기획 대화 시작(주소 auto 지움)', !page.url().includes('auto=1') && first?.assistId === 'spec.talk' && sent.length > before, { url: page.url(), id: first?.assistId })
  check('C2 회사 기록 · 그 회사 AI 전략실 자료를 다 읽은 뒤 시작 — 첫 부름부터 회사 기록 + 작업실 자료', firstCtx.includes('대화창재료표식') && /업종|종목|설립/.test(firstCtx), firstCtx.slice(0, 400))
  await waitIdle(page)
  check('C3 JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- D-262 구성요소 단계 — 모델 답 모양이 어긋나도 멈추지 않음 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  delayMs = 30
  partsMode = 'messy'
  partsCalls = 0
  // 첫 기획 대화에서 바로 '충분' → 기다리지 않고 아이디어 5개까지 저절로
  talkMode = 'enough'
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  const before = sent.length
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-plan-start').waitFor({ timeout: 20000 })
  await waitIdle(page)
  { const l289 = page.getByTestId('spec-plan-start'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  await waitIdle(page, 60000)
  await page.waitForTimeout(400)
  let mine = sent.slice(before)
  const partsReq = mine.filter((r) => r.assistId === 'spec.parts')
  const partsRow = page.locator('[data-testid="spec-board-row"][data-stage="parts"]')
  const rowText = (await partsRow.count()) ? await partsRow.innerText() : ''
  check('E1 1번째 답은 JSON 없음 → 멈추지 않고 이름표를 다시 알려 주며 2번째 부름(ask 에 comp · detail 안내)', partsReq.length === 2 && !partsReq[0].ask && /comp/.test(partsReq[1].ask ?? '') && /detail/.test(partsReq[1].ask ?? ''), partsReq.map((r) => r.ask))
  check('E2 2번째 답(머리글 없음 · 이름표가 tag 에 · 끝 잘림 · 코드 블록) → 구성요소 4 · 단계 2 로 읽고 다 씀', /구성요소 4개/.test(rowText) && /단계 2개/.test(rowText) && (await partsRow.getAttribute('data-phase')) === 'done', rowText)
  await partsRow.scrollIntoViewIfNeeded().catch(() => {})
  await shot(page, 'E-messy-board', false)
  { const l289 = page.getByTestId('spec-plan-body'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  await waitIdle(page, 60000)
  mine = sent.slice(before)
  check('E3 [이 구성으로 본문 · 청구항 쓰기] → 그 뒤 단계도 끝까지(본문 a~d · 청구항 · 고치기)', ['spec.a', 'spec.b', 'spec.c', 'spec.d', 'spec.e'].every((id) => mine.some((r) => r.assistId === id)), mine.map((r) => r.assistId))
  await page.getByTestId('spec-view-edit').click()
  await page.getByTestId('spec-tab-parts').click().catch(() => {})
  await page.waitForTimeout(300)
  const comps = await page.locator('[data-testid="spec-comp-name"]').evaluateAll((els) => els.map((e) => e.value)).catch(() => [])
  const does = await page.locator('[data-testid="spec-comp-does"]').evaluateAll((els) => els.map((e) => e.value)).catch(() => [])
  check('E4 직접 고치기 화면에도 구성요소 이름 그대로(진동 수집부 …) · 하는 일은 "~하는"(모은다 → 모으는 · "…를 수행하는" 없음)', comps.includes('진동 수집부') && comps.includes('교체시점 산출부') && does.includes('공구의 진동신호를 모으는') && does.every((x) => !/수행하는/.test(x)), { comps, does })
  await page.locator('[data-testid="spec-comp"]').first().scrollIntoViewIfNeeded().catch(() => {})
  await shot(page, 'E-messy-parts', false)
  check('E0 기획 대화가 첫 번에 "충분" 이면 그대로 아이디어 5개까지 저절로(대표가 누를 것 없음)', sent.slice(before, before + 2).map((r) => r.assistId).join() === 'spec.talk,spec.idea', sent.slice(before, before + 2).map((r) => r.assistId))
  check('E5 JS 오류 0', errors.length === 0, errors)
  partsMode = 'normal'
  talkMode = 'ask'
  await ctx.close()
}

/* ---------------- D-269 회사 이야기가 없으면 '회사 정보부터' → 자료를 넣으면 아이디어 / D-268 문장 이름 · 잘린 답 · 47점 P0 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  delayMs = 30
  trial = true
  cutC = 0
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  const before = sent.length
  // 회사를 고르지 않고 시작 — AI 가 읽을 회사 이야기가 없다
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-gate-company').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  check('T1 회사 이야기가 없으면 아이디어를 내지 않음(AI 부름 0) · 맨 위 "먼저 회사 정보를 넣어 주세요" · [자료 넣기] · 차례는 "회사 정보"', sent.length === before && (await page.getByTestId('spec-gate-company').isVisible()) && (await page.getByTestId('spec-gate-file').isVisible()) && /먼저 회사 정보/.test(await page.getByTestId('spec-board-head').innerText()) && (await page.getByTestId('spec-steps').getAttribute('data-phase')) === 'company', sent.slice(before).map((r) => r.assistId))
  await shot(page, 'T-gate', false)
  await page.getByTestId('spec-board-file-input').setInputFiles({ name: 'company.txt', mimeType: 'text/plain', buffer: Buffer.from('자료회사표식 — 화장품을 백화점 · 온라인 · 해외 판매채널로 판다. 채널마다 재고가 따로 논다.') })
  await page.getByTestId('spec-ideas-run').waitFor({ timeout: 8000 })
  check('T1b 자료를 넣으면 회사 정보 문이 닫히고 [아이디어 5개 내줘]', (await page.getByTestId('spec-gate-company').count()) === 0 && (await page.getByTestId('spec-board').getAttribute('data-phase')) === 'ideas')
  { const l289 = page.getByTestId('spec-ideas-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitIdle(page, 60000)
  const ideaReq = sent.slice(before).filter((r) => r.assistId === 'spec.idea')
  check('T1c 아이디어 내줘에 넣은 자료가 감', ideaReq.length === 1 && JSON.stringify(ideaReq[0].context).includes('자료회사표식'))
  { const l289 = page.getByTestId('spec-plan-start'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  await waitIdle(page, 60000)
  const reviewText = (await page.getByTestId('spec-review').count()) ? await page.getByTestId('spec-review').innerText() : ''
  check('T3 구성요소 이름이 문장("입력 자료를 수집합니다.") → "입력 자료 수집부(110)" · 줄일 수 없는 문장은 빠짐', /입력 자료 수집부\(110\)/.test(reviewText) && !/수집합니다/.test(reviewText) && !/보여줍니다/.test(reviewText) && /교체시점 산출부\(130\)/.test(reviewText), reviewText)
  { const l289 = page.getByTestId('spec-plan-body'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  await waitIdle(page, 60000)
  await page.waitForTimeout(400)
  await page.getByTestId('spec-cards-toggle').click()
  const mine = sent.slice(before)
  const cReq = mine.filter((r) => r.assistId === 'spec.c')
  const row = async (k) => {
    const l = page.locator(`[data-testid="spec-board-row"][data-stage="${k}"]`)
    return (await l.count()) ? l.innerText() : ''
  }
  check('T2 본문 ① 답이 길이 상한에서 잘림 → 한 번 더 "더 짧게" 부름 · 두 번째는 다 써서 알림 없음', cReq.length === 2 && !cReq[0].ask && /길이 상한/.test(cReq[1].ask ?? '') && !/잘렸을 수/.test(await row('c')), { asks: cReq.map((r) => r.ask), row: await row('c') })
  const j2 = mine.filter((r) => r.assistId === 'spec.judge' && /전체/.test(r.context?.purpose ?? ''))
  const j2Detail = ((j2[0]?.context?.sections ?? []).find((s) => s.name === '명세서 지금 글')?.rows ?? []).filter((r) => /^detail/.test(r.part)).map((r) => r.memo).join(' ')
  check('T4 자체점검 ② 가 구체적인 내용 전체를 봄(예전엔 앞 2,800자 · 끝 문단 못 봄) · 줄마다 560자 안', j2Detail.length > 3000 && j2Detail.includes('끝문단표식') && ((j2[0]?.context?.sections ?? []).find((s) => s.name === '명세서 지금 글')?.rows ?? []).every((r) => String(r.memo ?? '').length <= 560), j2Detail.length)
  check('T5 자체점검 ② 답이 잘림 → "더 짧게" 다시 판정 · 그래도 잘리면 진행 줄에 알림', j2.length >= 2 && /길이 상한/.test(j2[1].ask ?? '') && /잘렸을 수/.test(await row('judge2')), { asks: j2.map((r) => r.ask), row: await row('judge2') })
  const store = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /spec|patent/i.test(k)).map(([, v]) => v).join('\n'))
  check('T6 잘린 답의 마지막 고친 칸(청구항)은 넣지 않음 · 그 앞 고친 칸(요약)은 넣음', !store.includes('잘린청구항표식') && store.includes('채널마다 모아 운영상태를 산출하는'), store.length)
  const title = await page.getByTestId('spec-board-title').innerText()
  check('T7 고친 명칭 "한글{ENGLISH}" → 명칭 · 영문 두 칸(영문이 한글 명칭에 붙지 않음)', title.includes('판매 재고 연계 운영상태 산출 시스템 및 방법{SYSTEM AND METHOD FOR CALCULATING OPERATION STATE}') && !/방법 SYSTEM/.test(title), title)
  const head = page.getByTestId('spec-board-head')
  const summary = await page.getByTestId('spec-board-summary').innerText()
  check('T8 맨 위 — "다 썼어요 — 출원 전에 손볼 곳이 있어요" · 형식 점검과 자체점검 47점 · P0 1개를 따로', (await head.getAttribute('data-needs-work')) === 'yes' && /손볼 곳/.test(await head.innerText()) && /형식 점검/.test(summary) && /자체점검 47점 · P0 1개/.test(summary) && !/고칠 것 없음/.test(summary), { head: await head.innerText(), summary })
  await page.getByTestId('spec-cards-toggle').click()
  const toHead = () => page.getByTestId('spec-board-head').evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -90)
  })
  await toHead()
  await page.waitForTimeout(200)
  await shot(page, 'T-needs-work', false)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await toHead()
  await page.waitForTimeout(200)
  check('T10 휴대폰 390 — 맨 위 줄 · 판정 · 전문 넘침 0', (await overflowX(page)) <= 0 && (await page.getByTestId('spec-full').isVisible()), await overflowX(page))
  await shot(page, 'T-390', false)
  await page.getByTestId('spec-full').scrollIntoViewIfNeeded()
  await page.getByTestId('spec-full-view-split').click()
  await page.waitForTimeout(200)
  check('T11 휴대폰 390 — 나눠서 보기 넘침 0', (await overflowX(page)) <= 0, await overflowX(page))
  await shot(page, 'T-390-split', false)
  check('T9 JS 오류 0', errors.length === 0, errors)
  trial = false
  await ctx.close()
}

/* ---------------- D-269 회사 정보 문 — 휴대폰 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('spec-gate-company').waitFor({ timeout: 8000 }).catch(() => {})
  check('M-gate 360 회사 정보 문 넘침 0 · JS 오류 0', (await page.getByTestId('spec-gate-company').isVisible()) && (await overflowX(page)) <= 0 && errors.length === 0, { o: await overflowX(page), errors })
  await shot(page, 'M-360-gate')
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  { const l289 = page.getByTestId('spec-new'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-talk-option').first().waitFor({ timeout: 15000 }).catch(() => {})
  await waitIdle(page)
  await page.waitForTimeout(300)
  const tooWide = await page.getByTestId('spec-talk-option').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
  check(`M${width}t 기획 대화 — 질문 · 누를 답 4개 · 직접 적기 · 넘침 0 · 답 단추 글자 잘림 0`, (await page.getByTestId('spec-talk-option').count()) === 4 && (await page.getByTestId('spec-talk-own').isVisible()) && (await overflowX(page)) <= 0 && tooWide === 0, { o: await overflowX(page), tooWide })
  await page.getByTestId('spec-talk').scrollIntoViewIfNeeded()
  await shot(page, `M-${width}-talk`, false)
  { const l289 = page.getByTestId('spec-talk-next'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="spec-plan-idea"]').length === 5, null, { timeout: 20000 }).catch(() => {})
  await waitIdle(page)
  await page.waitForTimeout(400)
  check(`M${width} 아이디어 고르기 — 후보 5개 · 단추 · 넘침 0 · JS 오류 0`, (await page.getByTestId('spec-plan-idea').count()) === 5 && (await page.getByTestId('spec-plan-start').isVisible()) && (await overflowX(page)) <= 0 && errors.length === 0, { o: await overflowX(page), errors })
  await shot(page, `M-${width}-board`)
  await ctx.close()
}

await browser.close()
console.log(`\nqa:specboard: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
