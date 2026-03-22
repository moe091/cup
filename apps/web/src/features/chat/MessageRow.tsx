import { memo, useCallback, useRef, useState } from "react";
import type { ChatMessageDto, CustomEmojiDto, ReactionEmojiKind } from "@cup/shared-types";
import { parseChatTextSegments } from "./text/chatTextProcessing";
import MessageActionMenu, { type MessageActionPickerAnchor } from "./message-actions/MessageActionMenu";
import EmojiPicker, { type EmojiSelection } from "./emoji/EmojiPicker";

type MessageRowProps = {
  message: ChatMessageDto;
  resolvedCustomEmojiById: Map<string, CustomEmojiDto | null>;
  customEmojis: CustomEmojiDto[];
  isLoadingCustomEmojis: boolean;
  customEmojiError: string | null;
  setReaction: (args: { messageId: string; emojiKind: ReactionEmojiKind; emojiValue: string; active: boolean }) => Promise<void>;
  onReply: (messageId: string) => void;
  replyTargetMessage: ChatMessageDto | null;
  onJumpToMessage: (messageId: string) => void;
  isJumpHighlighted: boolean;
  registerMessageElement: (messageId: string, element: HTMLElement | null) => void;
  showHeader: boolean;
};

function MessageRowBase({
  message,
  resolvedCustomEmojiById,
  customEmojis,
  isLoadingCustomEmojis,
  customEmojiError,
  setReaction,
  onReply,
  replyTargetMessage,
  onJumpToMessage,
  isJumpHighlighted,
  registerMessageElement,
  showHeader,
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
  }, [setPickerAnchor, setIsPickerOpen]);

  const handlePickerSelect = useCallback((_selection: EmojiSelection, keepOpen: boolean) => {
    void (async () => {
      const selection = _selection;
      const emojiKind: ReactionEmojiKind = selection.type === "custom" ? "CUSTOM" : "UNICODE";
      const emojiValue = selection.type === "custom" ? selection.id : selection.unicode;
      const existing = message.reactions.find(
        (reaction) => reaction.emojiKind === emojiKind && reaction.emojiValue === emojiValue,
      );
      const nextActive = !(existing?.reactedByMe ?? false);

      try {
        await setReaction({
          messageId: message.id,
          emojiKind,
          emojiValue,
          active: nextActive,
        });
      } catch {
        // TODO: surface reaction errors in UI
      }

      if (!keepOpen) {
        setIsPickerOpen(false);
      }
    })();
  }, [message.id, message.reactions, setReaction, setIsPickerOpen]);

  const handleQuickReact = useCallback(
    (emoji: string) => {
      const existing = message.reactions.find(
        (reaction) => reaction.emojiKind === "UNICODE" && reaction.emojiValue === emoji,
      );
      const nextActive = !(existing?.reactedByMe ?? false);

      void setReaction({
        messageId: message.id,
        emojiKind: "UNICODE",
        emojiValue: emoji,
        active: nextActive,
      }).catch(() => {
        // TODO: surface reaction errors in UI
      });
    },
    [message.id, message.reactions, setReaction],
  );

  const handleJumpToReply = useCallback(() => {
    if (message.replyMessageId) {
      onJumpToMessage(message.replyMessageId);
    }
  }, [message.replyMessageId, onJumpToMessage]);

  const replyPreviewText = replyTargetMessage
    ? replyTargetMessage.deletedAt
      ? "Message deleted"
      : replyTargetMessage.body.replace(/\s+/g, " ").trim() || "Empty message"
    : "Original message unavailable";

  const replyPreviewSegments = replyTargetMessage && !replyTargetMessage.deletedAt
    ? parseChatTextSegments(replyTargetMessage.body)
    : null;

  return (
    <article
      ref={(element) => {
        rowRootRef.current = element;
        registerMessageElement(message.id, element);
      }}
      className={`group relative rounded-md border border-transparent px-2 pb-1 transition-colors hover:border-[color:var(--line)] hover:bg-white/[0.05] focus-within:border-[color:var(--line)] focus-within:bg-white/[0.03] ${
        showHeader ? "pt-4" : "pt-0"
      } ${
        isJumpHighlighted ? "reply-jump-highlight" : ""
      }`}
    >
      <MessageActionMenu
        onOpenEmojiPicker={handleOpenPicker}
        onQuickReact={handleQuickReact}
        onReply={() => onReply(message.id)}
      />
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

      {message.replyMessageId ? (
        <button
          type="button"
          onClick={handleJumpToReply}
          className="mb-0.5 flex max-w-full items-center gap-1 text-left text-[13px] text-[color:var(--muted)] hover:text-[color:var(--text)]"
          title={replyPreviewText}
        >
          <span aria-hidden>↪</span>
          <span className="truncate whitespace-nowrap">
            {replyTargetMessage ? (
              <span className="text-[color:var(--accent-2)]">{replyTargetMessage.authorDisplayName}</span>
            ) : null}
            {replyTargetMessage ? <span className="mx-1 text-[color:var(--muted)]">:</span> : null}
            {replyPreviewSegments
              ? replyPreviewSegments.map((segment, index) => {
                  if (segment.kind === "customEmojiToken") {
                    const resolved = resolvedCustomEmojiById.get(segment.id);

                    if (resolved) {
                      return (
                        <img
                          key={`reply-custom-${index}`}
                          src={resolved.assetUrl}
                          alt={`:${resolved.name}:`}
                          className="mx-[1px] inline h-[1.05em] w-[1.05em] align-[-0.1em] object-contain"
                          draggable={false}
                        />
                      );
                    }

                    if (resolved === null) {
                      return <span key={`reply-missing-${index}`}>[deleted emoji]</span>;
                    }

                    return <span key={`reply-token-${index}`}>{segment.value}</span>;
                  }

                  return <span key={`reply-text-${index}`}>{segment.value}</span>;
                })
              : replyPreviewText}
          </span>
        </button>
      ) : null}

      {showHeader ? (
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="text-[16px] font-semibold text-[color:var(--accent-2)]">{message.authorDisplayName}</span>
          <span className="text-[12px] text-[color:var(--muted)]">{timestamp}</span>
          {message.editedAt ? <span className="text-[10px] text-[color:var(--muted)]">(edited)</span> : null}
        </div>
      ) : null}
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

      {message.reactions.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {message.reactions.map((reaction) => {
            const reactionKey = `${reaction.emojiKind}:${reaction.emojiValue}`;
            const isCustom = reaction.emojiKind === "CUSTOM";
            const customEmoji = isCustom ? resolvedCustomEmojiById.get(reaction.emojiValue) : undefined;

            return (
              <button
                key={reactionKey}
                type="button"
                onClick={() => {
                  void setReaction({
                    messageId: message.id,
                    emojiKind: reaction.emojiKind,
                    emojiValue: reaction.emojiValue,
                    active: !reaction.reactedByMe,
                  }).catch(() => {
                    // TODO: surface reaction errors in UI
                  });
                }}
                title={reaction.reactorDisplayNames.join(", ")}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition bg-[color:var(--panel-strong)] 
                  hover:brightness-120 hover:bg-[color:var(--panel)] ${
                  reaction.reactedByMe
                    ? "border border-[color:var(--accent)]"
                    : ""
                }`}
              >
                {isCustom ? (
                  customEmoji ? (
                    <img
                      src={customEmoji.assetUrl}
                      alt={`:${customEmoji.name}:`}
                      className="h-6 w-6 object-contain"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-base leading-none">□</span>
                  )
                ) : (
                  <span className="text-[20px] leading-none">{reaction.emojiValue}</span>
                )}
                <span className="text-[12px] text-[color:var(--muted)]">{reaction.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

const MessageRow = memo(MessageRowBase);

export default MessageRow;
