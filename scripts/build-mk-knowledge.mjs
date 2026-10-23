/**
 * D-273 마케팅 기준 묶음 만들기 — 대표가 전달한 docx 두 개(SNS 공식 통합본 · 유튜브 롱폼 공식)에서 채널마다 필요한 장만 뽑아 api/_ai/mkKnowledge.js 로.
 *
 *   node scripts/build-mk-knowledge.mjs <SNS 통합본.docx> <유튜브 롱폼 공식.docx> [SNS 보충본.docx]
 *
 * D-274 보충본(통합본에 없던 자료) — 1부 운영 원칙(대표가 대화에서 정한 기준 · 다른 공식보다 먼저)만 뽑는다.
 *   2~3부(참고한 외부 방법 1~5차 분석)와 4부 규칙집(1~4차)은 이미 홍보 글 만들기(D-229 · D-234)에 들어가 있고, 고친 줄(⟲6~10차)은 통합본에 있다.
 *   부록 B 분석 판정 기준은 영어 지시문 · 내부 경로라 그대로 넣지 않고, 분류 이름만 우리 말로 다시 적었다(아래 JUDGE).
 *
 * 원본 파일은 저장소에 넣지 않는다(대표 PC · 대화에 올린 파일). 뽑은 장은 서버 함수(api/)에서만 쓰고 브라우저 번들에는 들어가지 않는다.
 * 표는 줄마다 '칸 | 칸' 으로 편다. 장은 줄 번호가 아니라 머리글로 찾는다 — 원본이 고쳐져도 같은 장을 다시 뽑는다.
 * 남의 계정 이름 · 참고한 외부 방법 이름 · 원본 파일 경로는 뺀다(D-264 · CLAUDE.md).
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { sanitizeKnowledge } from '../api/_ai/guard.js'

const [snsPath, longPath, supPath] = process.argv.slice(2)
if (!snsPath || !longPath) {
  console.error('사용법: node scripts/build-mk-knowledge.mjs <SNS 통합본.docx> <유튜브 롱폼 공식.docx>')
  process.exit(1)
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const textOf = (xml) => unescape(xml.replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** docx → 줄(문단 한 줄 · 표는 행마다 '칸 | 칸') */
function docxLines(path) {
  const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const body = xml.slice(xml.indexOf('<w:body>'), xml.lastIndexOf('</w:body>'))
  const out = []
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  for (const m of body.matchAll(re)) {
    const block = m[0]
    if (block.startsWith('<w:tbl>')) {
      for (const row of block.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
        const cells = (row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(textOf).filter(Boolean).join(' / '))
        if (cells.some(Boolean)) out.push(cells.join(' | '))
      }
    } else {
      const t = textOf(block)
      out.push(t)
    }
  }
  return out
}

/** 머리글 줄(이 글로 시작)부터 다음 머리글 앞까지 — from 번째(0부터) 나온 것 */
function between(lines, startHead, endHead, label, from = 0) {
  let a = -1
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i].startsWith(startHead)) {
      if (seen === from) {
        a = i
        break
      }
      seen++
    }
  }
  if (a < 0) throw new Error(`${label}: 시작 머리글을 찾지 못함 — ${startHead}`)
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endHead))
  if (b < 0) throw new Error(`${label}: 끝 머리글을 찾지 못함 — ${endHead}`)
  return lines.slice(a, b).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/*
 * 참고한 외부 방법 · 남의 계정 · 파일 이름은 빼고 '예전 공식' 처럼 일반 말로(쓰지 않는 이름은 guard 가 한 번 더 지운다).
 */
