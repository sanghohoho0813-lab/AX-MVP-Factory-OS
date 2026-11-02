/**
 * D-493 서류 신뢰 혹독 시험 — 사업자등록번호 · 법인등록번호 · 설립일(대표 2026-11-02 "절대 오류 없도록 · 더 빡세게").
 *
 * 정해진 씨앗으로 서류 글을 수백 장 만든다 — 사업자등록증(법인 · 개인) · 사업자등록증명(홈택스) · 법인 등기부등본,
 * 글자 PDF 와 사진 · 스캔(OCR) 두 가지, 헷갈리게 하는 줄(생년월일 · 발급일 · 취임일 · 등기번호 · 가린 주민번호 · 전화)과
 * 스캔 실수(0↔O · 1↔l · 5↔S · 8↔B · 띄어쓰기 · 숫자 하나 틀림 · 이웃 숫자 뒤바뀜)를 섞어서.
 * 실제 값 넣기(autoFillFromDocs)에 넣고 — 묻지 않고 넣은 값이 틀린 것(조용히 틀림)이 0 인지 센다.
 * 맞게 넣음 · 물어봄 · 못 읽음은 괜찮다(사람이 확인한다). 조용히 틀림은 하나도 없어야 한다.
 */
import { autoFillFromDocs, type ReadDoc } from '../docAutoFill'
import { normalizeClientOps } from '../clientOpsService'
import { bizNoChecksumOk } from '../bizNoRead'
import { corpNoChecksumOk } from '../koreanDocParser'
import type { ClientOpsRecord } from '../../types/clientOps'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
}

let seed = 20261102
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
const pad = (v: number, n = 2) => String(v).padStart(n, '0')

function makeBizNo(corp: boolean): string {
  for (;;) {
    const d = `${int(101, 899)}${pad(corp ? int(81, 88) : int(1, 79))}${pad(int(0, 9999), 4)}${int(0, 9)}`
    if (bizNoChecksumOk(d)) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  }
}
function makeCorpNo(): string {
  for (;;) {
    const d = `${pick(['110111', '130111', '134111', '160111', '175611', '284211', '120111', '150111'])}${pad(int(0, 999999), 6)}${int(0, 9)}`
    if (corpNoChecksumOk(d)) return `${d.slice(0, 6)}-${d.slice(6)}`
  }
}
function makeDate(y0 = 1998, y1 = 2025): { iso: string; y: number; m: number; d: number } {
  const y = int(y0, y1)
  const m = int(1, 12)
  const d = int(1, 28)
  return { iso: `${y}-${pad(m)}-${pad(d)}`, y, m, d }
}
const NAMES = ['미래바이오랩', '한솔테크', '다움에너지', '선한식품', '우일산업', '가온소프트', '누리메디칼', '바른건설', '새길로지스']
const PEOPLE = ['김민수', '이수진', '박지훈', '최은혜', '정하늘', '한도윤', '오세영', '윤서아']
const ADDR = ['서울특별시 강남구 테헤란로 123, 4층(역삼동)', '경기도 파주시 탄현면 평화로 3', '부산광역시 해운대구 센텀중앙로 79', '대전광역시 유성구 대학로 99']

const korDate = (x: { y: number; m: number; d: number }) => pick([`${x.y} 년 ${pad(x.m)} 월 ${pad(x.d)} 일`, `${x.y}년 ${x.m}월 ${x.d}일`, `${x.y}. ${pad(x.m)}. ${pad(x.d)}.`, `${x.y}-${pad(x.m)}-${pad(x.d)}`])
const spaced = (no: string) => pick([no, no, no.replace(/-/g, ''), no.replace(/-/g, ' - '), no.split('').join(' ').replace(/ - /g, '-')])

interface Truth {
  businessNumber: string | null
  corporateNumber: string | null
  establishedAt: string | null
}
interface Case {
  kind: string
  docKey: string
  text: string
  truth: Truth
}

function bizCertCorp(): Case {
  const biz = makeBizNo(true)
  const corp = makeCorpNo()
  const open = makeDate()
  const issue = makeDate(2024, 2026)
  const sameLine = rnd() < 0.5
  const lines = [
    '사업자등록증',
    '(법인사업자)',
    `${pick(['등록번호', '등 록 번 호'])} : ${spaced(biz)}`,
    `법인명(단체명) : ${pick(NAMES)}`,
    `대 표 자 : ${pick(PEOPLE)}`,
    ...(sameLine ? [`개업연월일 : ${korDate(open)}    법인등록번호 : ${spaced(corp)}`] : [`개업연월일 : ${korDate(open)}`, `${pick(['법인등록번호', '법 인 등 록 번 호'])} : ${spaced(corp)}`]),
    `사업장 소재지 : ${pick(ADDR)}`,
    `본 점 소 재 지 : ${pick(ADDR)}`,
    '사업의 종류 : 업태 제조업 종목 바이오 시약',
    '발 급 사 유 : 신규',
    `전자세금계산서 전용 메일주소 : tax${int(1, 99)}@example.co.kr`,
    `전화 ${pick(['02', '031', '051'])}-${int(200, 999)}-${pad(int(0, 9999), 4)}`,
    korDate(issue),
    `${pick(['역삼', '파주', '해운대', '유성'])}세무서장`,
  ]
  return { kind: '사업자등록증(법인)', docKey: 'businessRegistration', text: lines.join('\n'), truth: { businessNumber: biz, corporateNumber: corp, establishedAt: open.iso } }
}

