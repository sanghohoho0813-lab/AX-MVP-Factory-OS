/**
 * 원본 mockCustomers.ts 자리 (D-92).
 *
 * 원본은 예시 고객 8곳을 늘 대시보드에 섞어 보여 줬다. 이 OS 에서는 업체가 고객 운영 하나뿐이라
 * 예시 고객은 섞지 않는다(빈 목록). 단계 색표(STAGE_BADGE)는 원본 그대로다.
 */
import type { Customer, CustomerStage } from "../types";

export const MOCK_CUSTOMERS: Customer[] = [];

export const STAGE_BADGE: Record<CustomerStage, string> = {
  "신규 DB": "bg-slate-100 text-slate-700",
  "1차 상담 완료": "bg-blue-100 text-blue-700",
  "계약 검토": "bg-indigo-100 text-indigo-700",
  "서류 요청": "bg-amber-100 text-amber-700",
  "서류 대기": "bg-orange-100 text-orange-700",
  "접수 준비": "bg-violet-100 text-violet-700",
  "접수 완료": "bg-cyan-100 text-cyan-700",
  "심사 중": "bg-sky-100 text-sky-700",
  승인: "bg-green-100 text-green-700",
  보류: "bg-yellow-100 text-yellow-800",
  실패: "bg-red-100 text-red-700",
  "재접촉 예정": "bg-pink-100 text-pink-700",
};
