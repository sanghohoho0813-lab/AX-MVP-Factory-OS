// [D-124] 휴대폰 뒤로가기는 열린 팝업만 닫는다 — OS 안에서 돌 때만(OS 가 전역 손잡이를 둔다).
// 단독으로 팔 때는 손잡이가 없어 아무 일도 하지 않는다. OS 코드를 import 하지 않는다(크레탑 단독 경계).
import { useEffect, useRef } from "react";

export function useBackClose(open, onClose) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    const handle = globalThis.__axBackLayers;
    if (!open || !handle) return undefined;
    return handle.push(() => { if (ref.current) ref.current(); });
  }, [open]);
}
