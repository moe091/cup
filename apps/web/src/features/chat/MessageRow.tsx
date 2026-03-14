import { memo } from "react";
import type { ChatMessageDto } from "@cup/shared-types";

type MessageRowProps = {
  message: ChatMessageDto;
};

function MessageRowBase({ message }: MessageRowProps) {
  const createdAt = new Date(message.createdAt);
  const now = new Date();
  const isToday =
    createdAt.getFullYear() === now.getFullYear() &&
    createdAt.getMonth() === now.getMonth() &&
    createdAt.getDate() === now.getDate();
  const timestamp = isToday
    ? createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : createdAt.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <article className="px-1 py-0.5">
      <div className="mb-0.5 flex items-baseline gap-2">
        <span className="text-base font-semibold text-slate-300">{message.authorDisplayName}</span>
        <span className="text-[11px] text-[color:var(--muted)]">{timestamp}</span>
        {message.editedAt ? <span className="text-[11px] text-[color:var(--muted)]">(edited)</span> : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-5 text-slate-350">{message.deletedAt ? "Message deleted" : message.body}</p>
    </article>
  );
}

const MessageRow = memo(MessageRowBase);

export default MessageRow;
