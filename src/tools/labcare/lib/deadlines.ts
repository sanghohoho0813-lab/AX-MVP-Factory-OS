// 변경신고 D-day · 활동조사 시즌 · 정기 확인 주기 — 원본 lib/mockStage1.ts / lib/storage.ts 규칙 그대로.

/* ───────────────── 변경사항 관리 (30일 기한 D-day) ───────────────── */

export interface DdayInfo {
  label: string;
  daysLeft: number;
  tone: "ok" | "warn" | "danger" | "over";
}

/** 변경신고 D-day 계산 (사유 발생일 + 30일 기준) */
export function ddayOf(deadline: string): DdayInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + "T00:00:00");
  const daysLeft = Math.round((dl.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return { label: "기한초과", daysLeft, tone: "over" };
  if (daysLeft === 0) return { label: "D-day", daysLeft, tone: "danger" };
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, daysLeft, tone: "danger" };
  if (daysLeft <= 14) return { label: `D-${daysLeft}`, daysLeft, tone: "warn" };
  return { label: `D-${daysLeft}`, daysLeft, tone: "ok" };
}

/** 날짜 → YYYY-MM-DD (현지 시각 기준 — 원본 ymd 는 toISOString 이라 자정 전후 하루가 밀릴 수 있어 현지 기준으로 적는다) */
export function ymdLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** 변경신고 기한 = 발생일 + 30일 (원본 addChangeRecord 규칙: deadline = ymd(addDays(today, 30))) */
export function changeDeadlineOf(occurredDate: string): string {
  return ymdLocal(addDays(new Date(occurredDate + "T00:00:00"), 30));
}

/* ───────────────── 연구개발활동조사 ───────────────── */

/** 활동조사 시즌(1~4월) 여부 — 매년 4월 30일 제출 마감 */
export function isSurveySeason(): boolean {
  const m = new Date().getMonth() + 1;
  return m >= 1 && m <= 4;
}

export function surveyDeadlineLabel(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
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

/** 다음 확인 예정일 — (마지막 확인 + 주기)가 속한 달의 말일 기준 */
export function nextCheckDate(r: ReminderSetting): string {
  const base = addMonths(new Date(r.lastCheck + "T00:00:00"), r.cycleMonths);
  const eom = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const mm = String(eom.getMonth() + 1).padStart(2, "0");
  const dd = String(eom.getDate()).padStart(2, "0");
  return `${eom.getFullYear()}-${mm}-${dd}`;
}

/** 확인 주기 도래 여부 — 다음 확인 예정일이 이번 달이거나 지났으면 true */
export function isCheckDue(r: ReminderSetting): boolean {
  return nextCheckDate(r).slice(0, 7) <= ymdLocal(new Date()).slice(0, 7);
}
