import { memo } from "react";
import type { CoachChatItem } from "../../coach";

// AI 코치 채팅 말풍선. situation 은 가운데 구분 칩, coach 는 🤖 좌측 말풍선.
function ChatBubbleBase({ item }: { item: CoachChatItem }) {
  if (item.kind === "situation") {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {item.text}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base">
        🤖
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-blue-50 px-4 py-2.5 text-sm leading-6 text-slate-800">
        {item.text}
      </div>
    </div>
  );
}

export default memo(ChatBubbleBase);