const SCRUB = [
  [/\(\s*이상한\s*AI\s*·\s*자청\s*\)/g, ''],
  [/이상한\s*AI\s*·\s*자청\s*·?\s*(?:김팀장\s*)?(?:대본\s*가이드\s*)?(?:V1\.8)?/g, '예전 공식'],
  [/이상한\s*AI\s*(?:유튜브|릴스|쇼츠)?\s*(?:도구\s*)?(?:공식|기준|도구)?(?:\s*\(규칙집\s*[\d-]+\))?(?:\s*\(?\d+~\d+차\)?)?/g, '예전 공식'],
  [/자청\s*공식\s*중\s*/g, '예전 공식 가운데 '],
  [/자청\s*(?:릴스\s*)?(?:강의\s*)?(?:공식)?\s*(?:\(\d차\))?/g, ''],
  [/표본이론/g, '표본(누구나 볼 주제) 원칙'],
  [/쓰레드나이스/g, '자동 발행 도구'],
  [/\(Mosseri[^)]*\)/g, ''],
  [/Vista Social, Postory, Joltsage/g, '2차 자료'],
  [/@[A-Za-z0-9_.]+/g, '[계정]'],
  [/[A-Za-z]:\\[^\s)]*/g, ''],
  // 문서 안 폴더 경로(배포자료\체크리스트_카드\ 처럼) — 우리 저장 위치는 밖으로 내지 않는다
  [/\(?[\w가-힣_-]+\\(?:[\w가-힣_*.-]+\\?)*\)?/g, ''],
  [/[\w가-힣._-]+\.(?:md|csv|jsonl|js|py|docx|txt)\b/g, ''],
  [/\s*〔[^〕]*〕/g, ''],
  [/\s*⟲\s*\d+차/g, ''],
]
const scrub = (s) => SCRUB.reduce((acc, [re, rep]) => acc.replace(re, rep), s).replace(/[ \t]{2,}/g, ' ').replace(/\(\s*\)/g, '')

const sns = docxLines(snsPath)
const long = docxLines(longPath)
const sup = supPath ? docxLines(supPath) : null

/** 보충본 1부 — 대표 운영 원칙. 작업 메모 · 외부 도구 계정 이야기 · 파일 경로 줄은 뺀다 */
const principles = sup
  ? between(sup, '1부. 운영 원칙', '2부. ', 'mk_principles')
      .split('\n')
      .filter((l) => !/isanghanai|마이페이지|작업 메모|Claude|사용자가 직접 한다/.test(l))
      .map((l) => l.replace(/^Related:.*$/, '').replace(/가이드\(내 유튜브 영상.*?\.md\)/g, '가이드').replace(/이상한\s*AI\s*실험\s*정리/g, '예전 실험 정리').replace(/이상한\s*AI\s*대본/g, '참고한 대본'))
      .filter(Boolean)
      .join('\n')
  : ''

/**
 * 벤치마킹 판정 기준 — 대표가 승 · 패 비교에 쓴 분류(보충본 부록 B)를 우리 말로. 남의 영상을 볼 때 같은 말로 분류해야
 * 통합본의 숫자(승 · 패 비율)와 맞대어 읽을 수 있다.
 */
