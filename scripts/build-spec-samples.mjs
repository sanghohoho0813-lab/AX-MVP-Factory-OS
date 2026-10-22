/**
 * D-263 명세서 샘플 묶음 만들기 — 대표가 올려 둔 실제 출원 명세서(PDF 100건 남짓)를 글자로 읽은 것(OCR)에서
 * '실제 명세서가 어떻게 생겼는지' 숫자 · 문장 틀만 뽑아 api/_ai/specSamples.js 로.
 *
 *   node scripts/build-spec-samples.mjs <OCR 글 폴더(*.txt)>
 *
 * 원본 PDF · 읽은 글은 저장소에 넣지 않는다(발명 내용 · 회사 이름이 들어 있다). 여기서 나가는 것은
 * 칸 순서 · 길이 · 청구항 수 · 자주 쓰는 문장 틀(몇 건 중 몇 건)뿐 — 어느 발명인지 알 수 있는 글은 넣지 않는다.
 * OCR 이 한글을 조금씩 틀리게 읽으므로(예 '배경' → '빼경') 머리글은 느슨하게 찾고, 못 읽은 건은 세지 않는다.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('사용법: node scripts/build-spec-samples.mjs <OCR 글 폴더>')
  process.exit(1)
}

/** 머리글 이름 → 칸(느슨하게 — OCR 오자 견딤) */
function headKind(raw) {
  const t = raw.replace(/[\s【】[\]()]/g, '')
  if (/명칭/.test(t)) return 'title'
  if (/선행기술|문헌/.test(t)) return 'priorDocs'
  if (/기술분야|^분야/.test(t)) return 'field'
  if (/배경|경기술$/.test(t)) return 'background'
  if (/수단/.test(t)) return 'solution'
  if (/과제/.test(t)) return 'problem'
  if (/효과/.test(t)) return 'effect'
  if (/도면/.test(t) && /설명/.test(t)) return 'drawings'
  if (/구체적|실시하기/.test(t)) return 'detail'
  if (/부호/.test(t)) return 'signs'
  if (/[청정]구항\d+/.test(t)) return 'claim'
  if (/청구범위|^[청정]구/.test(t)) return 'claims'
  if (/요약서/.test(t)) return 'abstractDoc'
  if (/^요약$|^요악$/.test(t)) return 'abstract'
  if (/대표도/.test(t)) return 'repFig'
  if (/발명의내용/.test(t)) return 'content'
  if (/발명의설명/.test(t)) return 'desc'
  return ''
}

const PARA = /[[【(]\s*\d{4}\s*[\]】)]+/g
const HEAD = /^【([^【】]{1,24})[】\]]\s*$/

function parse(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => !/^=== page \d+/.test(l) && !/^KIPO$/.test(l.trim()))
  const sections = {}
  const order = []
  const claims = []
  let cur = ''
  let claimNo = 0
  for (const line of lines) {
    const m = HEAD.exec(line.trim())
    const kind = m ? headKind(m[1]) : ''
    if (kind) {
      if (kind === 'claim') {
        claimNo = Number(/(\d+)/.exec(m[1].replace(/\s/g, ''))?.[1] ?? claims.length + 1)
        claims.push({ no: claimNo, text: '' })
        cur = 'claim'
        continue
      }
      cur = kind
      if (!order.includes(kind)) order.push(kind)
      sections[kind] = sections[kind] ?? ''
      continue
    }
    if (cur === 'claim') claims[claims.length - 1].text += line + '\n'
    else if (cur) sections[cur] += line + '\n'
  }
  return { sections, order, claims }
}

const hangul = (s) => (s.match(/[가-힣]/g) ?? []).length
const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q)
  if (!a.length) return null
  return a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2)
}
const q = (xs, p) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((m, n) => m - n)
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null
}
const round = (n, to) => (n == null ? null : Math.round(n / to) * to)

const DEP = /(?:제\s*)?\d+\s*항\s*(?:에|에서|내지|또는|중)|[청정]구항\s*\d+\s*(?:에|항|내지|또는|중)/

const files = readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()
const st = { files: files.length, read: 0, skipped: 0 }
const has = {}
const len = {}
const claimN = []
const indepN = []
const claim1Len = []
const absLen = []
const paraN = []
const figN = []
const signN = []
const titleEnds = {}
let englishTitle = 0
let methodIndep = 0
let systemAndMethod = 0
const phrase = {}
const bump = (k, ok) => {
  phrase[k] = (phrase[k] ?? 0) + (ok ? 1 : 0)
}
const ORDER_KEYS = ['title', 'field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail', 'signs', 'claims', 'abstract']
let orderOk = 0

