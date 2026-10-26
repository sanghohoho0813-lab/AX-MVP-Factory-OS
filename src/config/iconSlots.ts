/**
 * D-283 아이콘 자리 표 — 메뉴 · 바로가기 · 화면 제목 · 휴대폰 아래 메뉴 · 모듈 전체의 기능 아이콘을 **한 곳에서** 바꾼다.
 *
 * 대표(2026-10-24): "아이콘이 필요하면 일단 그 자리엔 임시로 아이콘 둬 줘. 나중에 새로 만든 거 줄게."
 * D-284(2026-10-25): 대표가 만든 아이콘 21개(입체 미니어처 · 여러 색)가 들어왔다 — 자리마다 sprite 번호.
 *  - 21개를 **한 장 그림**(assets/icons/feature-icons.webp · 128px 칸 21개를 가로로)으로 묶어 칸마다 잘라 쓴다.
 *    화면을 열 때 그림 요청은 1번(아이콘마다 파일이면 21번). 원본(장당 1MB 남짓)은 투명 여백을 자르고 정사각형으로 맞춰 줄였다.
 *  - 여러 색 그림이라 기능 색으로 칠하지 않는다 — '어디인가' 색은 아이콘 칸 바탕(옅은 기능 색)이 그대로 맡는다.
 *  - 화면 코드는 고치지 않는다 — 메뉴 표(moduleRegistry MODULES) · 제품 카탈로그 분야 · 아래 메뉴가 slotIcon() 을 거친다.
 *  - 한 장에 없는 새 아이콘은 파일을 src/assets/icons/ 에 넣고 그 자리 줄의 custom 에(한 색이면 tint: true — 기능 색을 입힘).
 *  - 새 화면에 기능 아이콘이 필요하면 임시 아이콘을 두고 여기 한 줄을 더한다(docs/ICON_SLOTS.md).
 */