const JUDGE = [
  '벤치마킹 영상 · 글을 볼 때 쓰는 판정 기준(대표가 잘 된 것 · 안 된 것 비교에 쓴 분류와 같은 말)',
  '주제: AI·자동화 / 자금·지원사업 / 창업·스타트업 / 세금·법인 / 마케팅·브랜딩 / 자영업·매장 / 커리어·부업 / 기타',
  '형식(숏폼): 정보 제공 / 문제 해결 / 스토리텔링 / 리스트 / 뉴스·이슈 해설 / 상황극·밈 / 현장·브이로그 / 대화·인터뷰 / 화면 시연 / 말 없는 글자·음악형',
  '형식(롱폼): 정보 해설 / 뉴스·이슈 해설 / 사례·스토리 / 인터뷰·대담 / 강의 / 리스트 / 화면 시연 / 현장·브이로그 / 상황극 · 채널 유형: 전문가 개인 / 업체·기관 / 방송·뉴스 / 일반 크리에이터',
  '후킹(첫 3초 · 1~2개): 상식 파괴 / 숫자·구체 / 자존심 긁기 / 금지·위협 / 권위 / 마인드 리딩 / 숨기기·궁금증 / 대상 부르기 / 결과 먼저 / 뉴스·사실 / 질문 / 감정·감탄 / 인사·소개 / 없음',
  '첫마디: 공백 빼고 몇 자 · 몇 초에 끝나나 · 인사 · 자기소개로 시작하나 · 5초 안에 숫자(숫자 · 천만 · 3가지 같은 말 포함)가 나오나',
  '표본: 넓음 / 보통 / 좁음(전문 용어 · 좁은 대상 · 따라 하기 어려운 문턱이면 좁음) · 넓히기: 생존(돈 · 건강 손해 · 이득) / 트렌드(요즘 낱말) / 나도 할 수 있다(쉬움 · 무료 · N분) / 없음',
  '목적: 노출형(넓게 모으기) / 전환형(살 사람만) · 반박 제거: 보는 사람의 의심을 근거로 먼저 지웠나',
  '숏폼 끝: 팔로우 / 댓글 키워드 / 프로필 링크 / 저장 · 공유 권유 / 다음 편 예고 / 상담 · DM / 질문 던지기 / 없음',
  '숏폼 캡션: 해시태그만 / 한 줄 + 해시태그 / 가치 입증 첫 줄 / 요약 정리 / 권유 포함 / 긴 정보 / 질문 · 구성: 대상 질문 · 오해 풀기 · 요약 · 스토리 · 전문성 · 링크 안내 · DM 안내 · 댓글 키워드 · 업체 정보 · 3가지 구조인가 · 말로 저장 유도하나',
  '롱폼 제목 공식(1~3개): 숫자 / 금액·결과 / 대상 부르기 / 질문 / 금지·경고 / 속보·뉴스 / 비밀·숨김 / 비교 / 권위 / 감정·감탄 / 총정리·방법 / 괄호 꼬리말 · 제목 뼈대는 [대괄호] 틀로',
  '롱폼 오프닝(첫 60~75초): 주제를 몇 초에 말하나 · 결론을 75초 안에 말하나 · 이득 약속("끝까지 보시면 · 오늘 N가지")이 있나 · 자기소개는 몇 초에 · 뼈대 예: [손해 숫자] → [대상] → [오늘 3가지] → [자기소개]',
  '롱폼 챕터: 없음 / 번호형 / 질문형 / 명사형 / 문장형 · 끝: 구독·좋아요 / 상담·문의 / 설명란·링크 / 다음 영상 / 댓글 요청 / 요약 다시 짚기 / 숙제(적어 보기) / 없음 · 설명란: 요약 / 챕터 / 링크·상담 / 업체 정보 / 해시태그 / 출처 / 고지',
  '왜: 잘 된 것은 무엇이 높은지(공유 · 저장 · 댓글 ÷ 조회, 조회 ÷ 구독자 · 팔로워)로, 안 된 것은 무엇이 빠졌는지로 한 문장. 스레드 틀(A~X) 가운데 가장 가까운 것도 붙인다.',
  '우리 버전: 이 틀로 김팀장이 만들면 어떻게 되나 한 줄 — 지어낸 사실 · 숫자 없이, 승인 보장 없이, AX 를 자금 받는 수단으로 쓰지 않고.',
  '원문은 옮기지 않는다 — 뼈대([대괄호] 틀)와 내 말로만. 낱말 그대로가 핵심일 때만 8자 이하 인용.',
].join('\n')

