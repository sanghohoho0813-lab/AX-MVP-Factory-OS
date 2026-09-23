// 원본 기업부설연구소 OS 의 저장소 (lib/storage.ts) — D-92 에서 그대로 옮겼다.
// 바꾼 것 세 가지: ① read/write 가 localStorage 대신 모듈 기록(../store)으로 간다(클라우드면 기기 사이 공유)
// ② 고객사 목록은 이 OS 고객 운영 업체를 비춘다(회사명·대표자·주소·설립일은 고객 운영 기록이 원본)
// ③ addClient 는 고객 운영 업체 id 를 그대로 쓴다(업체를 새로 만들지 않는다).
import { osClientOf, storeRead, storeWrite } from "../store";

import type {
  Client,
  LabType,
  MonthlyCheck,
  CheckAnswers,
  ClientStatus,
  RiskLevel,
  ResearchProject,
  ResearchNote,
  ReportLog,
  NoteStatus,
  ResearcherInfo,
} from "../../types";
import { evaluateRisk } from "../../lib/riskEngine";

const CLIENTS_KEY = "pmsaas:clients:v1";
const CHECKS_KEY = "pmsaas:checks:v1";
const PROJECTS_KEY = "pmsaas:projects:v1";
const NOTES_KEY = "pmsaas:notes:v1";
const REPORTLOG_KEY = "pmsaas:reportlog:v1";
const CHANGEREC_KEY = "pmsaas:changerecs:v1";
const REMINDER_KEY = "pmsaas:reminders:v1";
const TEMPCO_KEY = "pmsaas:tempcos:v1";
const SETUP_HIDDEN_KEY = "pmsaas:setupHidden:v1";
const SETUP_ADDED_KEY = "pmsaas:setupAdded:v1";
const SURVEY_KEY = "pmsaas:survey:v1";
const CHECKLOG_KEY = "pmsaas:checklogs:v1";
const BENEFIT_KEY = "pmsaas:benefits:v1";
// 시드 버전 — 데이터 모델이 바뀌면 올려서 데모 데이터를 다시 심는다.
const SEED_FLAG = "pmsaas:seeded:v6";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 현재 월 (YYYY-MM) */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function read<T>(key: string, fallback: T): T {
  return storeRead<T>(key, fallback);
}

function write<T>(key: string, value: T): void {
  storeWrite<T>(key, value);
}

function seed(): void {
  // 자동 샘플 생성은 하지 않는다. 신규 진입은 빈 상태로 시작하고,
  // 샘플 데이터는 사용자가 대시보드/설정의 "샘플 넣어보기" 버튼을 눌렀을 때만 생성된다.
  write(CLIENTS_KEY, []);
  write(CHECKS_KEY, []);
  write(PROJECTS_KEY, []);
  write(NOTES_KEY, []);
  write(REPORTLOG_KEY, []);
  write(CHANGEREC_KEY, []);
  write(REMINDER_KEY, []);
  write(TEMPCO_KEY, []);
  write(SEED_FLAG, "1");
}

/** 최초 1회 빈 스토어 초기화 (기존 사용자의 데이터는 그대로 보존) + 샘플 데이터 보정 */
export function ensureSeeded(): void {
  if (!isBrowser()) return;
  if (!read<string>(SEED_FLAG, "")) seed();
  migrateSampleData(); // 기존 샘플의 사업자 유형별 회사명 등 보정 (직접 등록 데이터는 불변)
}

/* ───────────────── 고객사 ───────────────── */

export function getClients(): Client[] {
  // 샘플은 그대로, 직접 등록한 고객사는 고객 운영 업체를 비춘다 (고객 운영에서 지운 업체는 빠진다)
  return read<Client[]>(CLIENTS_KEY, []).flatMap((c) => {
    if (c.isSample || c.source === "sample") return [c];
    const os = osClientOf(c.id);
    if (!os) return [];
    const emp = Number(String(os.employeeCount || "").replace(/[^0-9]/g, "")) || undefined;
    return [
      {
        ...c,
        name: os.companyName || c.name,
        ceoName: os.representativeName || os.contactName || c.ceoName,
        address: os.businessAddress || c.address,
        industry: c.industry || os.industry || "",
        foundedDate: os.establishedAt || c.foundedDate,
        employeeCount: c.employeeCount ?? emp,
        businessType: c.businessType ?? (os.corporateNumber ? "법인사업자" : undefined),
      },
    ];
  });
}

/** 고객사 원본 기록 그대로 (비추기 전) — 수정할 때 쓴다 */
function rawClients(): Client[] {
  return read<Client[]>(CLIENTS_KEY, []);
}

