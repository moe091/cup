import { memo, useCallback, useRef, useState } from "react";
import type { ChatMessageDto, CustomEmojiDto } from "@cup/shared-types";
import { parseChatTextSegments } from "./text/chatTextProcessing";
import MessageActionMenu, { type MessageActionPickerAnchor } from "./message-actions/MessageActionMenu";
import EmojiPicker, { type EmojiSelection } from "./emoji/EmojiPicker";

type MessageRowProps = {
  message: ChatMessageDto;
  resolvedCustomEmojiById: Map<string, CustomEmojiDto | null>;
  customEmojis: CustomEmojiDto[];
  isLoadingCustomEmojis: boolean;
  customEmojiError: string | null;
};

function MessageRowBase({
  message,
  resolvedCustomEmojiById,
  customEmojis,
  isLoadingCustomEmojis,
  customEmojiError,
}: MessageRowProps) {
  const createdAt = new Date(message.createdAt);
  const rowRootRef = useRef<HTMLElement | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<MessageActionPickerAnchor | null>(null);
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

  const handleOpenPicker = useCallback((anchor: MessageActionPickerAnchor) => {
    setPickerAnchor(anchor);
    setIsPickerOpen(true);
  }, []);

  const handlePickerSelect = useCallback((_selection: EmojiSelection, keepOpen: boolean) => {
    if (!keepOpen) {
      setIsPickerOpen(false);
    }
  }, []);

  return (
    <article ref={rowRootRef} className="group relative rounded-md border border-transparent px-2 py-1 transition-colors hover:border-[color:var(--line)] hover:bg-white/[0.03] focus-within:border-[color:var(--line)] focus-within:bg-white/[0.03]">
      <MessageActionMenu onOpenEmojiPicker={handleOpenPicker} />
      <EmojiPicker
        isOpen={isPickerOpen}
        rootRef={rowRootRef}
        anchorX={pickerAnchor?.x}
        anchorY={pickerAnchor?.y}
        customEmojis={customEmojis}
        isLoadingCustom={isLoadingCustomEmojis}
        customError={customEmojiError}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
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