for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8')
  const p = parse(text)
  const found = ORDER_KEYS.filter((k) => p.sections[k] != null || (k === 'claims' && p.claims.length))
  if (found.length < 6 || !p.claims.length) {
    st.skipped += 1
    continue
  }
  st.read += 1
  for (const k of [...ORDER_KEYS, 'priorDocs', 'repFig']) if (p.sections[k] != null || (k === 'claims' && p.claims.length)) has[k] = (has[k] ?? 0) + 1
  for (const k of ['field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail']) if (p.sections[k] != null) (len[k] = len[k] ?? []).push(hangul(p.sections[k]))
  // 순서 — 본문 칸이 표준 순서대로 나오는지
  const seq = p.order.filter((k) => ['field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail'].includes(k))
  const want = ['field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail'].filter((k) => seq.includes(k))
  if (seq.join() === want.join()) orderOk += 1
  // 청구항
  const cl = p.claims.filter((c) => hangul(c.text) > 5)
  claimN.push(Math.max(...cl.map((c) => c.no), cl.length))
  const indep = cl.filter((c) => !DEP.test(c.text.replace(/\n/g, ' ').slice(0, 40)))
  indepN.push(indep.length)
  if (cl[0]) claim1Len.push(hangul(cl[0].text))
  const ends = indep.map((c) => /([가-힣]+)\s*\.?\s*$/.exec(c.text.trim().replace(/\.$/, ''))?.[1] ?? '')
  if (ends.some((e) => /방법$/.test(e))) methodIndep += 1
  if (ends.some((e) => /방법$/.test(e)) && ends.some((e) => /(시스템|장치)$/.test(e))) systemAndMethod += 1
  const c1 = (cl[0]?.text ?? '').replace(/\n/g, ' ')
  bump('claim1_포함하는', /포함하(?:는|되|고|며)/.test(c1))
  bump('claim1_특징으로', /특징으로\s*하는/.test(c1))
  bump('claim1_상기', /상기/.test(c1))
  bump('claim1_세미콜론', /[;:]\s/.test(c1))
  const deps = cl.filter((c) => DEP.test(c.text.replace(/\n/g, ' ').slice(0, 40)))
  bump('dep_있어서', deps.length > 0 && deps.filter((c) => /있어서/.test(c.text.slice(0, 40))).length >= deps.length / 2)
  bump('dep_제n항', deps.length > 0 && deps.filter((c) => /제\s*\d+\s*항/.test(c.text.slice(0, 30))).length >= deps.length / 2)
  // 명칭
  const title = (p.sections.title ?? '').replace(/\n/g, ' ').trim()
  if (/\{[^}]*[A-Za-z]{3,}/.test(title) || /[A-Z]{4,}/.test(title)) englishTitle += 1
  const ko = title.split(/[{(]/)[0].trim()
  const end = /(시스템\s*및\s*방법|장치\s*및\s*방법|시스템|장치|방법)\s*$/.exec(ko)?.[1]?.replace(/\s+/g, ' ') ?? '물건 이름(~기 · ~체 · ~구조 · 조성물 등)'
  titleEnds[end] = (titleEnds[end] ?? 0) + 1
  // 요약 · 문단 · 도면 · 부호
  const abs = p.sections.abstract ?? ''
  if (abs) absLen.push(abs.replace(/\s+/g, ' ').trim().length)
  const paras = new Set((text.match(PARA) ?? []).map((x) => x.replace(/\D/g, '')))
  paraN.push(paras.size)
  const figs = [...(p.sections.drawings ?? '').matchAll(/도\s*(\d{1,2})\s*[은는a-z]/g)].map((m) => Number(m[1]))
  if (figs.length) figN.push(Math.max(...figs))
  const signs = (p.sections.signs ?? '').split('\n').filter((l) => /^\s*\d{1,4}[a-z]?\s*[:：]/.test(l)).length
  if (signs) signN.push(signs)
  // 칸마다 자주 쓰는 문장 틀
  const s = (k) => (p.sections[k] ?? '').replace(/\n/g, ' ')
  bump('field_관한것', /본\s*발명은.{0,120}관한\s*것/.test(s('field')))
  bump('field_상세하게는', /(?:더욱|보다)\s*(?:상세하게는|구체적으로는)|상세하게는|구체적으로는/.test(s('field')))
  bump('bg_종래', /종래/.test(s('background')))
  bump('bg_문제점', /문제(?:점)?(?:이|가)\s*있/.test(s('background')))
  bump('bg_특허문헌', /(?:공개|등록)\s*특허|특허\s*(?:문헌|공보)|제\s*10-\d{4}/.test(s('background') + s('priorDocs')))
  bump('problem_목적', /목적으로\s*한다|목적이\s*있다/.test(s('problem')))
  bump('problem_제공', /제공하(?:는|고자|기)/.test(s('problem')))
  bump('problem_한정안됨', /언급되지\s*않은|이상에서\s*언급|제한되지\s*않/.test(s('problem')))
  bump('solution_위하여', /(?:과제|목적)[를을]?\s*(?:해결|달성)하기\s*위(?:한|하여)/.test(s('solution')))
  bump('solution_일실시예', /일\s*실시\s*?예|일\s*측면|일\s*양태/.test(s('solution')))
  bump('effect_따르면', /본\s*발명(?:의\s*[^,]{0,20})?에\s*(?:따르면|의하면)/.test(s('effect')))
  bump('effect_효과가있다', /효과가\s*있다|효과를\s*(?:가진다|갖는다|제공)/.test(s('effect')))
  bump('drawings_도면이다', /도면이다|도시한\s*것|나타낸\s*(?:것|도면)/.test(s('drawings')))
  bump('detail_첨부도면', /첨부(?:된|한)?\s*도면을?\s*참조/.test(s('detail')))
  bump('detail_통상의기술자', /통상의\s*(?:지식|기술)|당업자/.test(s('detail')))
  bump('detail_실시예', /실시\s*?예/.test(s('detail')))
  bump('detail_부호', /[가-힣]\(\d{2,4}[a-z]?\)/.test(s('detail')))
}

const N = st.read
const pct = (n) => `${Math.round(((n ?? 0) / N) * 100)}%`
const rng = (xs, to = 1) => `가운데 ${round(median(xs), to)} · 보통 ${round(q(xs, 0.25), to)}~${round(q(xs, 0.75), to)}`
const ends = Object.entries(titleEnds)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}건`)
  .join(' · ')

const LABEL = { field: '기술분야', background: '배경기술', problem: '해결하려는 과제', solution: '과제의 해결 수단', effect: '발명의 효과', drawings: '도면의 간단한 설명', detail: '발명을 실시하기 위한 구체적인 내용' }

const out = [
  `[실제 출원 명세서 ${N}건에서 뽑은 모양 — 숫자는 한글 글자 수(OCR 로 읽어 ±10% 오차) · '몇 %' 는 그 문장 틀을 쓴 명세서 비율]`,
  '이 숫자 · 틀은 "실제로 특허청에 낸 명세서가 이렇게 생겼다" 는 참고다. [기준 문서] 규칙이 우선이고, 숫자를 맞추려고 내용을 늘리거나 지어내지 않는다.',
  '',
  '1) 칸 순서 · 있는 칸',
  `- 표준 순서(기술분야 → 배경기술 → 해결하려는 과제 → 과제의 해결 수단 → 발명의 효과 → 도면의 간단한 설명 → 구체적인 내용)를 지킨 명세서 ${pct(orderOk)}.`,
  `- 칸이 있는 비율: ${['field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail', 'signs'].map((k) => `${LABEL[k] ?? '부호의 설명'} ${pct(has[k])}`).join(' · ')} · 선행기술문헌 ${pct(has.priorDocs)} · 대표도 ${pct(has.repFig)}.`,
  '',
  '2) 칸 길이(한글 글자 수)',
  ...['field', 'background', 'problem', 'solution', 'effect', 'drawings', 'detail'].map((k) => `- ${LABEL[k]}: ${rng(len[k] ?? [], k === 'detail' ? 500 : 10)}`),
  `- 문단 번호([0001]…): ${rng(paraN, 5)}개 · 도면: ${rng(figN)}장 · 부호의 설명: ${rng(signN)}줄.`,
  `- 요약서: ${rng(absLen, 10)}자(공백 포함 · 400자 넘는 것 ${absLen.filter((x) => x > 400).length}건 — 특허로 기준 400자 안).`,
  '',
  '3) 청구항',
  `- 청구항 수: ${rng(claimN)}개 · 독립항: ${rng(indepN)}개 · 청구항 1 길이: ${rng(claim1Len, 10)}자.`,
  `- 독립항에 방법 청구항이 있는 명세서 ${pct(methodIndep)} · 시스템(장치)과 방법을 같이 청구한 명세서 ${pct(systemAndMethod)}.`,
  `- 청구항 1 문장 틀: "~를 포함하는/포함하되" ${pct(phrase.claim1_포함하는)} · "~것을 특징으로 하는" ${pct(phrase.claim1_특징으로)} · "상기 ~" 로 앞 구성을 다시 부름 ${pct(phrase.claim1_상기)} · 구성마다 ";" 로 끊음 ${pct(phrase.claim1_세미콜론)}.`,
  `- 종속항 머리: "제n항에 있어서" ${pct(phrase['dep_제n항'])} · "~에 있어서" 꼴 ${pct(phrase['dep_있어서'])}(나머지는 "청구항 n에 있어서").`,
  '',
  '4) 명칭',
  `- 끝말: ${ends}.`,
  `- 영문 명칭을 같이 쓴 명세서 ${pct(englishTitle)}.`,
  '',
  '5) 칸마다 자주 쓰는 문장 틀(이 틀을 그대로 써도 된다)',
  `- 기술분야: "본 발명은 ~에 관한 것으로, 더욱 상세하게는 ~에 관한 것이다." — "~에 관한 것" ${pct(phrase.field_관한것)} · "더욱 상세하게는/구체적으로는" ${pct(phrase.field_상세하게는)}.`,
  `- 배경기술: "종래에는 ~" ${pct(phrase.bg_종래)} · "~라는 문제점이 있다" ${pct(phrase.bg_문제점)} · 특허문헌(공개/등록 번호) 인용 ${pct(phrase.bg_특허문헌)}.`,
  `- 해결하려는 과제: "~하는 것을 목적으로 한다/목적이 있다" ${pct(phrase.problem_목적)} · "~를 제공하는 것" ${pct(phrase.problem_제공)} · "언급되지 않은 또 다른 과제들은 … 명확하게 이해될 수 있을 것이다" 꼴 ${pct(phrase.problem_한정안됨)}.`,
  `- 과제의 해결 수단: "상기 과제를 해결하기 위한 …" ${pct(phrase.solution_위하여)} · "본 발명의 일 실시예에 따른 …" ${pct(phrase.solution_일실시예)} — 청구항 1 을 문장으로 풀어 씀.`,
  `- 발명의 효과: "본 발명에 따르면 ~" ${pct(phrase.effect_따르면)} · "~할 수 있는 효과가 있다" ${pct(phrase.effect_효과가있다)}.`,
  `- 도면의 간단한 설명: "도 n은 ~를 나타낸 도면이다/도시한 것이다" ${pct(phrase.drawings_도면이다)}.`,
  `- 구체적인 내용: "이하, 첨부된 도면을 참조하여 …" ${pct(phrase.detail_첨부도면)} · "통상의 지식을 가진 자(당업자)" ${pct(phrase.detail_통상의기술자)} · "일 실시예" ${pct(phrase.detail_실시예)} · 구성 이름 뒤에 부호 "수집부(110)" ${pct(phrase.detail_부호)}.`,
].join('\n')

const meta = { files: st.files, read: st.read, skipped: st.skipped, chars: out.length }
writeFileSync(
  new URL('../api/_ai/specSamples.js', import.meta.url),
  [
    '/**',
    ' * D-263 실제 출원 명세서 샘플에서 뽑은 모양(숫자 · 문장 틀만) — scripts/build-spec-samples.mjs 가 만든다. 손으로 고치지 않는다.',
    ' * 원본(PDF · OCR 글)은 저장소에 없다. 어느 발명인지 알 수 있는 글은 넣지 않았다.',
    ' */',
    `export const SPEC_SAMPLES = ${JSON.stringify(out)}`,
    '',
    `export const SPEC_SAMPLES_META = ${JSON.stringify(meta)}`,
    '',
  ].join('\n'),
)
console.log(out)
console.log('\n', meta)
