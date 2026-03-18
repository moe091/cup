import { memo } from "react";
import type { ChatMessageDto, CustomEmojiDto } from "@cup/shared-types";
import { parseChatTextSegments } from "./text/chatTextProcessing";

type MessageRowProps = {
  message: ChatMessageDto;
  resolvedCustomEmojiById: Map<string, CustomEmojiDto | null>;
};

function MessageRowBase({ message, resolvedCustomEmojiById }: MessageRowProps) {
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

  const textSegments = parseChatTextSegments(message.body);

  return (
    <article className="px-1 py-0.5">
      <div className="mb-0.5 flex items-baseline gap-2">
        <span className="text-base font-semibold text-slate-300">{message.authorDisplayName}</span>
        <span className="text-[11px] text-[color:var(--muted)]">{timestamp}</span>
        {message.editedAt ? <span className="text-[11px] text-[color:var(--muted)]">(edited)</span> : null}
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-5 text-slate-350">
            {message.deletedAt
          ? "Message deleted"
          : textSegments.map((segment, index) => {
              if (segment.kind === "unicodeEmoji") {
                return (
                  <span key={`emoji-${index}`} className="inline text-[1.35em] leading-none align-[-0.1em]">
                    {segment.value}
                  </span>
                );
              }

              if (segment.kind === "customEmojiToken") {
                const resolved = resolvedCustomEmojiById.get(segment.id);

                if (resolved === null) {
                  return <span key={`missing-custom-${index}`}>[deleted emoji]</span>;
                }

                if (resolved) {
                  return (
                    <img
                      key={`custom-${index}`}
                      src={resolved.assetUrl}
                      alt={`:${resolved.name}:`}
                      title={`:${resolved.name}:`}
                      className="mx-[1px] inline h-[1.35em] w-[1.35em] align-[-0.2em] object-contain"
                      draggable={false}
                    />
                  );
                }

                return <span key={`custom-token-${index}`}>{segment.value}</span>;
              }

              return <span key={`text-${index}`}>{segment.value}</span>;
            })}
      </p>
    </article>
  );
}

const MessageRow = memo(MessageRowBase);

export default MessageRow;