function bizCertIndividual(): Case {
  const biz = makeBizNo(false)
  const open = makeDate()
  const birth = makeDate(1960, 1995)
  const issue = makeDate(2024, 2026)
  const lines = [
    '사업자등록증',
    `(${pick(['일반과세자', '간이과세자'])})`,
    `등록번호 : ${spaced(biz)}`,
    `상 호 : ${pick(NAMES)}`,
    `성 명 : ${pick(PEOPLE)}`,
    `생 년 월 일 : ${korDate(birth)}`,
    `개업연월일 : ${korDate(open)}`,
    `사업장 소재지 : ${pick(ADDR)}`,
    '사업의 종류 : 업태 도소매 종목 전자상거래',
    korDate(issue),
    '세무서장',
  ]
  return { kind: '사업자등록증(개인)', docKey: 'businessRegistration', text: lines.join('\n'), truth: { businessNumber: biz, corporateNumber: null, establishedAt: open.iso } }
}

function hometaxCert(corpKind: boolean): Case {
  const biz = makeBizNo(corpKind)
  const corp = corpKind ? makeCorpNo() : null
  const open = makeDate()
  const issue = makeDate(2025, 2026)
  const lines = [
    '사업자등록증명',
    `발급번호 ${int(1000, 9999)}-${int(100, 999)}-${int(1000, 9999)}-${int(100, 999)}`,
    `상호(법인명) ${pick(NAMES)}  사업자등록번호 ${spaced(biz)}`,
    `성명(대표자) ${pick(PEOPLE)}  주민(법인)등록번호 ${corp ? spaced(corp) : `${pad(int(60, 99))}${pad(int(1, 12))}${pad(int(1, 28))}-${int(1, 2)}******`}`,
    `사업장소재지 ${pick(ADDR)}`,
    `개업일 ${korDate(open)}`,
    `발급일 ${korDate(issue)}`,
    '위와 같이 사업자등록 사실을 증명합니다.',
  ]
  return { kind: corpKind ? '사업자등록증명(법인)' : '사업자등록증명(개인)', docKey: 'businessRegistration', text: lines.join('\n'), truth: { businessNumber: biz, corporateNumber: corp, establishedAt: open.iso } }
}

function registry(): Case {
  const corp = makeCorpNo()
  const est = makeDate()
  const later = makeDate(est.y + 1 > 2025 ? 2025 : est.y + 1, 2026)
  const masked = () => `${pad(int(60, 99))}${pad(int(1, 12))}${pad(int(1, 28))}-${int(1, 2)}******`
  const lines = [
    pick(['등기사항전부증명서(현재 유효사항)', '등기사항일부증명서(말소사항 포함)']),
    `등기번호 ${pad(int(0, 999999), 6)}`,
    `등록번호 ${spaced(corp)}`,
    `상 호 ${pick(NAMES)}`,
    `본 점 ${pick(ADDR)}`,
    `1주의 금액 금 ${pick(['5,000', '10,000', '500'])} 원`,
    `발행할 주식의 총수 ${int(10, 100)},000 주`,
    `회사성립연월일 ${korDate(est)}`,
    `사내이사 ${pick(PEOPLE)} ${masked()}`,
    `${korDate(later)} 취임`,
    `대표이사 ${pick(PEOPLE)} ${masked()}`,
    `${korDate(later)} 등기`,
    `발행일 ${korDate(makeDate(2025, 2026))}`,
  ]
  return { kind: '법인 등기부등본', docKey: 'corporateRegistry', text: lines.join('\n'), truth: { businessNumber: null, corporateNumber: corp, establishedAt: est.iso } }
}

/** 사진 · 스캔 실수 — 숫자 사이 0↔O · 1↔l · 5↔S · 8↔B, 띄어쓰기, 가끔 숫자 하나 틀림 · 이웃 숫자 뒤바뀜 */
function scanNoise(text: string): string {
  const swap: Record<string, string> = { '0': 'O', '1': 'l', '5': 'S', '8': 'B' }
  let out = text.replace(/\d/g, (ch) => (swap[ch] && rnd() < 0.08 ? swap[ch] : ch))
  if (rnd() < 0.35) {
    // 숫자 하나를 다른 숫자로(진짜 오독)
    const idx = [...out.matchAll(/\d/g)].map((m) => m.index ?? 0)
    if (idx.length) {
      const i = pick(idx)
      out = out.slice(0, i) + String((Number(out[i]) + int(1, 9)) % 10) + out.slice(i + 1)
    }
  }
  if (rnd() < 0.2) {
    // 이웃 숫자 뒤바뀜
    const m = [...out.matchAll(/\d\d/g)]
    if (m.length) {
      const i = pick(m).index ?? 0
      out = out.slice(0, i) + out[i + 1] + out[i] + out.slice(i + 2)
    }
  }
  return out
}

