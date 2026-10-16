/**
 * 블록 15종 (D-202 · D-207) — 블록마다 어떤 칸이 있는가.
 * D-207(식스샵 회사 템플릿에서 얻은 생각): 블록마다 '바탕' 고르기 · 첫 화면 '사진 가득' · 사진 모음 · 고객 후기 · 거래처 로고 ·
 *        연락처에 카카오톡 · 상담 신청서 · 휴대폰 아래 고정 단추. 새 칸은 늘 맨 뒤에 붙인다(저장본 읽기 순서 그대로).
 *
 * 편집 화면은 이 표만 보고 칸을 그리고, HTML 그리기(render.ts)는 같은 칸 이름을 읽는다.
 * 새 블록이 필요하면 여기 한 줄 + render 한 함수.
 */
import type { BlockDef, BlockType, FieldDef } from './types'

const TITLE: FieldDef = { key: 'title', label: '제목', kind: 'text', max: 60 }
const INTRO: FieldDef = { key: 'intro', label: '짧은 소개(없어도 됨)', kind: 'textarea', max: 300 }
/** 구역 바탕 — '자동' 은 흰 바탕 · 옅은 바탕을 번갈아(D-202 그대로) */
export const BG_OPTIONS = [
  { value: 'auto', label: '자동(흰 바탕 · 옅은 바탕 번갈아)' },
  { value: 'white', label: '흰색' },
  { value: 'gray', label: '옅은 회색' },
  { value: 'tint', label: '옅은 색(꾸밈 색)' },
  { value: 'brand', label: '꾸밈 색으로 꽉 채우기' },
  { value: 'dark', label: '어둡게' },
]
const BG: FieldDef = { key: 'bg', label: '바탕', kind: 'select', options: BG_OPTIONS, hint: '진한 바탕(꾸밈 색 · 어둡게)은 한 페이지에 한두 곳이 보기 좋아요' }

