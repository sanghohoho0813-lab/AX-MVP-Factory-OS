// 원본 데이터 백업/복원/초기화 (D-92) — 원본은 localStorage 를 훑었다. 이 OS 에서는 모듈 기록(../store)을 훑는다.
// 앱 데이터는 모두 "pmsaas:" 접두사를 사용한다.
import { storeKeys, storeRead, storeRemove, storeWrite } from "../store";

const APP_PREFIX = "pmsaas:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function appKeys(): string[] {
  return storeKeys().filter((k) => k.startsWith(APP_PREFIX));
}

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** 전체 앱 데이터를 JSON 파일로 내보내기 */
export function exportData(): void {
  if (!isBrowser()) return;
  const data: Record<string, unknown> = {};
  for (const k of appKeys()) {
    const v = storeRead<unknown>(k, null);
    if (v == null) continue;
    data[k] = v;
  }
  const file: BackupFile = {
    app: "labcare-rnd-os",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `연구소사후관리OS_백업_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok: boolean;
  count: number;
  message: string;
}

/** JSON 백업 파일 내용으로 복원 (기존 앱 데이터 덮어쓰기) */
export function importData(jsonText: string): ImportResult {
  if (!isBrowser()) return { ok: false, count: 0, message: "브라우저 환경이 아닙니다." };
  let parsed: BackupFile | Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, count: 0, message: "JSON 형식이 올바르지 않습니다." };
  }
  const data = (parsed && (parsed as BackupFile).data) ? (parsed as BackupFile).data : (parsed as Record<string, unknown>);
  if (!data || typeof data !== "object") {
    return { ok: false, count: 0, message: "백업 데이터 형식이 올바르지 않습니다." };
  }
  let count = 0;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(APP_PREFIX)) continue; // 앱 데이터 키만 복원 (PIN 등 제외)
    storeWrite(k, v);
    count += 1;
  }
  if (count === 0) return { ok: false, count: 0, message: "복원할 앱 데이터가 없습니다." };
  return { ok: true, count, message: `${count}개 항목을 복원했습니다.` };
}

/** 전체 앱 데이터 초기화 (PIN은 별도) — 다음 진입 시 데모 데이터 재시드 */
export function resetData(): void {
  if (!isBrowser()) return;
  for (const k of appKeys()) storeRemove(k);
}