const empty = (): ClientOpsRecord => normalizeClientOps({ id: 'fz', companyName: '', toolResults: [] } as Partial<ClientOpsRecord>)
const NOW = '2026-11-02T00:00:00.000Z'
let idn = 0
const mk = () => `fz${++idn}`

const KEYS = ['businessNumber', 'corporateNumber', 'establishedAt'] as const
type Tally = { right: number; asked: number; none: number; wrong: number }
const tally: Record<string, Record<(typeof KEYS)[number], Tally>> = {}
const wrongs: string[] = []

const makers: (() => Case)[] = [bizCertCorp, bizCertIndividual, () => hometaxCert(true), () => hometaxCert(false), registry]
const ROUNDS = 160
for (let r = 0; r < ROUNDS; r += 1) {
  for (const make of makers) {
    const c = make()
    for (const method of ['pdf_text', 'ocr'] as const) {
      const text = method === 'ocr' ? scanNoise(c.text) : c.text
      const doc: ReadDoc = { key: c.docKey, fileName: `${c.kind}.${method === 'ocr' ? 'jpg' : 'pdf'}`, text, method, docSure: true }
      const out = autoFillFromDocs(empty(), [doc], NOW, mk)
      const tag = `${c.kind}·${method}`
      tally[tag] ??= { businessNumber: { right: 0, asked: 0, none: 0, wrong: 0 }, corporateNumber: { right: 0, asked: 0, none: 0, wrong: 0 }, establishedAt: { right: 0, asked: 0, none: 0, wrong: 0 } }
      for (const k of KEYS) {
        const got = (out.record[k] ?? '').trim()
        const truth = c.truth[k]
        const t = tally[tag][k]
        if (got) {
          if (truth && got.replace(/\D/g, '') === truth.replace(/\D/g, '')) t.right += 1
          else {
            t.wrong += 1
            if (wrongs.length < 25) wrongs.push(`${tag} ${k}: 넣음 ${got} · 정답 ${truth ?? '(없음)'}\n${text.split('\n').slice(0, 8).join(' | ')}`)
          }
        } else if (out.flagged.some((f) => f.key === k)) t.asked += 1
        else t.none += 1
      }
    }
  }
}

let totalWrong = 0
let totalRight = 0
let totalCases = 0
console.log('서류 신뢰 혹독 시험 — 종류 · 방식별 [맞게 넣음 / 물어봄 / 못 읽음 / 조용히 틀림]')
for (const [tag, per] of Object.entries(tally)) {
  const row = KEYS.map((k) => `${k === 'businessNumber' ? '사업자' : k === 'corporateNumber' ? '법인' : '설립'} ${per[k].right}/${per[k].asked}/${per[k].none}/${per[k].wrong}`).join('  ')
  console.log(`  ${tag.padEnd(22)} ${row}`)
  for (const k of KEYS) {
    totalWrong += per[k].wrong
    totalRight += per[k].right
    totalCases += per[k].right + per[k].asked + per[k].none + per[k].wrong
  }
}
if (wrongs.length) console.error(`조용히 틀린 예:\n${wrongs.join('\n---\n')}`)
check(`D-493 조용히 틀림 0 (서류 ${ROUNDS * makers.length * 2}장 · 값 ${totalCases}개)`, totalWrong === 0, `${totalWrong}개`)
// 글자 PDF 는 대부분 바로 들어가야 한다(물어보기만 하면 자동이 아니다)
const pdfRight = Object.entries(tally)
  .filter(([tag]) => tag.endsWith('pdf_text'))
  .reduce((s, [, per]) => s + KEYS.reduce((a, k) => a + per[k].right, 0), 0)
const pdfShould = Object.entries(tally)
  .filter(([tag]) => tag.endsWith('pdf_text'))
  .reduce((s, [tag]) => s + (tag.includes('개인') ? 2 : tag.includes('등기부') ? 2 : 3) * ROUNDS, 0)
console.log(`글자 PDF 바로 넣음 ${pdfRight}/${pdfShould} (${Math.round((pdfRight / pdfShould) * 100)}%) · 전체 맞게 넣음 ${totalRight}/${totalCases}`)
check('D-493 글자 PDF 의 중요 번호는 95% 이상 바로 들어감', pdfRight / pdfShould >= 0.95, `${pdfRight}/${pdfShould}`)

console.log(`\ndoc-trust: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
