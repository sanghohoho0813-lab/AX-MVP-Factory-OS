/**
 * 블록 12종 (D-202) — 블록마다 어떤 칸이 있는가.
 *
 * 편집 화면은 이 표만 보고 칸을 그리고, HTML 그리기(render.ts)는 같은 칸 이름을 읽는다.
 * 새 블록이 필요하면 여기 한 줄 + render 한 함수.
 */
import type { BlockDef, BlockType, FieldDef } from './types'

const TITLE: FieldDef = { key: 'title', label: '제목', kind: 'text', max: 60 }
const INTRO: FieldDef = { key: 'intro', label: '짧은 소개(없어도 됨)', kind: 'textarea', max: 300 }

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
      { key: 'image', label: '배경 사진(없으면 색)', kind: 'image' },
      {
        key: 'align',
        label: '글 맞춤',
        kind: 'select',
        options: [
          { value: 'left', label: '왼쪽' },
          { value: 'center', label: '가운데' },
        ],
      },
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
    ],
  },
  {
    type: 'services',
    label: '사업 · 서비스',
    desc: '하는 일 · 제품 · 메뉴를 카드로',
    menu: '사업 소개',
    anchor: 'services',
    fields: [
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
    ],
  },
  {
    type: 'numbers',
    label: '숫자로 보기',
    desc: '업력 · 직원 · 인증 같은 숫자를 크게',
    anchor: 'numbers',
    fields: [
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
