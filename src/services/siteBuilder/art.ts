/**
 * 홈페이지 그림 · 아이콘 (D-205) — 업종마다 첫 화면 그림 하나 · 사업 카드 아이콘.
 *
 * 모두 우리가 도형으로 새로 그린 SVG 다(남의 그림 · 아이콘 묶음을 옮기지 않았다).
 * 색은 class 로만 칠한다 — 페이지 CSS 가 꾸밈 색(var(--p) …)을 넣으므로 색 묶음을 바꾸면 그림 색도 따라 바뀐다.
 * 사람이 적은 글은 그림에 한 글자도 들어가지 않는다(업종 이름 · 순번으로만 고른다) — 그래서 내려받은 HTML 에 넣어도 안전하다.
 */
import type { IndustryKey } from './types'

const VB = 'viewBox="0 0 480 380"'

/** 모든 그림 뒤 공통 바탕 — 옅은 판 · 동그라미 · 점 */
const BACK = (() => {
  const dots: string[] = []
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) dots.push(`<circle class="o2" cx="${56 + x * 18}" cy="${312 + y * 18}" r="3"/>`)
  return `<rect class="o1" x="34" y="28" width="412" height="324" rx="40"/><circle class="o2" cx="410" cy="60" r="34"/>${dots.join('')}`
})()

const wrap = (inner: string) => `<svg class="art" ${VB} aria-hidden="true" focusable="false">${BACK}${inner}</svg>`