export function getClient(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function addClient(input: Omit<Client, "id" | "createdAt"> & { id?: string }): Client {
  const client: Client = {
    ...input,
    // 직접 등록 고객은 기본 'manual' — 샘플 삭제로 절대 지워지지 않게 한다.
    source: input.source ?? "manual",
    // 이 OS 에서는 고객 운영 업체 id 를 그대로 쓴다 (샘플만 새 id)
    id: input.id || uid("c"),
    createdAt: new Date().toISOString(),
  };
  const clients = rawClients().filter((c) => c.id !== client.id);
  write(CLIENTS_KEY, [...clients, client]);
  return client;
}

export function updateClient(id: string, patch: Partial<Client>): void {
  const clients = rawClients().map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
  write(CLIENTS_KEY, clients);
}

/** clientId로 연결되는 모든 파생 스토어 (배열형) */
const CLIENT_ARRAY_KEYS = [
  CHECKS_KEY, PROJECTS_KEY, NOTES_KEY, REPORTLOG_KEY,
  CHANGEREC_KEY, REMINDER_KEY, SURVEY_KEY, CHECKLOG_KEY,
];

/**
 * 고객사 원본에 존재하지 않는(=clientId가 유효하지 않은) 모든 파생 데이터를 제거한다.
 * 고객사 삭제 시 연동 삭제 + 과거에 남은 고아 데이터 정리를 한 번에 처리하는 공통 유틸.
 * 직접 등록 고객(유효한 clientId)에 연결된 데이터는 절대 건드리지 않는다.
 */
export function cleanupClientLinkedData(): void {
  if (!isBrowser()) return;
  // 저장된 고객사 기준 (고객 운영 목록을 잠깐 못 읽어도 기록을 지우지 않게)
  const valid = new Set(rawClients().map((c) => c.id));

  for (const key of CLIENT_ARRAY_KEYS) {
    const arr = read<Array<{ clientId?: string }>>(key, []);
    if (!Array.isArray(arr)) continue;
    write(key, arr.filter((r) => typeof r.clientId === "string" && valid.has(r.clientId)));
  }
  // 혜택 선택: Record<clientId, string[]>
  const ben = read<Record<string, string[]>>(BENEFIT_KEY, {});
  const nextBen: Record<string, string[]> = {};
  for (const [id, v] of Object.entries(ben)) if (valid.has(id)) nextBen[id] = v;
  write(BENEFIT_KEY, nextBen);
  // 설립서류 숨김/추가: clientId 문자열 배열
  write(SETUP_HIDDEN_KEY, read<string[]>(SETUP_HIDDEN_KEY, []).filter((id) => valid.has(id)));
  write(SETUP_ADDED_KEY, read<string[]>(SETUP_ADDED_KEY, []).filter((id) => valid.has(id)));
}

/** 고객사 삭제 — 연결된 점검·노트·과제·변경·리마인더·활동조사·리포트·혜택까지 함께 정리 */
export function deleteClient(id: string): void {
  // 연구소 고객사에서만 뺀다 — 고객 운영 업체는 그대로 둔다
  write(CLIENTS_KEY, rawClients().filter((c) => c.id !== id));
  cleanupClientLinkedData();
}

/** 모든 고객사 삭제 (전체 삭제) — 연결된 모든 파생 데이터도 함께 정리 */
export function clearAllClients(): void {
  write(CLIENTS_KEY, []);
  cleanupClientLinkedData();
}

/* ───────────────── 월간 점검 ───────────────── */

export function getChecks(): MonthlyCheck[] {
  // 저장된 점수/등급을 그대로 신뢰하지 않고 riskEngine으로 항상 재계산한다.
  // → 위험도 로직을 수정하면 재시드 없이도 모든 화면에 즉시 반영된다.
  return read<MonthlyCheck[]>(CHECKS_KEY, []).map((c) => {
    const { score, level } = evaluateRisk(c.answers);
    return { ...c, score, level };
  });
}

/** 특정 고객사의 점검 이력 (최신 월 우선) */
export function getChecksByClient(clientId: string): MonthlyCheck[] {
  return getChecks()
    .filter((c) => c.clientId === clientId)
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 특정 고객사의 최신 점검 */
export function getLatestCheck(clientId: string): MonthlyCheck | undefined {
  return getChecksByClient(clientId)[0];
}

export function getCheck(id: string): MonthlyCheck | undefined {
  return getChecks().find((c) => c.id === id);
}

/** 점검 저장 (동일 고객사+월 존재 시 덮어쓰기) */
export function saveCheck(check: Omit<MonthlyCheck, "id" | "createdAt"> & { id?: string }): MonthlyCheck {
  const checks = getChecks();
  const existing = checks.find(
    (c) => c.clientId === check.clientId && c.month === check.month,
  );
  const record: MonthlyCheck = {
    id: check.id ?? existing?.id ?? uid("chk"),
    clientId: check.clientId,
    month: check.month,
    answers: check.answers,
    score: check.score,
    level: check.level,
    createdAt: new Date().toISOString(),
  };
  const next = existing
    ? checks.map((c) => (c.id === record.id ? record : c))
    : [...checks, record];
  write(CHECKS_KEY, next);
  return record;
}

/* ───────────────── 집계 ───────────────── */

/** 고객사 현재 상태 (최신 점검 등급 또는 미점검) */
export function getClientStatus(clientId: string): ClientStatus {
  const latest = getLatestCheck(clientId);
  return latest ? latest.level : "미점검";
}

export interface DashboardStats {
  total: number;
  byLevel: Record<RiskLevel, number>;
  unchecked: number;
  /** 이번 달 점검이 아직 안 된(또는 한 번도 점검 안 한) 고객사 수 */
  needCheck: number;
  /** 연구노트 미작성 고객사 수 */
  noResearchNotes: number;
  /** 변경신고 검토 필요 고객사 수 */
  needRegistrationReview: number;
  /** 세액공제 증빙 미흡 고객사 수 */
  taxEvidenceWeak: number;
}

/** 대시보드 집계: 각 고객사의 최신 점검 기준 */
export function getDashboardStats(): DashboardStats {
  const clients = getClients();
  const thisMonth = currentMonth();
  const stats: DashboardStats = {
    total: clients.length,
    byLevel: { 정상: 0, 주의: 0, 위험: 0, "즉시 확인": 0 },
    unchecked: 0,
    needCheck: 0,
    noResearchNotes: 0,
    needRegistrationReview: 0,
    taxEvidenceWeak: 0,
  };

  for (const client of clients) {
    const latest = getLatestCheck(client.id);
    if (!latest) {
      stats.unchecked += 1;
      stats.needCheck += 1;
      continue;
    }
    if (latest.month !== thisMonth) stats.needCheck += 1;
    stats.byLevel[latest.level] += 1;
    const a = latest.answers;
    if (!a.researchNotesWritten) stats.noResearchNotes += 1;
    if (a.personnelChange || a.spaceChange || a.registrationChange)
      stats.needRegistrationReview += 1;
    if (!a.expenseEvidenceOrganized || !a.taxDocsPrepared) stats.taxEvidenceWeak += 1;
  }

  return stats;
}

/* ───────────────── 연구과제 ───────────────── */

export function getProjects(): ResearchProject[] {
  return read<ResearchProject[]>(PROJECTS_KEY, []);
}

export function getProjectsByClient(clientId: string): ResearchProject[] {
  return getProjects().filter((p) => p.clientId === clientId);
}

export function getProject(id: string): ResearchProject | undefined {
  return getProjects().find((p) => p.id === id);
}

export function addProject(input: Omit<ResearchProject, "id">): ResearchProject {
  const project: ResearchProject = { ...input, id: uid("p") };
  write(PROJECTS_KEY, [...getProjects(), project]);
  return project;
}

/* ───────────────── 연구노트 ───────────────── */

export function getNotes(): ResearchNote[] {
  return read<ResearchNote[]>(NOTES_KEY, []);
}

export function getNotesByClient(clientId: string): ResearchNote[] {
  return getNotes()
    .filter((n) => n.clientId === clientId)
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 특정 과제의 특정 월 노트 */
export function getNoteFor(projectId: string, month: string): ResearchNote | undefined {
  return getNotes().find((n) => n.projectId === projectId && n.month === month);
}

/** 특정 과제의 가장 최근 노트 */
export function getLastNote(projectId: string): ResearchNote | undefined {
  return getNotes()
    .filter((n) => n.projectId === projectId)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
}

/** 노트 저장 (동일 과제+월 존재 시 덮어쓰기) */
export function saveNote(
  input: Omit<ResearchNote, "id" | "createdAt" | "updatedAt"> & { id?: string },
): ResearchNote {
  const notes = getNotes();
  const existing = notes.find(
    (n) => n.projectId === input.projectId && n.month === input.month,
  );
  const now = new Date().toISOString();
  const record: ResearchNote = {
    ...input,
    id: input.id ?? existing?.id ?? uid("note"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = existing
    ? notes.map((n) => (n.id === record.id ? record : n))
    : [...notes, record];
  write(NOTES_KEY, next);
  return record;
}

/* ───────────────── 리포트 발송 기록 ───────────────── */

export function getReportLogs(): ReportLog[] {
  return read<ReportLog[]>(REPORTLOG_KEY, []);
}

export function isReportSent(clientId: string, month: string): boolean {
  return getReportLogs().some((r) => r.clientId === clientId && r.month === month);
}

export function markReportSent(clientId: string, month: string): void {
  if (isReportSent(clientId, month)) return;
  write(REPORTLOG_KEY, [
    ...getReportLogs(),
    { clientId, month, sentAt: new Date().toISOString() },
  ]);
}

/** 발송 완료 취소 — 해당 고객사·월 기록 제거 */
export function unmarkReportSent(clientId: string, month: string): void {
  write(
    REPORTLOG_KEY,
    getReportLogs().filter((r) => !(r.clientId === clientId && r.month === month)),
  );
}

/* ───────────────── 연구노트 작성 대상 / 관리 집계 ───────────────── */

export interface NoteTarget {
  project: ResearchProject;
  client: Client | undefined;
  /** 마지막으로 작성된 노트 월 */
  lastMonth: string | null;
  /** 이번 달 노트 (없으면 undefined) */
  current: ResearchNote | undefined;
  /** 이번 달 작성 상태 */
  status: NoteStatus;
}

/** 진행 중 과제별 이번 달 연구노트 작성 현황 */
export function getNoteTargets(month = currentMonth()): NoteTarget[] {
  const clients = getClients();
  return getProjects()
    .filter((p) => p.status === "진행중")
    .map((project) => {
      const current = getNoteFor(project.id, month);
      const last = getLastNote(project.id);
      return {
        project,
        client: clients.find((c) => c.id === project.clientId),
        lastMonth: last?.month ?? null,
        current,
        status: current ? current.status : "작성 필요",
      };
    });
}

/** 변경사항 확인이 필요한 고객사 (최신 점검 기준) */
export interface ChangeTarget {
  client: Client;
  personnel: boolean;
  space: boolean;
  registration: boolean;
}

export function getChangeTargets(): ChangeTarget[] {
  const out: ChangeTarget[] = [];
  for (const client of getClients()) {
    const latest = getLatestCheck(client.id);
    if (!latest) continue;
    const a = latest.answers;
    if (a.personnelChange || a.spaceChange || a.registrationChange) {
      out.push({
        client,
        personnel: a.personnelChange,
        space: a.spaceChange,
        registration: a.registrationChange,
      });
    }
  }
  return out;
}

/** 새 대시보드용 관리 중심 집계 */
export interface ManagementStats {
  /** 관리 고객사 수 */
  managedClients: number;
  /** 이번 달 연구노트 작성 필요(미완료) 대상 수 */
  notesNeeded: number;
  /** 연구활동 미입력 대상 수 (이번 달 노트 자체가 없음) */
  activityMissing: number;
  /** 변경사항 확인 필요 고객사 수 */
  changeReview: number;
  /** 리포트 발송 대기 고객사 수 */
  reportPending: number;
}

/* ───────────────── 변경사항 관리 (업체별 기록 + 주기 알림) ───────────────── */

export type ChangeRecStatus = "확인 필요" | "변경 예정" | "신고 준비중" | "신고 완료";

export interface ChangeRecord {
  id: string;
  clientId: string;
  /** 변경 사유(복수 선택) */
  reasons: string[];
  memo: string;
  status: ChangeRecStatus;
  /** 발생일 (YYYY-MM-DD) */
  occurredDate: string;
  /** 신고기한 = 발생일 + 30일 */
  deadline: string;
  completedDate?: string;
  isSample?: boolean;
  sampleBatchId?: string;
}

/** 고객사별 변경확인 주기 설정 */
export interface ReminderSetting {
  clientId: string;
  /** 확인 주기(개월): 1/2/3/6/12 */
  cycleMonths: number;
  /** 마지막 확인일 (YYYY-MM-DD) */
  lastCheck: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
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

export function getChangeRecords(): ChangeRecord[] {
  return read<ChangeRecord[]>(CHANGEREC_KEY, []);
}
export function getChangeRecordsByClient(clientId: string): ChangeRecord[] {
  return getChangeRecords().filter((r) => r.clientId === clientId);
}
export function addChangeRecord(input: { clientId: string; reasons: string[]; memo: string }): ChangeRecord {
  const today = new Date();
  const rec: ChangeRecord = {
    id: uid("cr"),
    clientId: input.clientId,
    reasons: input.reasons,
    memo: input.memo,
    status: "확인 필요",
    occurredDate: ymd(today),
    deadline: ymd(addDays(today, 30)),
  };
  write(CHANGEREC_KEY, [...getChangeRecords(), rec]);
  return rec;
}
export function updateChangeRecord(id: string, patch: Partial<ChangeRecord>): void {
  write(CHANGEREC_KEY, getChangeRecords().map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)));
}
export function deleteChangeRecord(id: string): void {
  write(CHANGEREC_KEY, getChangeRecords().filter((r) => r.id !== id));
}

export function getReminders(): ReminderSetting[] {
  return read<ReminderSetting[]>(REMINDER_KEY, []);
}
export function getReminder(clientId: string): ReminderSetting {
  return getReminders().find((r) => r.clientId === clientId) ?? { clientId, cycleMonths: 1, lastCheck: ymd(new Date()) };
}
export function setReminderCycle(clientId: string, cycleMonths: number): void {
  const list = getReminders();
  const ex = list.find((r) => r.clientId === clientId);
  const next = ex
    ? list.map((r) => (r.clientId === clientId ? { ...r, cycleMonths } : r))
    : [...list, { clientId, cycleMonths, lastCheck: ymd(new Date()) }];
  write(REMINDER_KEY, next);
}
export function markReminderChecked(clientId: string): void {
  const list = getReminders();
  const ex = list.find((r) => r.clientId === clientId);
  const today = ymd(new Date());
  const next = ex
    ? list.map((r) => (r.clientId === clientId ? { ...r, lastCheck: today } : r))
    : [...list, { clientId, cycleMonths: 1, lastCheck: today }];
  write(REMINDER_KEY, next);
  // 확인 이력 누적
  const logs = read<{ clientId: string; at: string }[]>(CHECKLOG_KEY, []);
  write(CHECKLOG_KEY, [{ clientId, at: today }, ...logs].slice(0, 200));
}

/** 고객사별 변경사항 정기 확인 이력 (최신순) */
export function getCheckLogs(clientId: string): { at: string }[] {
  return read<{ clientId: string; at: string }[]>(CHECKLOG_KEY, [])
    .filter((l) => l.clientId === clientId)
    .map((l) => ({ at: l.at }));
}

/* ───────────────── 리포트 추가 혜택 선택 (절세/혜택 빌더) ───────────────── */

export function getBenefitKeys(clientId: string): string[] {
  const all = read<Record<string, string[]>>(BENEFIT_KEY, {});
  return all[clientId] ?? [];
}
export function setBenefitKeys(clientId: string, keys: string[]): void {
  const all = read<Record<string, string[]>>(BENEFIT_KEY, {});
  write(BENEFIT_KEY, { ...all, [clientId]: keys });
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
  return nextCheckDate(r).slice(0, 7) <= ymd(new Date()).slice(0, 7);
}

/* ───────────────── 임시 저장 업체 (고객사 등록 전 설립서류 체크) ───────────────── */

export interface TempCompany {
  id: string;
  name: string;
  ceoName?: string;
  businessType?: "법인사업자" | "개인사업자";
  industry?: string;
  labType: LabType;
  projectName?: string;
  researcherCount?: number;
  createdAt: string;
}

export function getTempCompanies(): TempCompany[] {
  return read<TempCompany[]>(TEMPCO_KEY, []);
}

/** 임시 업체 추가 (기업명 중복 시 기존 항목 갱신) */
export function addTempCompany(input: Omit<TempCompany, "id" | "createdAt">): TempCompany {
  const list = getTempCompanies();
  const existing = list.find((t) => t.name === input.name);
  const rec: TempCompany = {
    ...input,
    id: existing?.id ?? uid("temp"),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  write(TEMPCO_KEY, existing ? list.map((t) => (t.id === rec.id ? rec : t)) : [...list, rec]);
  return rec;
}

export function removeTempCompany(id: string): void {
  write(TEMPCO_KEY, getTempCompanies().filter((t) => t.id !== id));
}

/* ───────────────── 설립서류 관리 대상 표시 설정 (숨김/추가 영속) ───────────────── */

/** 설립서류 관리 대상에서 제외(숨김)한 고객사 id 목록 — 고객사 원본은 삭제하지 않음 */
export function getHiddenSetupIds(): string[] {
  return read<string[]>(SETUP_HIDDEN_KEY, []);
}
export function hideSetupTarget(clientId: string): void {
  const list = getHiddenSetupIds();
  if (!list.includes(clientId)) write(SETUP_HIDDEN_KEY, [...list, clientId]);
  // 직접 추가했던 대상이면 추가 목록에서도 제거
  write(SETUP_ADDED_KEY, getAddedSetupIds().filter((id) => id !== clientId));
}
/** 샘플(예시 데이터) 복원 — 숨김 목록에서 데모 id 제거 */
export function restoreSetupSamples(demoIds: string[]): void {
  write(SETUP_HIDDEN_KEY, getHiddenSetupIds().filter((id) => !demoIds.includes(id)));
}

/** 직접 추가한 설립서류 관리 대상 고객사 id 목록 */
export function getAddedSetupIds(): string[] {
  return read<string[]>(SETUP_ADDED_KEY, []);
}
export function addSetupTargetId(clientId: string): void {
  const list = getAddedSetupIds();
  if (!list.includes(clientId)) write(SETUP_ADDED_KEY, [...list, clientId]);
  write(SETUP_HIDDEN_KEY, getHiddenSetupIds().filter((id) => id !== clientId));
}

/* ───────────────── 활동조사 이력 (연도별 상태 + 메모 로그) ───────────────── */

export type SurveySimpleStatus = "제출 전" | "자료 요청 중" | "제출 완료";
export const SURVEY_YEARS = [2024, 2025, 2026];

export interface SurveyClientState {
  clientId: string;
  /** 연도(문자열) → 상태 */
  years: Record<string, SurveySimpleStatus>;
  /** 누적 이력/메모 */
  logs: { at: string; text: string }[];
}

/** 기본값: 과거 연도(2024·2025) 제출 완료 / 올해(2026) 제출 전 */
function surveyDefaults(): Record<string, SurveySimpleStatus> {
  return { "2024": "제출 완료", "2025": "제출 완료", "2026": "제출 전" };
}

export function getSurveyState(clientId: string): SurveyClientState {
  const all = read<SurveyClientState[]>(SURVEY_KEY, []);
  const found = all.find((s) => s.clientId === clientId);
  return {
    clientId,
    years: { ...surveyDefaults(), ...(found?.years ?? {}) },
    logs: found?.logs ?? [],
  };
}

function writeSurveyState(next: SurveyClientState): void {
  const all = read<SurveyClientState[]>(SURVEY_KEY, []);
  const exists = all.some((s) => s.clientId === next.clientId);
  write(SURVEY_KEY, exists ? all.map((s) => (s.clientId === next.clientId ? next : s)) : [...all, next]);
}

export function setSurveyYearStatus(clientId: string, year: number, status: SurveySimpleStatus): void {
  const cur = getSurveyState(clientId);
  cur.years[String(year)] = status;
  cur.logs = [
    { at: ymd(new Date()), text: `${year}년 활동조사 → ${status}` },
    ...cur.logs,
  ].slice(0, 30);
  writeSurveyState(cur);
}

export function addSurveyMemo(clientId: string, text: string): void {
  const cur = getSurveyState(clientId);
  cur.logs = [{ at: ymd(new Date()), text }, ...cur.logs].slice(0, 30);
  writeSurveyState(cur);
}

export function getManagementStats(month = currentMonth()): ManagementStats {
  const targets = getNoteTargets(month);
  const notesNeeded = targets.filter((t) => t.status !== "저장 완료").length;
  const activityMissing = targets.filter((t) => !t.current).length;

  // 리포트 발송 대기: 이번 달 노트가 저장 완료된 고객사 중 아직 발송 기록이 없는 경우
  const readyClientIds = new Set(
    targets.filter((t) => t.status === "저장 완료").map((t) => t.project.clientId),
  );
  let reportPending = 0;
  for (const clientId of readyClientIds) {
    if (!isReportSent(clientId, month)) reportPending += 1;
  }

  return {
    managedClients: getClients().length,
    notesNeeded,
    activityMissing,
    changeReview: getChangeTargets().length,
    reportPending,
  };
}

/* ───────────────── 샘플 데이터 관리 (생성 / 식별 / 삭제) ───────────────── */

// 과거 자동 시드로 만들어졌던 레거시 샘플 고객사 id — 식별자가 없던 옛 데이터도 삭제 대상에 포함한다.
const LEGACY_SAMPLE_CLIENT_IDS = new Set([
  "c-daon", "c-gear", "c-retail", "c-packing", "c-code",
  "c-hansol", "c-living", "c-market", "c-miga", "c-bolt",
]);

/** 샘플 고객 여부 — 회사명 텍스트가 아니라 데이터 필드(식별자)로 판단한다. */
export function isSampleClient(c: Client): boolean {
  return (
    c.isSample === true ||
    c.source === "sample" ||
    (c as { source?: string }).source === "샘플" ||
    LEGACY_SAMPLE_CLIENT_IDS.has(c.id)
  );
}

/** 현재 샘플 고객 수 (고객사 기준, 중복 없음) */
export function getSampleClientCount(): number {
  return getClients().filter(isSampleClient).length;
}

/**
 * 기존 샘플 데이터 보정 (샘플 식별자가 있는 고객사만 대상 — 직접 등록 데이터는 불변).
 *  · 개인사업자인데 "(주)"·"주식회사"가 붙은 회사명 정리
 *  · 샘플에는 인정번호·신고시스템 비밀번호·지원금 TIP을 비움(통일/노출 최소화)
 */
export function migrateSampleData(): void {
  if (!isBrowser()) return;
  const clients = rawClients();
  let changed = false;
  const next = clients.map((c) => {
    if (!isSampleClient(c)) return c; // 직접 등록 고객은 절대 건드리지 않음
    const patch: Partial<Client> = {};
    if (c.businessType === "개인사업자") {
      const stripped = c.name.replace(/^\(주\)\s*/, "").replace(/^주식회사\s*/, "").trim();
      if (stripped && stripped !== c.name) patch.name = stripped;
    }
    if (c.labRegistrationNumber) patch.labRegistrationNumber = undefined;
    if (c.labPortalPassword) patch.labPortalPassword = undefined;
    if (c.hiringTip) patch.hiringTip = undefined;
    if (Object.keys(patch).length === 0) return c;
    changed = true;
    return { ...c, ...patch };
  });
  if (changed) write(CLIENTS_KEY, next);
}

/**
 * 샘플 데이터만 삭제 — 샘플 고객사 + 거기서 파생된 모든 데이터를 함께 정리한다.
 * 직접 등록 고객(source !== 'sample')과 그 데이터는 절대 삭제하지 않는다.
 */
export function deleteSampleData(): void {
  if (!isBrowser()) return;
  const sampleIds = new Set(rawClients().filter(isSampleClient).map((c) => c.id));
  write(CLIENTS_KEY, rawClients().filter((c) => !sampleIds.has(c.id)));
  // 삭제된 샘플 고객 + 과거 고아 파생 데이터를 일괄 정리(연동 삭제)
  cleanupClientLinkedData();
}

// 회사명 베이스(법인 표기 없음) — 법인은 "(주)" 접두, 개인사업자는 접두 없이 사용
const SAMPLE_NAME_POOL = [
  "가온식품", "나래소재", "다산정밀", "라온소프트", "마루전자", "바른바이오", "새별물류", "아라디자인",
  "자담푸드", "차오름기계", "카이로스랩", "타임코스메틱", "파인메탈", "하버에너지", "온누리농산",
  "해솔테크", "두레전기", "세움화학", "유담헬스케어", "주안패키지", "청림소재", "태강정밀", "한울소프트",
  "현우전자", "나린푸드", "도담디자인", "라움바이오", "보람기계", "수린코스메틱", "예람물류",
];

const SAMPLE_INDUSTRIES: { industry: string; product: string }[] = [
  { industry: "식품 제조업", product: "기능성 식품 배합" },
  { industry: "기계부품 제조업", product: "정밀 가공 부품" },
  { industry: "소프트웨어 개발", product: "플랫폼 최적화 알고리즘" },
  { industry: "생활용품 제조", product: "친환경 기능성 소재" },
  { industry: "전기전자 부품 제조", product: "전력변환 모듈" },
  { industry: "포장/제품디자인", product: "친환경 포장 구조" },
  { industry: "화장품 제조", product: "저자극 화장품 제형" },
  { industry: "바이오/헬스케어", product: "진단 보조 소재" },
];

// 변경신고 사유(가중치) — 연구원/연구인력 변경이 대다수, 대표자 변경은 별도로 거의 생성 안 함
const CHANGE_REASONS_WEIGHTED = [
  "연구전담요원 입사", "연구전담요원 입사", "연구전담요원 입사", "연구전담요원 입사", "연구전담요원 입사",
  "연구전담요원 퇴사", "연구전담요원 퇴사", "연구전담요원 퇴사", "연구전담요원 퇴사", "연구전담요원 퇴사",
  "연구인력 변경", "연구인력 변경", "연구인력 변경", "연구인력 변경",
  "연구소 소재지 이전",
  "연구소 면적 변경", "연구공간 규모 변경",
  "연구과제 변경 예정", "연구개발활동 변경",
];

// 자연스러운 대표자/연구원 이름 풀
const CEO_NAMES = [
  "김도윤", "박서준", "이현우", "정민재", "최유진", "한지호", "오세영", "윤다은", "서준혁", "장하린",
  "임수빈", "강태경", "조은별", "신우성", "황지안", "문가람", "배준영", "송예린", "노아름", "허재호",
  "남궁민", "양세찬", "구본혁", "백지원", "전상우", "유나경", "표민수", "도경수", "선우현", "라예나",
];
const RESEARCHER_NAMES = [
  "김연우", "박지훈", "이서아", "정태윤", "최민호", "한가을", "오지율", "윤성민", "서다온", "장현서",
  "임도현", "강수아", "조윤후", "신예준", "황건우", "문서윤", "배준서", "송하준", "노지환", "허윤재",
];
// 회사별로 다른 설립일/인정일 풀
const EMP_SMALL = [2, 3, 4, 2, 3, 4, 3, 2]; // 5인 미만 (최소 2)
const EMP_MID = [7, 12, 5, 18, 9, 24, 29, 15]; // 5~29인
const FOUNDED_POOL = [
  "2017-05-30", "2018-04-10", "2019-07-22", "2020-03-15", "2021-07-22",
  "2022-11-04", "2023-05-18", "2016-09-01", "2019-11-08", "2021-01-18", "2015-06-25", "2013-10-02",
];
const CERT_POOL = [
  "2024-02-10", "2024-08-22", "2025-03-02", "2025-09-10", "2025-12-03",
  "2026-02-14", "2026-04-25", "2024-11-20", "2025-06-15", "2026-01-09", "2023-08-22", "2024-05-30",
];
const SALARY_POOL = [36000000, 38000000, 42000000, 35000000, 41000000, 48000000, 39000000, 45000000, 33000000, 52000000];
const CATEGORY_POOL: NonNullable<Client["taxCreditCategory"]>[] = ["일반 R&D", "신성장·원천기술", "미정", "국가전략기술", "일반 R&D"];

// 점검 응답 변형 + 그에 맞는 핵심 이슈 문구
function sampleAnswers(variant: number): CheckAnswers {
  const base: CheckAnswers = {
    personnelChange: false, spaceChange: false, registrationChange: false,
    projectOngoing: true, researchNotesWritten: true, expenseEvidenceOrganized: true,
    taxDocsPrepared: true, surveyResponseNeeded: false, memo: "",
  };
  switch (variant % 4) {
    case 0: return { ...base, researchNotesWritten: false, memo: "이번 달 연구노트 미작성 (샘플)" };
    case 1: return { ...base, personnelChange: true, personnelChangeType: "퇴사", memo: "연구전담요원 변동 확인 (샘플)" };
    case 2: return { ...base, expenseEvidenceOrganized: false, memo: "연구개발비 증빙 보완 (샘플)" };
    default: return { ...base, memo: "전 항목 양호 (샘플)" };
  }
}
const CORE_ISSUE = [
  "이번 달 연구노트 미작성 — 작성 요청 필요",
  "연구전담요원 변동 — 인력요건 확인 필요",
  "연구개발비 증빙 보완 필요",
  "전 항목 양호 — 유지 관리",
];

/** 한 샘플 고객사의 연구원 명단 + 연간 인건비 합계 생성 */
function buildResearchers(i: number, count: number, labType: LabType): { researchers: ResearcherInfo[]; payroll: number } {
  const researchers: ResearcherInfo[] = [];
  let payroll = 0;
  for (let r = 0; r < count; r++) {
    const annual = SALARY_POOL[(i + r) % SALARY_POOL.length] + r * 1_000_000; // 연구원별로 다르게
    payroll += annual;
    researchers.push({
      name: RESEARCHER_NAMES[(i * 2 + r) % RESEARCHER_NAMES.length],
      role: r === 0 ? (labType === "기업부설연구소" ? "연구소장" : "전담부서장") : "연구전담요원",
      joinDate: `${2020 + ((i + r) % 5)}-${String(((i + r) % 12) + 1).padStart(2, "0")}-10`,
      dedicated: true,
      annualSalary: annual,
      monthlySalary: Math.round(annual / 12),
    });
  }
  return { researchers, payroll };
}

/**
 * 선택한 개수만큼 샘플 고객사 + 관련 샘플 데이터(과제·점검·노트·변경)를 생성한다.
 * 각 고객사는 실제처럼 완성된 필드(대표자·근로자수·설립/인정일·연구원·연봉·세제 정보)를 가진다.
 * 기존 샘플은 먼저 정리한 뒤 새로 만든다(3→5→10 누적 방지). 직접 등록 데이터는 보존.
 */
export function generateSampleData(count: number): void {
  if (!isBrowser()) return;
  deleteSampleData(); // 중복 누적 방지: 기존 샘플만 정리

  const n = Math.max(0, Math.min(count, SAMPLE_NAME_POOL.length));
  const batchId = uid("sample");
  const month = currentMonth();
  const now = new Date().toISOString();
  const today = new Date();

  const newClients: Client[] = [];
  const newProjects: ResearchProject[] = [];
  const newChecks: MonthlyCheck[] = [];
  const newNotes: ResearchNote[] = [];
  const newChanges: ChangeRecord[] = [];

  // 대표자 변경은 매우 드물게 — 샘플 20개 이상일 때만 정확히 1건(i=10)
  const ceoChangeIdx = n >= 20 ? 10 : -1;

  for (let i = 0; i < n; i++) {
    const id = uid("sc");
    const meta = SAMPLE_INDUSTRIES[i % SAMPLE_INDUSTRIES.length];
    const base = SAMPLE_NAME_POOL[i];
    const variant = i % 4;

    // 사업자 유형: 최소 80% 법인 — 개인사업자는 i%6===5 (약 17%)
    const isIndiv = i % 6 === 5;
    const businessType: Client["businessType"] = isIndiv ? "개인사업자" : "법인사업자";

    // 근로자 규모: 약 60%는 5인 미만(small). 개인사업자는 항상 소규모(10인 미만) 중심.
    const small = isIndiv || i % 5 < 3;

    // 근로자 수를 먼저 결정 (개인사업자 10인 미만, 40인 이상 미생성)
    let employeeCount = small ? EMP_SMALL[i % EMP_SMALL.length] : EMP_MID[i % EMP_MID.length];
    if (isIndiv) employeeCount = Math.min(employeeCount, 9);

    // 연구원 수: 항상 근로자수보다 적게(최소 1명은 비연구) — 2인 사업장은 연구원 1명 강제.
    //  · 1~2명 → 연구개발전담부서 / 3명 이상 → 기업부설연구소(근로자 4명 이상에서만 가능)
    const researcherCount =
      employeeCount <= 2 ? 1
      : small ? Math.min(employeeCount - 1, 1 + (i % 2))   // 1~2
      : Math.min(employeeCount - 1, 2 + (i % 4));          // 2~5, 근로자수 미만
    const labType: LabType = researcherCount >= 3 ? "기업부설연구소" : "연구개발전담부서";

    // 회사명: 법인만 "(주)" 접두, 개인사업자는 접두 없음
    const name = businessType === "법인사업자" ? `(주)${base}` : base;

    const founded = FOUNDED_POOL[i % FOUNDED_POOL.length];
    const certified = CERT_POOL[i % CERT_POOL.length];
    const { researchers, payroll } = buildResearchers(i, researcherCount, labType);
    const material = (labType === "기업부설연구소" ? 12_000_000 : 3_000_000) + (i % 5) * 2_500_000;
    const other = 2_000_000 + (i % 4) * 1_500_000;
    const category = CATEGORY_POOL[i % CATEGORY_POOL.length];
    const coreIssue = CORE_ISSUE[variant];

    newClients.push({
      id, name, industry: meta.industry, labType,
      ceoName: CEO_NAMES[i % CEO_NAMES.length],
      address: "—",
      foundedDate: founded,
      certifiedDate: certified,
      employeeCount,
      researcherCount,
      labName: `${base} ${labType === "기업부설연구소" ? "부설연구소" : "연구개발전담부서"}`,
      consultant: i % 2 === 0 ? "김상호" : "최유나",
      businessType,
      // 인정번호·신고시스템 비밀번호는 샘플에서 비움(요청)
      researchersPayrollTotal: payroll,
      rndMaterialCost: material,
      rndOtherCost: other,
      taxCreditCategory: category,
      coreIssue,
      researchers,
      createdAt: now,
      isSample: true, source: "sample", sampleBatchId: batchId,
    });

    const pid = uid("sp");
    newProjects.push({
      id: pid, clientId: id, name: `${meta.product} 개선 연구`, productService: meta.product,
      startDate: founded, status: "진행중", isSample: true, sampleBatchId: batchId,
    });
    const ans = sampleAnswers(i);
    const { score, level } = evaluateRisk(ans);
    newChecks.push({
      id: uid("sk"), clientId: id, month, answers: ans, score, level,
      createdAt: now, isSample: true, sampleBatchId: batchId,
    });
    // 일부 샘플은 연구노트 저장 완료 → 리포트 발송 대기 흐름
    if (variant === 3) {
      newNotes.push({
        id: uid("sn"), clientId: id, projectId: pid, month,
        activities: `${meta.product} 성능 개선을 위한 ${month} 연구활동 진행`,
        tests: "조건별 시험 및 결과 측정 (샘플)", problems: "일부 조건에서 개선폭 작음", nextPlan: "제어/배합 조건 재설정 후 재시험",
        roles: researchers.map((r) => ({ name: r.name, role: r.role })),
        relevance: `${meta.product}의 제품 경쟁력과 직접 연결됩니다.`,
        draft: "(샘플 저장 초안)", auditReviewed: true, status: "저장 완료", createdAt: now, updatedAt: now,
        isSample: true, sampleBatchId: batchId,
      });
    }
    // 변경신고: 약 40%(i%5<2)에서 생성. 사유는 연구원/연구인력 변경 중심(가중치),
    //          대표자 변경은 ceoChangeIdx 한 곳만.
    if (i % 5 < 2) {
      const reason = i === ceoChangeIdx
        ? "대표자 변경"
        : CHANGE_REASONS_WEIGHTED[(i * 7 + 3) % CHANGE_REASONS_WEIGHTED.length];
      const occurred = addDays(today, -(5 + (i % 20)));
      newChanges.push({
        id: uid("scr"), clientId: id, reasons: [reason],
        memo: `${reason} — 변경신고 검토 (샘플)`, status: "확인 필요",
        occurredDate: ymd(occurred), deadline: ymd(addDays(occurred, 30)),
        isSample: true, sampleBatchId: batchId,
      });
    }
  }

  write(CLIENTS_KEY, [...rawClients(), ...newClients]);
  write(PROJECTS_KEY, [...getProjects(), ...newProjects]);
  write(CHECKS_KEY, [...read<MonthlyCheck[]>(CHECKS_KEY, []), ...newChecks]);
  write(NOTES_KEY, [...getNotes(), ...newNotes]);
  write(CHANGEREC_KEY, [...getChangeRecords(), ...newChanges]);
}

/* ───────────────── 현장조사 대비 체크 (D-94) ─────────────────
 * 원본은 ‘데모 체크’ 로 화면 안에서만 들고 있었다(나가면 사라지고, 처음부터 8개가 체크돼 있었다).
 * 이 OS 에서는 고객사마다 모듈 기록에 남긴다 — 처음은 빈 체크.
 */
const INSPECTION_KEY = "pmsaas:inspection:v1";

export function getInspectionChecks(clientId: string): string[] {
  if (!clientId) return [];
  const all = read<Record<string, string[]>>(INSPECTION_KEY, {});
  return Array.isArray(all[clientId]) ? all[clientId] : [];
}

export function setInspectionChecks(clientId: string, keys: string[]): void {
  if (!clientId) return;
  const all = read<Record<string, string[]>>(INSPECTION_KEY, {});
  write(INSPECTION_KEY, { ...all, [clientId]: keys });
}
