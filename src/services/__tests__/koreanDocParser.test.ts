/**
 * 한국 기업 서류 파서 단위 테스트.
 * 실행: npm run test:doc-parser
 */

import {
  bizNoKind,
  corpNoChecksumOk,
  birthFromRrnPrefix,
  detectDocSource,
  formatBusinessNumber,
  formatCorporateNumber,
  parseKoreanBusinessDocument,
  parseKoreanDate,
} from '../koreanDocParser'
import { REREAD_MARK, bizKindFromText, bizNoChecksumOk, normalizeNumberText, readBusinessNumber } from '../bizNoRead'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/* ---------------- 날짜 ---------------- */
check('날짜: 한글 표기', parseKoreanDate('2019년 3월 5일') === '2019-03-05')
check('날짜: 점 구분', parseKoreanDate('2019.03.05') === '2019-03-05')
check('날짜: 하이픈', parseKoreanDate('2019-3-5') === '2019-03-05')
check('날짜: 8자리 숫자', parseKoreanDate('20190305') === '2019-03-05')
check('날짜: 잘못된 월', parseKoreanDate('2019년 13월 5일') === undefined)
check('날짜: 빈 값', parseKoreanDate('') === undefined)

/* ---------------- 주민번호 앞자리 → 생년월일 ---------------- */
check('생년: 1900년대(1)', birthFromRrnPrefix('801231', '1') === '1980-12-31')
check('생년: 1900년대(2)', birthFromRrnPrefix('750101', '2') === '1975-01-01')
check('생년: 2000년대(3)', birthFromRrnPrefix('050301', '3') === '2005-03-01')
check('생년: 2000년대(4)', birthFromRrnPrefix('010101', '4') === '2001-01-01')
check('생년: 잘못된 월 거부', birthFromRrnPrefix('801331', '1') === undefined)
check('생년: 자릿수 부족', birthFromRrnPrefix('8012', '1') === undefined)

/* ---------------- 번호 서식 ---------------- */
check('사업자번호: 정리', formatBusinessNumber('123 - 45 - 67890') === '123-45-67890')
check('사업자번호: 붙은 숫자', formatBusinessNumber('1234567890') === '123-45-67890')
check('사업자번호: 자릿수 오류', formatBusinessNumber('12345') === undefined)
check('법인번호: 정리', formatCorporateNumber('110111-1234567') === '110111-1234567')
check('법인번호: 자릿수 오류', formatCorporateNumber('11011112345') === undefined)

/* ---------------- 문서 종류 판별 ---------------- */
check('판별: 사업자등록증', detectDocSource('사업자등록증\n등록번호: 123-45-67890') === 'business_registration')
check('판별: 등기부등본', detectDocSource('등기사항전부증명서(말소사항 포함)\n본점') === 'corporate_registry')
check('판별: 알 수 없음', detectDocSource('그냥 아무 글') === 'unknown')

/* ---------------- 사업자등록증 전체 파싱 ---------------- */
{
  const text = `
사업자등록증
( 법인사업자 )
등록번호 : 214-88-01232

법인명(단체명) : 주식회사 대한정밀
대 표 자 : 김영수
개업연월일 : 2019년 03월 05일
법인등록번호 : 110111-7654321
사업장소재지 : 서울특별시 강남구 테헤란로 123, 5층
본점소재지 : 서울특별시 강남구 테헤란로 123
업 태 : 제조업
종 목 : 자동차부품
교부일자 : 2024년 01월 10일
`
  const r = parseKoreanBusinessDocument(text)
  check('사등: 종류 판별', r.source === 'business_registration', r.source)
  check('사등: 회사명', r.companyName === '주식회사 대한정밀', r.companyName)
  check('사등: 사업자번호', r.businessNumber === '214-88-01232', r.businessNumber)
  check('사등: 법인번호', r.corporateNumber === '110111-7654321', r.corporateNumber)
  check('사등: 대표자', r.representativeName === '김영수', r.representativeName)
  check('사등: 개업일', r.establishedAt === '2019-03-05', r.establishedAt)
  // 사업장 소재지와 본점 소재지가 다르면 본점을 쓴다 (컨설팅에서 쓰는 것은 등기부상 본점)
  check('사등: 주소는 본점 우선', r.address === '서울특별시 강남구 테헤란로 123', r.address)
  check('사등: 업태', r.businessCategory === '제조업', r.businessCategory)
  check('사등: 종목', r.businessItem === '자동차부품', r.businessItem)
}