export const BLOCK_DEFS: BlockDef[] = [
  {
    type: 'header',
    label: '맨 위 줄(로고 · 메뉴)',
    desc: '회사 이름 · 메뉴 · 문의 단추',
    anchor: 'top',
    single: true,
    fields: [
      { key: 'logoText', label: '로고 글자(회사 이름)', kind: 'text', max: 40 },
      { key: 'logoImage', label: '로고 그림(없으면 글자)', kind: 'image', hint: '가로로 긴 로고가 잘 어울려요' },
      { key: 'showMenu', label: '메뉴 보이기(블록 이름으로 자동)', kind: 'toggle' },
      { key: 'ctaLabel', label: '오른쪽 단추 글자(비우면 안 보임)', kind: 'text', max: 16 },
    ],
  },
  {
    type: 'hero',
    label: '첫 화면(큰 문구)',
    desc: '들어오자마자 보이는 큰 문구와 단추',
    anchor: 'home',
    fields: [
      {
        key: 'layout',
        label: '모양',
        kind: 'select',
        options: [
          { value: 'split', label: '글 + 그림 나란히(밝은 바탕)' },
          { value: 'band', label: '색 바탕에 글만' },
          { value: 'photo', label: '사진 가득(사진 위에 글)' },
        ],
      },
      { key: 'eyebrow', label: '작은 윗글(회사 이름 · 분야)', kind: 'text', max: 40 },
      { key: 'title', label: '큰 문구', kind: 'textarea', max: 80, hint: '줄을 바꾸면 화면에서도 줄이 바뀝니다' },
      { key: 'subtitle', label: '설명 한두 줄', kind: 'textarea', max: 200 },
      { key: 'buttonLabel', label: '단추 글자(비우면 안 보임)', kind: 'text', max: 20 },
      {
        key: 'buttonTarget',
        label: '단추를 누르면',
        kind: 'select',
        options: [
          { value: 'contact', label: '연락처로 내려가기' },
          { value: 'phone', label: '바로 전화 걸기' },
          { value: 'services', label: '사업 · 서비스로 내려가기' },
          { value: 'url', label: '다른 주소로 가기' },
        ],
      },
      { key: 'buttonUrl', label: '갈 주소(https://…)', kind: 'text', max: 300, showWhen: { key: 'buttonTarget', value: 'url' } },
      { key: 'image', label: '사진(없으면 업종 그림)', kind: 'image', hint: '나란히 모양은 오른쪽에, 색 바탕 · 사진 가득 모양은 뒤에 깔려요. 가로로 긴 사진(가로 1,600px 넘게)이 좋아요' },
      {
        key: 'align',
        label: '글 맞춤',
        kind: 'select',
        options: [
          { value: 'left', label: '왼쪽' },
          { value: 'center', label: '가운데' },
        ],
        showWhen: { key: 'layout', value: 'band' },
      },
      { key: 'showFacts', label: '회사 정보 칩 보이기(설립 · 소재지 · 직원 — 회사 소개 블록에서)', kind: 'toggle' },
    ],
  },
  {
    type: 'about',
    label: '회사 소개',
    desc: '어떤 회사인지 · 설립 · 대표 · 업종 · 소재지',
    menu: '회사 소개',
    anchor: 'about',
    fields: [
      TITLE,
      { key: 'body', label: '소개 글', kind: 'textarea', max: 1200 },
      { key: 'image', label: '사진(없어도 됨)', kind: 'image' },
      {
        key: 'facts',
        label: '한눈에 보는 정보',
        kind: 'list',
        maxItems: 8,
        itemFields: [
          { key: 'label', label: '항목', kind: 'text', max: 16 },
          { key: 'value', label: '내용', kind: 'text', max: 60 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'services',
    label: '사업 · 서비스',
    desc: '하는 일 · 제품 · 메뉴를 카드로',
    menu: '사업 소개',
    anchor: 'services',
    fields: [
      {
        key: 'layout',
        label: '모양',
        kind: 'select',
        options: [
          { value: 'icons', label: '아이콘 카드' },
          { value: 'rows', label: '번호 줄' },
          { value: 'plain', label: '글 카드' },
        ],
      },
      TITLE,
      INTRO,
      {
        key: 'items',
        label: '카드',
        kind: 'list',
        maxItems: 9,
        itemFields: [
          { key: 'name', label: '이름', kind: 'text', max: 40 },
          { key: 'desc', label: '설명', kind: 'textarea', max: 240 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'numbers',
    label: '숫자로 보기',
    desc: '업력 · 직원 · 인증 같은 숫자를 크게',
    anchor: 'numbers',
    fields: [
      {
        key: 'layout',
        label: '모양',
        kind: 'select',
        options: [
          { value: 'band', label: '색 띠' },
          { value: 'plain', label: '흰 바탕' },
        ],
      },
      TITLE,
      {
        key: 'items',
        label: '숫자',
        kind: 'list',
        maxItems: 4,
        itemFields: [
          { key: 'value', label: '숫자(예: 12년)', kind: 'text', max: 16 },
          { key: 'label', label: '설명', kind: 'text', max: 24 },
        ],
      },
    ],
  },
  {
    type: 'certs',
    label: '인증 · 특허',
    desc: '보유 인증 · 특허 · 연구소',
    menu: '인증',
    anchor: 'certs',
    fields: [
      TITLE,
      INTRO,
      {
        key: 'items',
        label: '인증',
        kind: 'list',
        maxItems: 12,
        itemFields: [
          { key: 'name', label: '이름', kind: 'text', max: 40 },
          { key: 'detail', label: '설명(번호 · 날짜 · 기관, 없어도 됨)', kind: 'text', max: 60 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'history',
    label: '연혁',
    desc: '연도별로 걸어온 길',
    menu: '연혁',
    anchor: 'history',
    fields: [
      TITLE,
      {
        key: 'items',
        label: '연혁',
        kind: 'list',
        maxItems: 20,
        itemFields: [
          { key: 'year', label: '연도', kind: 'text', max: 10 },
          { key: 'text', label: '내용', kind: 'text', max: 80 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'process',
    label: '진행 순서',
    desc: '문의부터 마무리까지 단계',
    anchor: 'process',
    fields: [
      TITLE,
      INTRO,
      {
        key: 'items',
        label: '단계',
        kind: 'list',
        maxItems: 6,
        itemFields: [
          { key: 'name', label: '단계 이름', kind: 'text', max: 30 },
          { key: 'desc', label: '설명', kind: 'text', max: 100 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'faq',
    label: '자주 묻는 질문',
    desc: '질문과 답',
    menu: '자주 묻는 질문',
    anchor: 'faq',
    fields: [
      TITLE,
      {
        key: 'items',
        label: '질문',
        kind: 'list',
        maxItems: 10,
        itemFields: [
          { key: 'q', label: '질문', kind: 'text', max: 80 },
          { key: 'a', label: '답', kind: 'textarea', max: 400 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'gallery',
    label: '사진 모음(사례 · 시공 · 메뉴)',
    desc: '사진 여러 장을 격자로 · 사진과 글을 번갈아',
    menu: '사례',
    anchor: 'works',
    fields: [
      {
        key: 'layout',
        label: '모양',
        kind: 'select',
        options: [
          { value: 'grid', label: '격자(사진 아래 글)' },
          { value: 'zigzag', label: '사진 · 글 번갈아(큰 사진)' },
        ],
      },
      TITLE,
      INTRO,
      {
        key: 'ratio',
        label: '사진 비율',
        kind: 'select',
        options: [
          { value: '4:3', label: '가로 4:3' },
          { value: '3:2', label: '가로 3:2' },
          { value: '16:9', label: '가로 16:9(넓게)' },
          { value: '1:1', label: '정사각 1:1' },
          { value: '3:4', label: '세로 3:4' },
        ],
      },
      {
        key: 'items',
        label: '사진',
        kind: 'list',
        maxItems: 9,
        itemFields: [
          { key: 'image', label: '사진', kind: 'image' },
          { key: 'title', label: '제목(예: 동탄 아파트 욕실)', kind: 'text', max: 40 },
          { key: 'desc', label: '설명(없어도 됨)', kind: 'textarea', max: 200 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'reviews',
    label: '고객 후기',
    desc: '실제 고객이 남긴 글을 카드로',
    menu: '후기',
    anchor: 'reviews',
    fields: [
      TITLE,
      INTRO,
      {
        key: 'items',
        label: '후기',
        kind: 'list',
        maxItems: 6,
        itemFields: [
          { key: 'text', label: '후기 글(받은 그대로)', kind: 'textarea', max: 300 },
          { key: 'name', label: '이름(예: 김○○ 님)', kind: 'text', max: 30 },
          { key: 'meta', label: '어디서 받은 후기 · 무엇을 이용(예: 네이버 리뷰 · 욕실 리모델링)', kind: 'text', max: 40 },
        ],
      },
      BG,
    ],
  },
  {
    type: 'logos',
    label: '거래처 · 협력사',
    desc: '함께 일한 회사 이름 · 로고',
    anchor: 'clients',
    fields: [
      TITLE,
      INTRO,
      { key: 'gray', label: '로고를 흑백으로(여러 색이 섞여도 차분하게)', kind: 'toggle' },
      {
        key: 'items',
        label: '회사',
        kind: 'list',
        maxItems: 18,
        itemFields: [
          { key: 'name', label: '회사 이름', kind: 'text', max: 40 },
          { key: 'image', label: '로고(없으면 이름 글자)', kind: 'image' },
        ],
      },
      BG,
    ],
  },
  {
    type: 'cta',
    label: '문의 띠',
    desc: '색 띠 위에 문의 문구와 단추',
    anchor: 'ask',
    fields: [
      TITLE,
      { key: 'body', label: '설명', kind: 'textarea', max: 200 },
      { key: 'buttonLabel', label: '단추 글자', kind: 'text', max: 20 },
      { key: 'showPhone', label: '전화번호도 크게 보이기', kind: 'toggle' },
    ],
  },
  {
    type: 'contact',
    label: '연락처 · 오시는 길',
    desc: '주소 · 전화 · 메일 · 운영 시간 · 지도',
    menu: '오시는 길',
    anchor: 'contact',
    fields: [
      TITLE,
      { key: 'address', label: '주소', kind: 'text', max: 120 },
      { key: 'phone', label: '전화', kind: 'text', max: 30 },
      { key: 'email', label: '메일', kind: 'text', max: 80 },
      { key: 'hours', label: '운영 시간', kind: 'textarea', max: 120 },
      { key: 'showMapLink', label: '네이버 지도 바로가기 단추', kind: 'toggle' },
      { key: 'kakaoUrl', label: '카카오톡 채널 주소(없어도 됨)', kind: 'text', max: 200, placeholder: 'https://pf.kakao.com/…', hint: '카카오톡 채널 관리자 화면의 채널 주소를 붙여 넣으면 [카카오톡 상담] 단추가 생겨요' },
      { key: 'formUrl', label: '상담 신청서 주소(없어도 됨)', kind: 'text', max: 300, placeholder: 'https://form.naver.com/…', hint: '네이버폼 · 구글폼 주소를 붙여 넣으면 [상담 신청하기] 단추가 생겨요' },
      { key: 'floatBar', label: '휴대폰 화면 아래에 전화 · 상담 단추 늘 보이기', kind: 'toggle' },
      BG,
    ],
  },
  {
    type: 'footer',
    label: '맨 아래 줄(사업자 정보)',
    desc: '상호 · 대표 · 사업자등록번호 · 주소 · 연락처',
    anchor: 'footer',
    single: true,
    fields: [
      { key: 'companyName', label: '상호', kind: 'text', max: 60 },
      { key: 'representative', label: '대표', kind: 'text', max: 30 },
      { key: 'businessNumber', label: '사업자등록번호', kind: 'text', max: 20 },
      { key: 'showBusinessNumber', label: '사업자등록번호 보이기', kind: 'toggle' },
      { key: 'address', label: '주소', kind: 'text', max: 120 },
      { key: 'phone', label: '전화', kind: 'text', max: 30 },
      { key: 'email', label: '메일', kind: 'text', max: 80 },
      { key: 'extra', label: '더 적을 것(통신판매업 신고번호 등)', kind: 'text', max: 120 },
    ],
  },
]

export function blockDef(type: string): BlockDef | undefined {
  return BLOCK_DEFS.find((d) => d.type === type)
}

export const BLOCK_TYPES: BlockType[] = BLOCK_DEFS.map((d) => d.type)

/** 블록 이름 — 목록 · 점검 문구에 */
export function blockLabel(type: string): string {
  return blockDef(type)?.label ?? type
}