import { createElement, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import featureSprite from '../assets/icons/feature-icons.webp'
import marketingSprite from '../assets/icons/marketing-icons.webp'

/** 대표 아이콘 한 장 — 칸 21개를 가로로 */
export const ICON_SPRITE = { src: featureSprite, count: 21 }
/**
 * D-295 마케팅 · 브랜딩 목차 · AI 전략실 요약 칸 한 장 — 칸 13개를 가로로(62KB).
 *  0 이번 주 찍을 것(YouTube 실제 로고) · 1 인기 · 급상승 · 2 채널 · 3 분석 · 4 내 콘텐츠 ·
 *  5 스레드(Threads 실제 로고) · 6 릴스 · 틱톡(실제 로고 둘) · 7 블로그 · 플레이스(블로그 실제 로고) · 8 홈페이지 만들기 ·
 *  9 검토 중인 업체 · 10 고객 관리와 이어짐 · 11 기억이 쌓인 곳 · 12 이번 주 작업
 * 대표: "이번 주 찍을 것 · 스레드 · 릴스틱톡 · 블로그 플레이스 홍보 글은 GPT 아이콘 말고 실제 브랜드 로고로 · 나머지는 GPT 가 만든 것 그대로".
 */
export const MK_SPRITE = { src: marketingSprite, count: 13 }

export interface IconSlot {
  /** moduleRegistry MODULES 의 key(분야 줄은 cat-*) · 휴대폰 아래 메뉴 '더보기' 는 'more' */
  key: string
  /** 대표가 부르는 이름 */
  name: string
  /** 어디에 보이는지 */
  where: string
  /** 대표 아이콘 한 장에서 몇 번째 칸인지(0부터 — 받은 파일 번호 - 1) */
  sprite?: number
  /** D-295 어느 한 장인지 — 없으면 기능 아이콘(feature) · 'mk' 는 마케팅 · AI 전략실 한 장 */
  sheet?: 'mk'
  /** 따로 받은 아이콘 파일 주소(import 한 값) */
  custom?: string
  /** custom 이 한 색 아이콘이면 true(기능 색을 입힘 · 기본) · 여러 색 그림이면 false */
  tint?: boolean
}

export const ICON_SLOTS: IconSlot[] = [
  { key: 'today', name: '오늘', where: '메뉴 · 휴대폰 아래 메뉴', sprite: 0 },
  { key: 'decide', name: '확인할 것', where: '메뉴', sprite: 1 },
  { key: 'calendar', name: '일정', where: '메뉴 · 휴대폰 아래 메뉴 · 바로가기 · 화면 제목', sprite: 2 },
  { key: 'client-ops', name: '고객 관리', where: '메뉴 · 휴대폰 아래 메뉴 · 바로가기 · 화면 제목', sprite: 3 },
  { key: 'ai-workspace', name: 'AI 전략실', where: '메뉴 · 바로가기 · 화면 제목(대표만)', sprite: 4 },
  { key: 'patent-venture', name: '특허 · 벤처', where: '메뉴 · 바로가기 · 화면 제목(대표만)', sprite: 5 },
  { key: 'inbox', name: '잠재고객 상담신청', where: '메뉴 · 휴대폰 아래 메뉴(대표만)', sprite: 6 },
  { key: 'sales', name: '영업 관리', where: '메뉴 · 휴대폰 아래 메뉴 · 바로가기', sprite: 7 },
  { key: 'agents', name: '영업자 정산', where: '메뉴(대표만)', sprite: 8 },
  { key: 'money', name: '매출 · 비용', where: '메뉴 · 바로가기(팀장)', sprite: 9 },
  { key: 'marketing', name: '마케팅 · 브랜딩', where: '메뉴 · 바로가기 · 화면 제목(대표만)', sprite: 10 },
  { key: 'first-meeting', name: '1차 미팅 체크리스트', where: '메뉴(대표만 · 준비 중)', sprite: 11 },
  { key: 'cat-growth', name: '기업성장(자금 · 지원사업)', where: '메뉴 · 바로가기 · 모듈 전체', sprite: 12 },
  { key: 'cat-gov-support', name: '정부지원사업', where: '모듈 전체', sprite: 13 },
  { key: 'cat-tax-finance', name: '절세 · 재무', where: '메뉴 · 바로가기(팀장) · 모듈 전체', sprite: 14 },
  { key: 'cat-tech-biz', name: '기술사업화', where: '메뉴(잘 안 쓰는 기능) · 모듈 전체', sprite: 15 },
  { key: 'cat-ax-studio', name: 'AX 스튜디오', where: '메뉴(잘 안 쓰는 기능) · 모듈 전체', sprite: 16 },
  { key: 'cat-web-studio', name: '웹 스튜디오', where: '메뉴(잘 안 쓰는 기능) · 모듈 전체', sprite: 17 },
  { key: 'tools', name: '전체 도구(모듈 전체)', where: '메뉴 · 바로가기 맨 끝', sprite: 18 },
  { key: 'more', name: '더보기', where: '휴대폰 아래 메뉴', sprite: 19 },
  { key: 'settings', name: '설정', where: '메뉴', sprite: 20 },
  // D-295 마케팅 · 브랜딩 목차(위: 콘텐츠 레이더 · 아래: 만들기)
  { key: 'mk-plan', name: '이번 주 찍을 것', where: '마케팅 목차 — YouTube 로고', sheet: 'mk', sprite: 0 },
  { key: 'mk-top', name: '인기 · 급상승', where: '마케팅 목차', sheet: 'mk', sprite: 1 },
  { key: 'mk-channels', name: '채널', where: '마케팅 목차', sheet: 'mk', sprite: 2 },
  { key: 'mk-analysis', name: '분석', where: '마케팅 목차', sheet: 'mk', sprite: 3 },
  { key: 'mk-make', name: '내 콘텐츠', where: '마케팅 목차', sheet: 'mk', sprite: 4 },
  { key: 'mk-threads', name: '스레드', where: '마케팅 만들기 — Threads 로고', sheet: 'mk', sprite: 5 },
  { key: 'mk-shorts', name: '릴스 · 틱톡', where: '마케팅 만들기 — Reels · TikTok 로고', sheet: 'mk', sprite: 6 },
  { key: 'mk-content', name: '블로그 · 플레이스 홍보 글', where: '마케팅 만들기 — 블로그 로고', sheet: 'mk', sprite: 7 },
  { key: 'mk-homepage', name: '홈페이지 만들기', where: '마케팅 만들기', sheet: 'mk', sprite: 8 },
  // D-295 AI 전략실 첫 화면 요약 칸
  { key: 'ai-reviewing', name: '검토 중인 업체', where: 'AI 전략실 요약 칸', sheet: 'mk', sprite: 9 },
  { key: 'ai-linked', name: '고객 관리와 이어짐', where: 'AI 전략실 요약 칸', sheet: 'mk', sprite: 10 },
  { key: 'ai-memory', name: '기억이 쌓인 곳', where: 'AI 전략실 요약 칸', sheet: 'mk', sprite: 11 },
  { key: 'ai-week', name: '이번 주 작업', where: 'AI 전략실 요약 칸', sheet: 'mk', sprite: 12 },
]

const BY_KEY = new Map(ICON_SLOTS.map((s) => [s.key, s]))
const made = new Map<string, LucideIcon>()

/** 이 자리의 아이콘 — 대표 아이콘(sprite) · 따로 받은 파일(custom) · 없으면 임시 아이콘(fallback) 그대로 */
export function slotIcon(key: string, fallback: LucideIcon): LucideIcon {
  const slot = BY_KEY.get(key)
  if (!slot || (slot.sprite == null && !slot.custom)) return fallback
  let icon = made.get(key)
  if (!icon) {
    icon = slot.sprite != null ? spriteIcon(slot.sprite, key, slot.sheet === 'mk' ? MK_SPRITE : ICON_SPRITE) : customIcon(slot.custom!, slot.tint ?? true, key)
    made.set(key, icon)
  }
  return icon
}

/** 표(메뉴 줄 · 분야)의 icon 을 자리 표로 거른다 — keyOf 로 자리 key 를 정한다(분야는 cat-…) */
export function withSlotIcons<T extends { key: string; icon: LucideIcon }>(rows: T[], keyOf: (row: T) => string = (row) => row.key): T[] {
  return rows.map((row) => ({ ...row, icon: slotIcon(keyOf(row), row.icon) }))
}

type IconProps = { className?: string; style?: CSSProperties; size?: number | string }

/**
 * 대표 아이콘 한 칸 — 크기는 부르는 쪽 className(size-4 · size-[22px] …)을 그대로 따르고, 입체 그림은 선 아이콘보다 작게 읽혀
 * 같은 자리에서 1.5배로 그린다(--icon-art-scale — 칸 안에 들어오는 크기 · 자리를 차지하는 크기는 그대로라 옆 글자가 밀리지 않는다). 1 · 1.3 · 1.5 를 찍어 보고 1.5(아이콘 칸을 거의 채움)로 정함.
 */
export function spriteIcon(index: number, key: string, sheet: { src: string; count: number } = ICON_SPRITE): LucideIcon {
  const pos = sheet.count > 1 ? (index / (sheet.count - 1)) * 100 : 0
  function SlotIcon({ className = '', style, size }: IconProps) {
    const box: CSSProperties = size == null ? {} : { width: size, height: size }
    return createElement('span', {
      'aria-hidden': true,
      'data-icon-slot': key,
      'data-icon-art': 'sprite',
      className: `inline-block shrink-0 bg-no-repeat ${className}`,
      style: {
        ...box,
        backgroundImage: `url("${sheet.src}")`,
        backgroundSize: `${sheet.count * 100}% 100%`,
        backgroundPosition: `${pos}% 0`,
        transform: 'scale(var(--icon-art-scale, 1.5))',
        ...style,
      },
    })
  }
  SlotIcon.displayName = `SlotIcon(${key})`
  return SlotIcon as unknown as LucideIcon
}

/**
 * 따로 받은 파일 아이콘을 lucide 아이콘과 같은 자리에 꽂히게 — 크기는 부르는 쪽 className 을 그대로 따른다.
 * tint 면 글자색(currentColor)으로 칠한 모양(기능 색 · 지금 화면 흰색이 그대로 먹는다), 아니면 그림 그대로.
 */
export function customIcon(src: string, tint: boolean, key: string): LucideIcon {
  function SlotIcon({ className = '', style, size }: IconProps) {
    const box: CSSProperties = size == null ? {} : { width: size, height: size }
    if (!tint) return createElement('img', { src, alt: '', 'aria-hidden': true, draggable: false, 'data-icon-slot': key, className: `inline-block shrink-0 object-contain ${className}`, style: { ...box, ...style } })
    const mask = `url("${src}") center / contain no-repeat`
    return createElement('span', { 'aria-hidden': true, 'data-icon-slot': key, className: `inline-block shrink-0 bg-current ${className}`, style: { ...box, WebkitMask: mask, mask, ...style } })
  }
  SlotIcon.displayName = `SlotIcon(${key})`
  return SlotIcon as unknown as LucideIcon
}