const SCENES: Record<IndustryKey, string> = {
  manufacturing: (() => {
    const win = [0, 1, 2].map((i) => `<rect class="f5" x="${108 + i * 44}" y="226" width="26" height="20" rx="3"/><rect class="f5" x="${108 + i * 44}" y="258" width="26" height="20" rx="3"/>`).join('')
    const teeth = [0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<rect class="f7" x="-9" y="-56" width="18" height="20" rx="3" transform="rotate(${r})"/>`).join('')
    return [
      '<rect class="f6" x="64" y="300" width="356" height="8" rx="4"/>',
      '<path class="f1" d="M90 300V190l50-30v30l50-30v30l50-30v140z"/>',
      win,
      '<rect class="f3" x="252" y="118" width="26" height="182" rx="3"/>',
      '<circle class="o2" cx="272" cy="98" r="14"/><circle class="o2" cx="294" cy="76" r="10"/><circle class="o2" cx="312" cy="58" r="7"/>',
      `<g transform="translate(366 196)">${teeth}<circle class="f7" r="40"/><circle class="f5" r="15"/></g>`,
      '<rect class="f2" x="302" y="262" width="38" height="38" rx="5"/><rect class="f5" x="316" y="262" width="10" height="38"/>',
      '<rect class="f3" x="348" y="272" width="30" height="28" rx="5"/>',
    ].join('')
  })(),
  design: [
    '<rect class="f6" x="64" y="300" width="356" height="8" rx="4"/>',
    '<rect class="f5 e" x="84" y="128" width="236" height="172" rx="10"/>',
    '<rect class="f1" x="96" y="98" width="212" height="58" rx="12"/>',
    '<rect class="f5" x="118" y="114" width="96" height="11" rx="5.5"/><rect class="f7" x="118" y="132" width="58" height="9" rx="4.5"/>',
    '<circle class="f7" cx="278" cy="127" r="17"/><circle class="f1" cx="278" cy="127" r="7"/>',
    [0, 1, 2, 3, 4].map((i) => `<rect class="${i % 2 ? 'f5' : 'f3'}" x="${84 + i * 47.2}" y="166" width="47.2" height="24"/>`).join(''),
    '<rect class="o2" x="104" y="210" width="104" height="70" rx="6"/>',
    '<rect class="f6" x="232" y="214" width="66" height="86" rx="6"/><circle class="f2" cx="286" cy="258" r="4"/>',
    '<path class="s1" d="M334 300C356 230 410 266 428 176"/>',
    '<path class="s3" d="M334 300l-28-30M428 176l26-30"/>',
    '<rect class="f5 e2" x="327" y="293" width="14" height="14" rx="3"/><rect class="f5 e2" x="421" y="169" width="14" height="14" rx="3"/>',
    '<circle class="f2" cx="306" cy="270" r="5"/><circle class="f2" cx="454" cy="146" r="5"/>',
    '<circle class="f1" cx="364" cy="108" r="20"/><circle class="f7" cx="398" cy="128" r="15"/><circle class="f3" cx="366" cy="150" r="12"/>',
  ].join(''),
  it: [
    '<rect class="f2" x="66" y="78" width="266" height="184" rx="14"/>',
    '<rect class="f5" x="80" y="92" width="238" height="142" rx="6"/>',
    [
      [98, 110, 60, 'f1'],
      [166, 110, 40, 'f7'],
      [98, 128, 104, 'o2'],
      [114, 146, 70, 'f3'],
      [192, 146, 54, 'o2'],
      [114, 164, 92, 'o2'],
      [98, 182, 46, 'f1'],
      [98, 200, 124, 'o2'],
    ]
      .map(([x, y, w, c]) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="9" rx="4.5"/>`)
      .join(''),
    '<rect class="f6" x="180" y="262" width="38" height="24"/><rect class="f6" x="146" y="284" width="106" height="10" rx="5"/>',
    '<rect class="f1" x="346" y="138" width="80" height="152" rx="14"/><rect class="f5" x="354" y="154" width="64" height="114" rx="6"/>',
    '<rect class="f7" x="364" y="230" width="10" height="28" rx="2"/><rect class="f3" x="380" y="212" width="10" height="46" rx="2"/><rect class="f1" x="396" y="194" width="10" height="64" rx="2"/>',
    '<path class="s1" d="M358 92l50-22 32 40"/>',
    '<circle class="f7" cx="358" cy="92" r="9"/><circle class="f1" cx="408" cy="70" r="9"/><circle class="f3" cx="440" cy="110" r="9"/>',
  ].join(''),
  trade: [
    '<path class="s1 dash" d="M70 328C190 296 300 344 444 308"/>',
    '<rect class="f7" x="86" y="204" width="92" height="92" rx="6"/><rect class="f5 op" x="125" y="204" width="14" height="92"/>',
    '<rect class="f3" x="184" y="234" width="70" height="62" rx="6"/><rect class="f5 op" x="213" y="234" width="12" height="62"/>',
    '<rect class="f1" x="116" y="132" width="72" height="72" rx="6"/><rect class="f5 op" x="146" y="132" width="12" height="72"/>',
    '<rect class="f1" x="266" y="184" width="122" height="80" rx="8"/>',
    '<path class="f2" d="M388 206h38l24 30v28h-62z"/><path class="f5" d="M398 214h24l16 20h-40z"/>',
    '<circle class="f2" cx="298" cy="270" r="17"/><circle class="f5" cx="298" cy="270" r="6"/><circle class="f2" cx="418" cy="270" r="17"/><circle class="f5" cx="418" cy="270" r="6"/>',
    '<path class="f7" d="M418 54c-18 0-30 13-30 29 0 22 30 47 30 47s30-25 30-47c0-16-12-29-30-29z"/><circle class="f5" cx="418" cy="84" r="10"/>',
  ].join(''),
  food: [
    '<rect class="f6" x="64" y="300" width="356" height="8" rx="4"/>',
    '<path class="s5" d="M160 176c-12-14 12-22 0-38M200 172c-12-14 12-22 0-38M240 176c-12-14 12-22 0-38"/>',
    '<circle class="f7" cx="168" cy="212" r="18"/><circle class="f3" cx="206" cy="204" r="16"/><circle class="f5 e" cx="240" cy="212" r="15"/>',
    '<path class="f1" d="M106 222h220a110 80 0 0 1-220 0z"/>',
    '<rect class="f3" x="100" y="214" width="232" height="15" rx="7.5"/>',
    '<path class="s3" d="M262 116l76 96M284 108l68 100"/>',
    '<path class="f5 e" d="M346 232h70v38a20 20 0 0 1-20 20h-30a20 20 0 0 1-20-20z"/>',
    '<path class="s1" d="M416 246h8a12 12 0 0 1 0 24h-8"/>',
    '<rect class="f2" x="352" y="238" width="58" height="8" rx="4"/>',
    '<rect class="f6" x="332" y="292" width="98" height="9" rx="4.5"/>',
    '<path class="f3" d="M410 118c-40 0-60 30-60 60 30 0 60-20 60-60z"/><path class="s2" d="M354 174c14-14 30-28 50-48"/>',
  ].join(''),
  health: [
    '<rect class="f5 e" x="78" y="108" width="254" height="176" rx="18"/>',
    '<rect class="o2" x="102" y="132" width="92" height="12" rx="6"/>',
    '<path class="s1" d="M100 206h48l16-38 22 76 18-50 12 12h96"/>',
    '<rect class="f6" x="102" y="250" width="144" height="10" rx="5"/>',
    '<circle class="f1" cx="372" cy="132" r="56"/><rect class="f5" x="361" y="100" width="22" height="64" rx="5"/><rect class="f5" x="340" y="121" width="64" height="22" rx="5"/>',
    '<path class="f7" d="M384 222c-22 26-34 44-34 60a34 34 0 0 0 68 0c0-16-12-34-34-60z"/>',
    '<path class="f3" d="M110 330c0-26 16-42 44-46 0 28-16 46-44 46z"/>',
  ].join(''),
  professional: [
    '<rect class="f6" x="122" y="70" width="182" height="232" rx="14"/>',
    '<rect class="f5 e" x="96" y="92" width="182" height="232" rx="14"/>',
    [0, 1, 2]
      .map(
        (i) =>
          `<circle class="f1" cx="128" cy="${142 + i * 54}" r="13"/><path class="s2 thin" d="M122 ${142 + i * 54}l4.5 4.5 8-9"/><rect class="o2" x="152" y="${134 + i * 54}" width="100" height="10" rx="5"/><rect class="f6" x="152" y="${150 + i * 54}" width="70" height="8" rx="4"/>`,
      )
      .join(''),
    '<rect class="f3" x="322" y="232" width="26" height="62" rx="4"/><rect class="f1" x="358" y="196" width="26" height="98" rx="4"/><rect class="f7" x="394" y="158" width="26" height="136" rx="4"/>',
    '<path class="s3" d="M316 190l42-44 26 18 46-52"/><path class="s3" d="M408 110h24v24"/>',
  ].join(''),
  education: [
    '<path class="f5 e" d="M86 154c42-16 84-16 124 8v142c-40-24-82-24-124-8z"/>',
    '<path class="f5 e" d="M334 154c-42-16-84-16-124 8v142c40-24 82-24 124-8z"/>',
    [0, 1, 2, 3].map((i) => `<rect class="o2" x="104" y="${182 + i * 22}" width="${i % 2 ? 70 : 88}" height="8" rx="4"/><rect class="o2" x="230" y="${182 + i * 22}" width="${i % 2 ? 62 : 84}" height="8" rx="4"/>`).join(''),
    '<rect class="f1" x="206" y="160" width="8" height="146" rx="4"/>',
    '<path class="f2" d="M318 102l74-32 74 32-74 32z"/><path class="f1" d="M350 116v30c0 14 84 14 84 0v-30l-42 18z"/>',
    '<path class="s4" d="M458 104v42"/><circle class="f7" cx="458" cy="152" r="7"/>',
    '<g transform="rotate(-34 396 266)"><rect class="f7" x="346" y="256" width="100" height="22" rx="3"/><path class="f6" d="M446 256l24 11-24 11z"/><rect class="f3" x="336" y="256" width="14" height="22" rx="3"/></g>',
    '<circle class="f7" cx="110" cy="96" r="6"/><circle class="o2" cx="138" cy="74" r="4"/>',
  ].join(''),
  construction: [
    '<rect class="f6" x="60" y="300" width="380" height="8" rx="4"/>',
    '<rect class="f2" x="334" y="66" width="14" height="234"/>',
    [0, 1, 2, 3, 4, 5].map((i) => `<path class="s2 thin" d="M334 ${86 + i * 34}l14 17M348 ${86 + i * 34}l-14 17"/>`).join(''),
    '<rect class="f2" x="244" y="66" width="208" height="12" rx="2"/><rect class="f7" x="420" y="78" width="30" height="22" rx="3"/>',
    '<path class="s3" d="M276 78v70"/><rect class="f7" x="266" y="146" width="20" height="16" rx="3"/><rect class="f1" x="230" y="164" width="92" height="14" rx="3"/>',
    '<path class="f1" d="M86 214l84-62 84 62z"/>',
    '<rect class="f5 e" x="102" y="208" width="136" height="92" rx="4"/>',
    '<rect class="f3" x="154" y="242" width="32" height="58" rx="3"/>',
    '<rect class="o2" x="116" y="226" width="28" height="24" rx="3"/><rect class="o2" x="196" y="226" width="28" height="24" rx="3"/>',
    '<rect class="f7" x="264" y="272" width="126" height="22" rx="3"/>',
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect class="f2" x="${274 + i * 14}" y="272" width="3" height="${i % 2 ? 8 : 12}"/>`).join(''),
  ].join(''),
  // D-220 개인 컨설턴트 — 사람 · 말풍선 · 오르는 막대
  consultant: [
    '<circle class="f5 e" cx="168" cy="146" r="40"/>',
    '<path class="f5 e" d="M98 304c0-52 32-86 70-86s70 34 70 86z"/>',
    '<rect class="f6" x="266" y="88" width="170" height="96" rx="16"/><path class="f6" d="M292 184l-18 28 42-28z"/>',
    '<rect class="o2" x="290" y="112" width="114" height="10" rx="5"/><rect class="o2" x="290" y="136" width="86" height="10" rx="5"/><circle class="f1" cx="414" cy="158" r="8"/>',
    '<rect class="f3" x="298" y="254" width="26" height="48" rx="4"/><rect class="f1" x="334" y="230" width="26" height="72" rx="4"/><rect class="f7" x="370" y="202" width="26" height="100" rx="4"/>',
    '<path class="s3" d="M292 238l40-30 32 14 44-40"/>',
  ].join(''),
  general: [
    '<rect class="f5 e" x="86" y="96" width="216" height="134" rx="16"/>',
    '<circle class="f1" cx="128" cy="138" r="19"/>',
    '<rect class="o2" x="160" y="128" width="112" height="10" rx="5"/><rect class="f6" x="160" y="146" width="80" height="8" rx="4"/>',
    '<rect class="f6" x="108" y="180" width="172" height="8" rx="4"/><rect class="f6" x="108" y="198" width="132" height="8" rx="4"/>',
    '<path class="f1" d="M252 250h150a16 16 0 0 1 16 16v44a16 16 0 0 1-16 16H292l-26 22v-22h-14a16 16 0 0 1-16-16v-44a16 16 0 0 1 16-16z"/>',
    '<circle class="f5" cx="296" cy="288" r="7"/><circle class="f5" cx="326" cy="288" r="7"/><circle class="f5" cx="356" cy="288" r="7"/>',
    '<circle class="f7" cx="378" cy="128" r="42"/>',
    '<path class="f5" d="M378 100l8.2 16.6 18.3 2.7-13.2 12.9 3.1 18.2L378 141.8l-16.4 8.6 3.1-18.2-13.2-12.9 18.3-2.7z"/>',
  ].join(''),
}

/** 첫 화면 그림 */
export function heroArt(industry: IndustryKey): string {
  return wrap(SCENES[industry] ?? SCENES.general)
}

/* ------------------------------------------------------------------ */
/* 아이콘 — 24 칸 · 선으로                                               */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>',
  box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5l3.2 2"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  book: '<path d="M4 5.5c3-1.5 5.5-1.5 8 .5v14c-2.5-2-5-2-8-.5zM20 5.5c-3-1.5-5.5-1.5-8 .5v14c2.5-2 5-2 8-.5z"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  cup: '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16"/>',
  spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7"/>',
} as const

type IconKey = keyof typeof ICON_PATHS

const ICON_SETS: Record<IndustryKey, IconKey[]> = {
  manufacturing: ['gear', 'check', 'box', 'truck', 'wrench', 'shield'],
  it: ['monitor', 'spark', 'gear', 'shield', 'chart', 'chat'],
  trade: ['box', 'truck', 'check', 'chart', 'chat', 'clock'],
  food: ['cup', 'heart', 'star', 'clock', 'home', 'leaf'],
  health: ['heart', 'shield', 'check', 'clock', 'leaf', 'chat'],
  professional: ['chart', 'shield', 'chat', 'check', 'book', 'clock'],
  education: ['book', 'star', 'chat', 'chart', 'clock', 'check'],
  construction: ['home', 'wrench', 'check', 'clock', 'shield', 'chart'],
  design: ['pen', 'spark', 'star', 'monitor', 'check', 'truck'],
  consultant: ['chat', 'chart', 'shield', 'check', 'star', 'clock'],
  general: ['star', 'check', 'chat', 'clock', 'shield', 'heart'],
}

const icon = (k: IconKey) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[k]}</svg>`

/** 사업 카드 i 번째 아이콘 */
export function serviceIcon(industry: IndustryKey, i: number): string {
  const set = ICON_SETS[industry] ?? ICON_SETS.general
  return icon(set[((i % set.length) + set.length) % set.length])
}

/** 시험용 — 이 파일이 만들 수 있는 그림 전부(이것 말고 다른 <svg 는 HTML 에 있으면 안 된다) */
export const ALL_ART: string[] = [...(Object.keys(SCENES) as IndustryKey[]).map(heroArt), ...(Object.keys(ICON_PATHS) as IconKey[]).map(icon)]
