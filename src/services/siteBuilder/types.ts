/**
 * 홈페이지 만들기 (D-202) — 블록으로 쌓는 한 장짜리 업체 홈페이지.
 *
 * 식스샵 프로를 분해해(REA · 공개 문서) 얻은 생각만 가져왔다 — 코드 · 견본 · 문구 · 디자인은 가져오지 않는다.
 *   - 페이지 = 블록을 위에서 아래로 쌓은 것. 블록마다 '칸'(제목 · 글 · 사진 · 목록)이 있고, 칸 모양은 블록 정의가 정한다.
 *   - 꾸밈(색 묶음 · 글꼴 · 모서리)은 사이트 하나에 하나 — 모든 블록이 같은 꾸밈을 쓴다.
 *   - 블록마다 PC · 휴대폰에서 숨길 수 있다.
 * 다른 점: 업체 기록(회사명 · 대표 · 사업자번호 · 주소 · 전화 · 설립일 · 인증)으로 처음부터 채운다. 만든 페이지는
 * 스크립트가 하나도 없는 HTML 한 장 — 미리보기와 내려받기가 같은 글을 쓴다(보이는 그대로 나간다).
 * 규칙으로 채운다 — 'AI' 가 아니다. LLM 을 부르지 않는다.
 */

export type BlockType =
  | 'header'
  | 'hero'
  | 'about'
  | 'services'
  | 'numbers'
  | 'certs'
  | 'history'
  | 'process'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'footer'
  | 'gallery'
  | 'reviews'
  | 'logos'

/** 목록 칸의 한 줄 (예: 서비스 이름 · 설명) */
export type ListItem = Record<string, string>

/** 칸 값 — 글 · 켜고 끄기 · 목록 */
export type PropValue = string | boolean | ListItem[]

export interface SiteBlock {
  id: string
  type: BlockType
  props: Record<string, PropValue>
  /** PC(넓은 화면)에서 숨김 */
  hidePc?: boolean
  /** 휴대폰에서 숨김 */
  hideMobile?: boolean
  /** 아직 견본 문구 그대로인 칸 — 고치면 빠진다(내보내기 전 점검이 '업체와 확인' 으로 알린다) */
  sample?: string[]
}

export type PaletteKey = 'navy' | 'forest' | 'ocean' | 'wine' | 'sunset' | 'charcoal' | 'violet'
export type FontKey = 'sans' | 'serif'
export type CornerKey = 'square' | 'round' | 'pill'

export interface SiteTheme {
  palette: PaletteKey
  font: FontKey
  corner: CornerKey
}

export type IndustryKey =
  | 'manufacturing'
  | 'it'
  | 'trade'
  | 'food'
  | 'health'
  | 'professional'
  | 'education'
  | 'construction'
  | 'design'
  /** D-220: 개인 컨설턴트 · 전문가(동료 컨설턴트 홍보) */
  | 'consultant'
  | 'general'

export interface SiteSeo {
  /** 브라우저 탭 · 검색 결과 제목 */
  title: string
  /** 검색 결과 설명 */
  description: string
}

export interface SiteDoc {
  v: 1
  industry: IndustryKey
  theme: SiteTheme
  seo: SiteSeo
  blocks: SiteBlock[]
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 칸 정의 — 편집 화면은 이것만 보고 칸을 그린다                           */
/* ------------------------------------------------------------------ */

export type FieldKind = 'text' | 'textarea' | 'select' | 'toggle' | 'list' | 'image'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
  hint?: string
  /** 글자 수 상한 */
  max?: number
  options?: FieldOption[]
  /** 목록 한 줄의 칸들 (kind: 'list') */
  itemFields?: FieldDef[]
  maxItems?: number
  /** 다른 칸이 이 값일 때만 보인다 (예: 단추가 '주소로 이동' 일 때만 주소 칸) */
  showWhen?: { key: string; value: string }
}

export interface BlockDef {
  type: BlockType
  label: string
  /** 블록 고르기에서 보일 한 줄 */
  desc: string
  /** 맨 위 메뉴에 올릴 이름(없으면 메뉴에 안 올림) · 주소 표시(#about) */
  menu?: string
  anchor: string
  /** 페이지에 하나만 (머리 · 바닥) */
  single?: boolean
  fields: FieldDef[]
}