/* ---------------- 등기부등본 전체 파싱 ---------------- */
{
  const text = `
등기사항전부증명서(말소사항 포함) - 주식회사

상호           주식회사 가나테크
본점           경기도 성남시 분당구 판교로 255번길 9-22
공고방법       회사의 인터넷 홈페이지에 게재한다
1주의 금액     금 5,000 원
회사성립연월일  2015년 07월 21일

등기번호       131114
법인등록번호   131111-0098765

임원에 관한 사항
대표이사  박지훈  801231-1******
사내이사  이수민  850505-2******
`
  const r = parseKoreanBusinessDocument(text)
  check('등기: 종류 판별', r.source === 'corporate_registry', r.source)
  check('등기: 상호', r.companyName === '주식회사 가나테크', r.companyName)
  check('등기: 본점 주소', r.address === '경기도 성남시 분당구 판교로 255번길 9-22', r.address)
  check('등기: 법인번호', r.corporateNumber === '131111-0098765', r.corporateNumber)
  check('등기: 회사성립연월일', r.establishedAt === '2015-07-21', r.establishedAt)
  check('등기: 대표이사', r.representativeName === '박지훈', r.representativeName)
  check('등기: 대표자 생년월일', r.representativeBirth === '1980-12-31', r.representativeBirth)
}

/* ---------------- 한 줄에 여러 항목이 붙어 있는 경우 ---------------- */
{
  const text = `사업자등록증
등록번호 : 111-22-33332  법인등록번호 : 110111-1111111
상호 : 주식회사 테스트  대표자 : 홍길동
업태 : 도매업  종목 : 전자부품`
  const r = parseKoreanBusinessDocument(text)
  check('혼합: 사업자번호', r.businessNumber === '111-22-33332', r.businessNumber)
  check('혼합: 법인번호', r.corporateNumber === '110111-1111111', r.corporateNumber)
  check('혼합: 회사명에 뒤 라벨 안 섞임', r.companyName === '주식회사 테스트', r.companyName)
  check('혼합: 대표자', r.representativeName === '홍길동', r.representativeName)
  check('혼합: 업태', r.businessCategory === '도매업', r.businessCategory)
}

/* ---------------- OCR 잡음 내성 ---------------- */
{
  const text = `사업자등록증
등 록 번 호 :  214 - 88 - 01232
상   호 :  주식회사 노이즈
대 표 자 :  최민호
개 업 연 월 일 :  2020 . 11 . 02`
  const r = parseKoreanBusinessDocument(text)
  check('잡음: 공백 섞인 사업자번호', r.businessNumber === '214-88-01232', r.businessNumber)
  check('잡음: 회사명', r.companyName === '주식회사 노이즈', r.companyName)
  check('잡음: 대표자', r.representativeName === '최민호', r.representativeName)
  check('잡음: 개업일', r.establishedAt === '2020-11-02', r.establishedAt)
}

/* ---------------- 값이 다음 줄에 있는 경우 ---------------- */
{
  const text = `사업자등록증
상호
주식회사 줄바꿈
대표자
정우성
등록번호
777-88-99993`
  const r = parseKoreanBusinessDocument(text)
  check('줄바꿈: 회사명', r.companyName === '주식회사 줄바꿈', r.companyName)
  check('줄바꿈: 대표자', r.representativeName === '정우성', r.representativeName)
  check('줄바꿈: 사업자번호', r.businessNumber === '777-88-99993', r.businessNumber)
}

/* ---------------- 못 읽으면 비워둔다 (틀린 값 채우지 않기) ---------------- */
{
  const r = parseKoreanBusinessDocument('완전히 관련 없는 문서입니다. 감사합니다.')
  check('안전: 종류 unknown', r.source === 'unknown')
  check('안전: 회사명 비움', r.companyName === undefined)
  check('안전: 사업자번호 비움', r.businessNumber === undefined)
  check('안전: 대표자 비움', r.representativeName === undefined)
}
{
  const r = parseKoreanBusinessDocument('사업자등록증\n등록번호: 12-3')
  check('안전: 자릿수 안 맞는 번호는 버림', r.businessNumber === undefined, r.businessNumber)
}