const PACKS = {
  /** 네 플랫폼 공통 — 법칙 10가지 · 플랫폼별 길이 · 형식 표 · 우리 분야 경고 · 예전 공식에서 바꾼 것 */
  mk_common: [['네 플랫폼 공통 법칙', between(sns, '0-2. 네 플랫폼에서 똑같이 나온 법칙 10가지', '0-3. 김팀장이 바로 쓸 것', 'mk_common')]],
  /** 스레드 — Meta 가 보는 것 · 반응별 틀 · 틀 A~H · 쓰는 순서 · AI 에 붙일 틀 + 틀 라이브러리(23가지 · 카드 · 첫 줄 · 끝 · 4주 운영) */
  mk_threads: [
    ['스레드 공식', between(sns, '0. 결론', '5. 김팀장 계정 진단 (실측)', 'mk_threads/formula', 0)],
    ['스레드 AI 틀', between(sns, '9. AI에게 스레드 글을 시킬 때 붙일 틀', '부록. 근거와 한계', 'mk_threads/ai')],
    ['스레드 틀 라이브러리', between(sns, '0. 결론', '7. 데이터는 이렇게 쌓입니다', 'mk_threads/library', 1)],
  ],
  /** 틱톡 · 쇼츠 · 릴스 — 결론 · 업그레이드 공식 · 댓글형 조건 · 세 채널 공통 법칙 · 대본 예시 */
  mk_short: [
    ['숏폼 결론', between(sns, '0. 결론', '1. 숫자로 본 승·패', 'mk_short/conclusion', 2)],
    ['숏폼 공식', between(sns, '3. 업그레이드된 숏폼 공식 (김팀장용)', '6. 규칙집에 반영한 것', 'mk_short/formula')],
  ],
  /** 유튜브 롱폼 — 결론 · 작은 채널 공통점 · 업그레이드 공식 · 기획 예시 */
  mk_long: [
    ['롱폼 결론', between(long, '0. 결론', '1. 숫자로 본 승·패', 'mk_long/conclusion')],
    ['작은 채널에서 터진 영상 공통점', between(long, '14개에서 공통으로 보인 것', '3. 기존 공식 판정표', 'mk_long/small')],
    ['롱폼 공식 · 기획 예시', between(long, '4. 업그레이드된 롱폼 공식 (김팀장용)', '6. 규칙집에 반영한 것', 'mk_long/formula')],
  ],
  /** 김팀장 사실 목록 · 넣지 말 것 — 모든 마케팅 글이 이 사실만 쓴다 */
  mk_facts: [['사실 목록 · 넣지 말 것', between(sns, '5. 김팀장 사실 목록 (이것만 씀)', '7. 리포트 형식', 'mk_facts')]],
  /** D-274 대표 운영 원칙(보충본 1부) — AX · 자금 · 벤처 문구 · 사업 기준 · 예시는 완성본으로 · 롱폼 마무리 V1.8 */
  ...(principles ? { mk_principles: [['대표 운영 원칙', principles]] } : {}),
  /** D-274 벤치마킹 판정 기준(보충본 부록 B 를 우리 말로) */
  mk_judge: [['벤치마킹 판정 기준', JUDGE]],
}

const out = {}
const meta = {}
for (const [key, parts] of Object.entries(PACKS)) {
  out[key] = sanitizeKnowledge(scrub(parts.map(([, body]) => body).join('\n\n')))
  meta[key] = { parts: parts.map(([t]) => t), chars: out[key].length }
}

const header = `/**
 * D-273 · D-274 마케팅 기준 묶음 — 대표가 전달한 docx(SNS 공식 통합본 · 유튜브 롱폼 공식 · 보충본 1부 운영 원칙)에서 채널마다 필요한 장만 뽑은 것
 * (scripts/build-mk-knowledge.mjs 가 만든다 · 손으로 고치지 않는다). 서버 함수(api/)에서만 쓴다 — 브라우저 번들에 들어가지 않는다.
 * 원본 docx 는 저장소에 넣지 않는다. 남의 계정 이름 · 참고한 외부 방법 이름 · 파일 경로는 뺀 채로 둔다.
 */

`
const body = `export const MK_KNOWLEDGE_META = ${JSON.stringify(meta, null, 2)}\n\nexport const MK_KNOWLEDGE = ${JSON.stringify(out, null, 2)}\n`
writeFileSync(new URL('../api/_ai/mkKnowledge.js', import.meta.url), header + body)
for (const [k, m] of Object.entries(meta)) console.log(`${k}: ${m.chars.toLocaleString()}자 · ${m.parts.join(' + ')}`)
