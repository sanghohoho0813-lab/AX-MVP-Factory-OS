/**
 * 한국 기업 서류 파서 단위 테스트.
 * 실행: npm run test:doc-parser
 */

import {
  birthFromRrnPrefix,
  detectDocSource,
  formatBusinessNumber,
  formatCorporateNumber,
  parseKoreanBusinessDocument,
  parseKoreanDate,
} from '../koreanDocParser'

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
등록번호 : 214-88-01234

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
  check('사등: 사업자번호', r.businessNumber === '214-88-01234', r.businessNumber)
  check('사등: 법인번호', r.corporateNumber === '110111-7654321', r.corporateNumber)
  check('사등: 대표자', r.representativeName === '김영수', r.representativeName)
  check('사등: 개업일', r.establishedAt === '2019-03-05', r.establishedAt)
  check('사등: 주소', r.address === '서울특별시 강남구 테헤란로 123, 5층', r.address)
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
등록번호 : 111-22-33333  법인등록번호 : 110111-1111111
상호 : 주식회사 테스트  대표자 : 홍길동
업태 : 도매업  종목 : 전자부품`
  const r = parseKoreanBusinessDocument(text)
  check('혼합: 사업자번호', r.businessNumber === '111-22-33333', r.businessNumber)
  check('혼합: 법인번호', r.corporateNumber === '110111-1111111', r.corporateNumber)
  check('혼합: 회사명에 뒤 라벨 안 섞임', r.companyName === '주식회사 테스트', r.companyName)
  check('혼합: 대표자', r.representativeName === '홍길동', r.representativeName)
  check('혼합: 업태', r.businessCategory === '도매업', r.businessCategory)
}

/* ---------------- OCR 잡음 내성 ---------------- */
{
  const text = `사업자등록증
등 록 번 호 :  214 - 88 - 01234
상   호 :  주식회사 노이즈
대 표 자 :  최민호
개 업 연 월 일 :  2020 . 11 . 02`
  const r = parseKoreanBusinessDocument(text)
  check('잡음: 공백 섞인 사업자번호', r.businessNumber === '214-88-01234', r.businessNumber)
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
777-88-99999`
  const r = parseKoreanBusinessDocument(text)
  check('줄바꿈: 회사명', r.companyName === '주식회사 줄바꿈', r.companyName)
  check('줄바꿈: 대표자', r.representativeName === '정우성', r.representativeName)
  check('줄바꿈: 사업자번호', r.businessNumber === '777-88-99999', r.businessNumber)
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

console.log(`\ndoc-parser: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('DOC_PARSER_PASS')
