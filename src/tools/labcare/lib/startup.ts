// 창업 3년 이내 판정 (D-136).
//
// 예전에는 업력을 '년' 으로 받아 businessMonths = 년 × 12 로 셌다.
// 그래서 3년 0개월 ~ 3년 11개월 회사가 모두 36개월 = '창업 3년 이내' 로 나와
// 연구소 인원 2명 기준과 대표자 예외가 잘못 붙었다.
//
// 이제는 설립일(달력)로 센다:
//  - 설립일 + 3년 되는 날까지(그날 포함)만 '3년 이내'. 그 다음 날부터는 지남.
//  - 설립일이 2월 29일이면 3년 뒤 2월 28일까지 (없는 날은 그 달 말일 — 더 이른 쪽이라 엄격하다).
//  - 설립일을 모르면 null — 판정은 '3년 이내 아님' 으로 엄격하게 하고, 화면에 설립일을 적으라고 말한다.

import { monthsInBusiness } from "../../shared/clientPrefill";
import { addMonthsClamped, parseYmd } from "./deadlines";

/** 설립일 + years 년 되는 날(그날 포함)까지면 true · 지났으면 false · 설립일을 모르거나 미래면 null */
export function withinStartupYears(establishedAt: string, today: Date, years = 3): boolean | null {
  const est = parseYmd(establishedAt);
  if (!est) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (est.getTime() > t.getTime()) return null;
  const end = addMonthsClamped(est, years * 12);
  return t.getTime() <= end.getTime();
}

/** 업력 글 — "3년 11개월" (설립일을 모르면 빈 글자) */
export function businessAgeLabel(establishedAt: string, today: Date): string {
  const months = monthsInBusiness(establishedAt, today);
  if (months === null) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  return m === 0 ? `${y}년` : `${y}년 ${m}개월`;
}
