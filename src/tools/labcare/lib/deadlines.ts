// 변경신고 D-day · 활동조사 시즌 · 정기 확인 주기 — 원본 lib/mockStage1.ts / lib/storage.ts 규칙.
//
// D-136: 날짜는 모두 **현지 날짜**(getFullYear/getMonth/getDate)로 센다.
//  - 원본은 toISOString(UTC) 로 적어서 한국 시간 자정~오전 9시에 하루 전 날짜가 찍혔다.
//  - 원본은 setMonth 로 달을 더해 1월 31일 + 1개월이 3월로 넘어갔다 → 그 달 말일로 맞춘다.

/* ───────────────── 날짜 도우미 (현지 날짜) ───────────────── */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 날짜 → YYYY-MM-DD (현지 날짜 — toISOString 은 UTC 라 자정 전후 하루가 밀린다) */
export function ymdLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 날짜 → YYYY-MM (현지 날짜) */
export function ymLocal(d: Date): string {
  return ymdLocal(d).slice(0, 7);
}

/** YYYY-MM-DD → 그날 현지 0시 (없는 날짜 · 모양이 틀리면 null) */
export function parseYmd(s: string): Date | null {
  const m = YMD_RE.exec(s ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const out = new Date(y, mo, d);
  if (out.getFullYear() !== y || out.getMonth() !== mo || out.getDate() !== d) return null;
  return out;
}

/** 두 날짜 사이 날 수 (시각은 버리고 현지 날짜끼리) */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

/** n개월 뒤 같은 날 — 그 달에 그날이 없으면 그 달 말일 (1월 31일 + 1개월 = 2월 28/29일) */
export function addMonthsClamped(base: Date, n: number): Date {
  const first = new Date(base.getFullYear(), base.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(base.getDate(), last));
}

/* ───────────────── 변경사항 관리 (30일 기한 D-day) ───────────────── */

export interface DdayInfo {
  label: string;
  daysLeft: number;
  tone: "ok" | "warn" | "danger" | "over";
}

/** 변경신고 D-day 계산 (사유 발생일 + 30일 기준) */
export function ddayOf(deadline: string, today: Date = new Date()): DdayInfo {
  const dl = parseYmd(deadline);
  // 기한을 못 읽으면 넉넉하다고 말하지 않는다 — 기한초과로 보여 확인하게 한다
  if (!dl) return { label: "기한 확인", daysLeft: -1, tone: "over" };
  const daysLeft = daysBetween(today, dl);
  if (daysLeft < 0) return { label: "기한초과", daysLeft, tone: "over" };
  if (daysLeft === 0) return { label: "D-day", daysLeft, tone: "danger" };
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, daysLeft, tone: "danger" };
  if (daysLeft <= 14) return { label: `D-${daysLeft}`, daysLeft, tone: "warn" };
  return { label: `D-${daysLeft}`, daysLeft, tone: "ok" };
}

/** 변경신고 기한 = 발생일 + 30일 (발생일을 못 읽으면 빈 글자) */
export function changeDeadlineOf(occurredDate: string): string {
  const d = parseYmd(occurredDate);
  return d ? ymdLocal(addDays(d, 30)) : "";
}

/* ───────────────── 연구개발활동조사 ───────────────── */

/** 활동조사 시즌(1~4월) 여부 — 매년 4월 30일 제출 마감(★ 해마다 공고 확인) */
export function isSurveySeason(today: Date = new Date()): boolean {
  const m = today.getMonth() + 1;
  return m >= 1 && m <= 4;
}

export function surveyDeadlineLabel(today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  return m <= 4 ? `${y}년 4월 30일` : `${y + 1}년 4월 30일`;
}

/* ───────────────── 변경확인 주기 (정기 확인 루틴) ───────────────── */

/** 고객사별 변경확인 주기 설정 */
export interface ReminderSetting {
  clientId: string;
  /** 확인 주기(개월): 1/2/3/6/12 */
  cycleMonths: number;
  /** 마지막 확인일 (YYYY-MM-DD) */
  lastCheck: string;
}

/**
 * 다음 확인 예정일 — (마지막 확인 + 주기)가 속한 달의 말일.
 * D-136: 1월 31일 + 1개월은 2월(말일 28/29일)이다. 예전에는 3월 31일로 한 달을 건너뛰었다.
 * 마지막 확인일을 못 읽으면 오늘을 기준으로 센다(늦게 알리는 쪽으로 틀리지 않게).
 */
export function nextCheckDate(r: ReminderSetting, today: Date = new Date()): string {
  const base = parseYmd(r.lastCheck) ?? today;
  const cycle = Number.isFinite(r.cycleMonths) && r.cycleMonths > 0 ? Math.floor(r.cycleMonths) : 1;
  const target = addMonthsClamped(base, cycle);
  return ymdLocal(new Date(target.getFullYear(), target.getMonth() + 1, 0));
}

/** 확인 주기 도래 여부 — 다음 확인 예정일이 이번 달이거나 지났으면 true */
export function isCheckDue(r: ReminderSetting, today: Date = new Date()): boolean {
  return nextCheckDate(r, today).slice(0, 7) <= ymLocal(today);
}