/* ---------------- 실제 사업자등록증 (칸이 이어 붙어 나오는 경우) ---------------- */
{
  // PDF 에서 글자를 뽑으면 표가 칸 단위로 이어 붙어 한 줄이 된다.
  // 업태 칸에 '제조업' 일곱 번, 종목 칸에 서로 다른 일곱 개가 줄줄이 붙는다.
  const text = `사 업 자 등 록 증
( 법인사업자 )
등록번호 : 519-87-03609
법 인 명 ( 단 체 명 ) : (주)샤인디자인
대 표 자 : 권유진
개 업 연 월 일 : 2024 년 04 월 12 일  법 인 등 록 번 호 : 284111-0443443
사 업 장 소 재 지 : 경기도 남양주시 순화궁로 282, 221호(별내동, 에이스하이엔드타워)
본 점 소 재 지 : 경기도 남양주시 순화궁로 282, 221호(별내동, 에이스하이엔드타워)
사 업 의 종 류 : 업태 제조업 제조업 제조업 제조업 제조업 제조업 제조업 종목 간판 및 광고물 제조업 구조용 금속 판제품 및 공작물 제조업 육상 금속 골조 구조재 제조업 그 외 금속 압형제품 제조업 전기회로 접속장치 제조업 전시 및 광고용 조명장치 제조업 전구 및 램프 제조업 (별지 출력)
발 급 사 유 :`
  const r = parseKoreanBusinessDocument(text)
  check('실물: 회사명', r.companyName === '(주)샤인디자인', r.companyName)
  check('실물: 대표자', r.representativeName === '권유진', r.representativeName)
  check('실물: 사업자등록번호', r.businessNumber === '519-87-03609', r.businessNumber)
  check('실물: 법인등록번호', r.corporateNumber === '284111-0443443', r.corporateNumber)
  check('실물: 개업일', r.establishedAt === '2024-04-12', r.establishedAt)
  // 주소는 본점 하나만. 뒤의 '사업의 종류' 가 딸려 오면 안 된다.
  check(
    '실물: 주소는 본점 한 줄만',
    r.address === '경기도 남양주시 순화궁로 282, 221호(별내동, 에이스하이엔드타워)',
    r.address,
  )
  // 업태는 같은 말이 일곱 번 — 하나로 줄인다
  check('실물: 업태는 중복을 지운 하나', r.businessCategory === '제조업', r.businessCategory)
  // 종목은 첫 항목이 대표, 나머지는 따로
  check('실물: 종목은 대표 하나', r.businessItem === '간판 및 광고물 제조업', r.businessItem)
  check('실물: 나머지 종목 6개 보관', (r.businessItemsExtra ?? '').split(' · ').length === 6, r.businessItemsExtra)
  check('실물: 나머지 종목에 대표 종목이 없다', !(r.businessItemsExtra ?? '').includes('간판 및'), r.businessItemsExtra)
  check('실물: 어떤 값도 문단이 되지 않는다', [r.address, r.businessCategory, r.businessItem].every((v) => (v ?? '').length < 80))
}

// D-210 — 주민등록번호를 법인등록번호로 넣지 않는다(절대 규칙) · 대표 생년월일은 대표 줄에서만
{
  const indiv = parseKoreanBusinessDocument(['사업자등록증명', '등록번호 : 123-45-67891', '상호 : 가나상회', '성명 : 홍길동', '주민(법인)등록번호 800101-1234567', '개업연월일 : 2020 년 03 월 02 일'].join('\n'))
  check('D210 개인사업자 주민(법인)등록번호 → 법인번호로 넣지 않음', indiv.corporateNumber === undefined, indiv.corporateNumber)
  const loose = parseKoreanBusinessDocument(['사업자등록증', '등록번호 : 123-45-67891', '상호 : 가나상회', '대표자 : 홍길동', '홍길동 800101-1234567', '개업연월일 : 2020 년 03 월 02 일'].join('\n'))
  check('D210 이름표 없는 13자리(사람 이름 뒤 · 개인사업자) → 법인번호 아님', loose.corporateNumber === undefined, loose.corporateNumber)
  const corpMixed = parseKoreanBusinessDocument(['사업자등록증명', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '주민(법인)등록번호 110111-0085450'].join('\n'))
  check('D210 법인(가운데 81) 주민(법인)등록번호 → 법인번호로', corpMixed.corporateNumber === '110111-0085450', corpMixed.corporateNumber)
  const reg = parseKoreanBusinessDocument(['등기사항전부증명서(현재 유효사항)', '등기번호 012345', '등록번호 110111-1234567', '상 호 미래바이오랩', '사내이사 이수민 850505-2******', '대표이사 박지훈 801231-1******', '회사성립연월일 2015 년 03 월 02 일'].join('\n'))
  check('D210 등기부 등록번호 → 법인번호(검증 숫자 몰라도 이름표로)', reg.corporateNumber === '110111-1234567', reg.corporateNumber)
  check('D210 등기부 — 대표 생년월일은 대표이사 줄(먼저 나온 사내이사 것이 아님)', reg.representativeName === '박지훈' && reg.representativeBirth === '1980-12-31', `${reg.representativeName} ${reg.representativeBirth}`)
  const regLoose = parseKoreanBusinessDocument(['등기사항전부증명서', '상 호 가나테크', '110111-0085450', '대표이사 김가나 750101-1******', '회사성립연월일 2015 년 03 월 02 일'].join('\n'))
  check('D210 등기부 이름표 없는 13자리 — 법인번호 검증 숫자가 맞으면', regLoose.corporateNumber === '110111-0085450', regLoose.corporateNumber)
  const regBad = parseKoreanBusinessDocument(['등기사항전부증명서', '상 호 가나테크', '800101-1234567 김감사', '대표이사 김가나 750101-1******', '회사성립연월일 2015 년 03 월 02 일'].join('\n'))
  check('D210 등기부 이름표 없는 13자리 — 검증 숫자가 틀리면 넣지 않음', regBad.corporateNumber === undefined, regBad.corporateNumber)
  check('D210 법인번호 검증 숫자(실제 번호 3개)', corpNoChecksumOk('130111-0006246') && corpNoChecksumOk('110111-0085450') && corpNoChecksumOk('110111-2487050') && !corpNoChecksumOk('110111-1234567'))
  check('D210 사업자 종류', bizNoKind('124-81-00998') === 'corp' && bizNoKind('123-45-67891') === 'individual' && bizNoKind('123-80-12345') === 'unknown' && bizNoKind('') === 'unknown')
}

