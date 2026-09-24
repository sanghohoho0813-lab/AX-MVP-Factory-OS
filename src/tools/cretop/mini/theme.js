import { brandHex } from "../../shared/brandHex"; // [D-96]
// 미니앱 공용 디자인 토큰 — MiniApp.jsx의 T/card/FF와 동일 값(인증/관리자 화면 시각 일관성용).
export const FF = "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
export const T = {
  bg: "#F4F6FA", surface: "#FFFFFF", ink: "#0F172A", sub: "#475569", mute: "#94A3B8",
  line: "#E2E8F0", lineSoft: "#EEF2F7", brand: brandHex("700", "#1D4ED8"), brandSoft: brandHex("50", "#EFF4FF"), // [D-96] 강조색은 OS 테마
  teal: "#0D9488", up: "#0F766E", down: "#B91C1C", flat: "#64748B",
  warnBg: "#FEF2F2", warnInk: "#B91C1C", okBg: "#ECFDF5", okInk: "#047857",
};
export const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(15,23,42,.04)" };
