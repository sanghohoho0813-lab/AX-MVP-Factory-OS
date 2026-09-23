// 사용성 보조 유틸 — 뒤로가기 시 직전 위치/선택 복원, 스크롤 복원, 이전 작업 위치 버튼.
// sessionStorage 기반(탭 단위). 브라우저 기본 back 동작을 막지 않고 보완만 한다.

import { useEffect } from "react";

export function getSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function setSession(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, val);
  } catch {
    /* 무시 */
  }
}

/**
 * 페이지 스크롤 위치 저장/복원.
 *  - 스크롤 시 위치를 sessionStorage에 저장
 *  - ready가 true가 되면(데이터 로드 후) 저장된 위치로 복원
 */
export function useScrollRestore(key: string, ready: boolean = true): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sk = `scroll:${key}`;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSession(sk, String(window.scrollY)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [key]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const y = Number(getSession(`scroll:${key}`) || 0);
    if (y > 0) {
      const t = setTimeout(() => window.scrollTo({ top: y, behavior: "auto" }), 90);
      return () => clearTimeout(t);
    }
  }, [key, ready]);
}

/** 선택 상태(고객사 id 등) 복원용 — 저장값이 후보 목록에 있으면 그 값, 아니면 기본값 */
export function restoredOr(key: string, valid: (v: string) => boolean, fallback: string): string {
  const v = getSession(key);
  return v && valid(v) ? v : fallback;
}

export interface ReturnPoint {
  path: string;
  label: string;
}
/** 내부 페이지로 이동하기 직전 호출 — 돌아올 위치를 저장 */
export function saveReturnPoint(path: string, label: string): void {
  setSession("pm:returnPoint", JSON.stringify({ path, label }));
}
export function getReturnPoint(): ReturnPoint | null {
  const raw = getSession("pm:returnPoint");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && v.path ? v : null;
  } catch {
    return null;
  }
}
export function clearReturnPoint(): void {
  setSession("pm:returnPoint", "");
}