/* ---------------- D-255 사업자등록번호 읽기 — 검증 숫자 · 다시 읽기 · 헷갈리는 숫자 후보 ---------------- */
{
  const corp = (no: string, extra: string[] = []) => ['사업자등록증', '(법인사업자)', `등록번호 : ${no}`, '법인명(단체명) : 주식회사 한빛정밀', '개업연월일 : 2018 년 03 월 15 일  법인등록번호 : 110111-0085450', ...extra].join('\n')
  check('N1 검증 숫자(실제 규칙)', bizNoChecksumOk('124-81-00998') && bizNoChecksumOk('178-81-47888') && !bizNoChecksumOk('118-81-47888'))
  const txt = readBusinessNumber(corp('178-81-47888'))
  check('N2 PDF 글자 · 검증 숫자 맞음 → 확실', txt.value === '178-81-47888' && txt.sure && txt.candidates.length === 0, JSON.stringify(txt))
  const ocrOnce = readBusinessNumber(corp('178-81-47888', [REREAD_MARK]))
  check('N3 스캔 · 다시 읽기 못함 → 값은 있어도 확인(저절로 안 넣음)', ocrOnce.value === '178-81-47888' && !ocrOnce.sure, JSON.stringify(ocrOnce))
  const ocrTwice = readBusinessNumber(corp('178-81-47888', [`${REREAD_MARK} 178-81-47888`, `${REREAD_MARK} 178-81-47888`]))
  check('N4 스캔 · 두 번 읽어 같음 → 확실', ocrTwice.value === '178-81-47888' && ocrTwice.sure, JSON.stringify(ocrTwice))
  // 7 을 1 로 잘못 읽음(팀장 사례) — 검증 숫자가 안 맞는다 → 넣지 않고 후보에 정답
  const wrong = readBusinessNumber(corp('118-81-47888', [REREAD_MARK]))
  check('N5 7→1 오독 → 값 비움 · 후보에 정답(178-81-47888)', wrong.value === '' && !wrong.sure && wrong.candidates.includes('178-81-47888'), JSON.stringify(wrong))
  check('N6 오독 후보는 모두 검증 숫자가 맞고 4개 이하', wrong.candidates.length <= 4 && wrong.candidates.every((c) => bizNoChecksumOk(c)))
  check('N7 법인 서류면 가운데 두 자리 81~88 후보만', wrong.candidates.every((c) => { const m = Number(c.slice(4, 6)); return m >= 81 && m <= 88 }))
  // 본문은 틀리고 다시 읽기(숫자만)는 맞음 → 다시 읽기 쪽 번호가 1순위 후보(확실은 아님 — 본문과 다름)
  const fixedByReread = readBusinessNumber(corp('118-81-47888', [`${REREAD_MARK} 178-81-47888`]))
  check('N8 본문 오독 + 다시 읽기 맞음 → 맞는 번호를 값으로 · 확인으로', fixedByReread.value === '178-81-47888' && !fixedByReread.sure, JSON.stringify(fixedByReread))
  // 대시가 점으로 · 대시가 빠짐 · 띄어 읽힘(예전에는 아예 못 찾았다)
  check('N9 대시가 점(361-45.70187)', readBusinessNumber(['사업자등록증', '(일반과세자)', '등록번호 : 361-45.70187'].join('\n')).value === '361-45-70187')
  check('N10 대시 빠짐(18481-71078)', readBusinessNumber(['사업자등록증', '(법인사업자)', '등록번호 : 18481-71078'].join('\n')).value === '184-81-71078')
  check('N11 띄어 읽힘(178 - 81 - 47888)', readBusinessNumber(corp('178 - 81 - 47888')).value === '178-81-47888')
  check('N12 전각 숫자 · 긴 대시', readBusinessNumber(corp('１７８–８１—４７８８８')).value === '178-81-47888')
  check('N13 숫자 사이 O/l → 0/1', normalizeNumberText('l24-8l-OO998') === '124-81-00998' && readBusinessNumber(corp('l24-8l-OO998')).value === '124-81-00998')
  // 한 자리 더 낌(117 사례처럼 숫자가 늘어남) — 하나 빼서 맞는 후보
  const extra = readBusinessNumber(corp('178-81-478188', [REREAD_MARK]))
  check('N14 숫자 하나 더 낌 → 넣지 않음 · 후보에 정답', extra.value === '' && extra.candidates.includes('178-81-47888'), JSON.stringify(extra))
  // 같은 줄의 다른 숫자 · 전화 · 발급번호 · 법인등록번호를 번호로 착각하지 않는다
  const noisy = readBusinessNumber(['발급번호 3650-366-2611-554', '사업자등록증', '(법인사업자)', '등록번호 : 178-81-47888   2018 년 03 월 15 일', '대표전화 02-1234-5678', '법인등록번호 : 110111-0085450'].join('\n'))
  check('N15 같은 줄 날짜 · 전화 · 발급번호 · 법인번호 섞여도 등록번호만', noisy.value === '178-81-47888' && noisy.sure, JSON.stringify(noisy))
  check('N16 등록번호 없는 글 → 빈 값', readBusinessNumber('대표전화 02-1234-5678\n2019 년 11 월 07 일').value === '')
  check('N17 서류 종류(법인/개인)', bizKindFromText('( 법인사업자 )') === 'corp' && bizKindFromText('(일반과세자)') === 'individual' && bizKindFromText('사업자등록증') === 'unknown')
  // 파서는 검증 숫자가 맞는 것만 돌려준다(틀린 숫자를 칸에 넣지 않게)
  check('N18 파서 — 오독 번호는 비움', parseKoreanBusinessDocument(corp('118-81-47888')).businessNumber === undefined)
  check('N19 파서 — 맞는 번호는 그대로', parseKoreanBusinessDocument(corp('178-81-47888')).businessNumber === '178-81-47888')
}

// D-415 스캔 글자가 이름 · 상호를 한 글자씩 띄워 읽으면 붙인다(낱말 사이 띄어쓰기는 그대로)
{
  const br = (rep: string, name: string) => parseKoreanBusinessDocument(['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', `법인명(단체명) : ${name}`, `대 표 자 : ${rep}`, '개업연월일 : 2019년 03월 04일'].join('\n'))
  const a = br('김 대 표', '주 식 회 사 미 래 테 크')
  check('D-415 "김 대 표" → 김대표 · "주 식 회 사 미 래 테 크" → 주식회사미래테크(예전: 대표자 빈칸)', a.representativeName === '김대표' && a.companyName === '주식회사미래테크', JSON.stringify(a))
  const b = br('김대표', '주식회사 미래테크')
  check('D-415 낱말 사이 띄어쓰기("주식회사 미래테크") · 붙은 이름은 그대로', b.representativeName === '김대표' && b.companyName === '주식회사 미래테크', JSON.stringify(b))
  const c = parseKoreanBusinessDocument(['사업자등록증', '등록번호 : 214-05-01239', '상 호 : 미래상사', '성 명 : 홍 길 동 800101-1******', '개업연월일 : 2019년 03월 04일'].join('\n'))
  check('D-415 띄운 이름 뒤 주민번호 앞자리 → 이름만', c.representativeName === '홍길동', JSON.stringify(c))
}

console.log(`\ndoc-parser: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('DOC_PARSER_PASS')
