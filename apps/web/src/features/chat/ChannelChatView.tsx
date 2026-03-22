import type { MCCPChannel } from "./MultiChannelChatPanel";
import { type ChatConnection } from "../../api/chat";
import { useChatMessaging } from "./hooks/useChatMessaging";
import type { ChatMessageDto } from "@cup/shared-types";
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import MessageRow from "./MessageRow";
import ChatComposer from "./ChatComposer";
import { useResolvedCustomEmojiMap } from "./hooks/useResolvedCustomEmojiMap";
import { useEmojiCatalog } from "./hooks/useEmojiCatalog";

type ChannelChatViewProps = {
  channel: MCCPChannel | null;
  connection: ChatConnection | null;
  communityId: string | null;
};

const TOP_LOAD_THRESHOLD_PX = 200;
const BOTTOM_AUTO_SCROLL_THRESHOLD_PX = 80;
const MESSAGE_GROUP_MAX_GAP_MS = 3 * 60 * 1000;

function isNearBottom(container: HTMLDivElement, thresholdPx: number): boolean {
  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceToBottom <= thresholdPx;
}

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

function getDayOrdinal(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function shouldShowDateSeparator(previousMessage: ChatMessageDto, currentMessage: ChatMessageDto): boolean {
  const previousDate = new Date(previousMessage.createdAt);
  const currentDate = new Date(currentMessage.createdAt);
  return !isSameLocalDay(previousDate, currentDate);
}

function shouldShowMessageHeader(previousMessage: ChatMessageDto | null, currentMessage: ChatMessageDto): boolean {
  if (!previousMessage) {
    return true;
  }

  if (currentMessage.replyMessageId) {
    return true;
  }

  const previousDate = new Date(previousMessage.createdAt);
  const currentDate = new Date(currentMessage.createdAt);

  if (!isSameLocalDay(previousDate, currentDate)) {
    return true;
  }

  if (previousMessage.authorUserId !== currentMessage.authorUserId) {
    return true;
  }

  const gapMs = currentDate.getTime() - previousDate.getTime();
  if (gapMs > MESSAGE_GROUP_MAX_GAP_MS) {
    return true;
  }

  return false;
}

function formatDateSeparatorLabel(messageCreatedAt: string): string {
  const date = new Date(messageCreatedAt);
  const now = new Date();
  const weekday = weekdayFormatter.format(date);
  const month = monthFormatter.format(date);
  const day = date.getDate();
  const suffix = getDayOrdinal(day);
  const includeYear = date.getFullYear() !== now.getFullYear();

  return includeYear
    ? `${weekday}, ${month} ${day}${suffix}, ${date.getFullYear()}`
    : `${weekday}, ${month} ${day}${suffix}`;
}

export default function ChannelChatView({ channel, connection, communityId }: ChannelChatViewProps) {
  const { messages, isLoading, isLoadingOlder, errorMessage, historyCursor, loadOlderMessages, sendMessage, setReaction } = useChatMessaging({channelId: channel?.id ?? null, connection});
  const resolvedCustomEmojiById = useResolvedCustomEmojiMap(messages);
  const {
    emojis: customEmojis,
    isLoading: isLoadingCustomEmojis,
    errorMessage: customEmojiError,
  } = useEmojiCatalog({ communityId });
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousFirstMessageIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const previousReplyVisibleRef = useRef(false);
  const pendingPrependAdjustmentRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [jumpHighlightMessageId, setJumpHighlightMessageId] = useState<string | null>(null);
  const messageElementByIdRef = useRef(new Map<string, HTMLElement>());

  const replyingToMessage = useMemo(
    () => messages.find((message) => message.id === replyingToMessageId) ?? null,
    [messages, replyingToMessageId],
  );

  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const registerMessageElement = useCallback((messageId: string, element: HTMLElement | null) => {
    if (element) {
      messageElementByIdRef.current.set(messageId, element);
      return;
    }

    messageElementByIdRef.current.delete(messageId);
  }, []);

  const handleJumpToMessage = useCallback((targetMessageId: string) => {
    const element = messageElementByIdRef.current.get(targetMessageId);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpHighlightMessageId(targetMessageId);

    window.setTimeout(() => {
      setJumpHighlightMessageId((current) => (current === targetMessageId ? null : current));
    }, 3200);
  }, []);

  useLayoutEffect(() => {
    pendingPrependAdjustmentRef.current = null;
    previousMessageCountRef.current = 0;
    previousFirstMessageIdRef.current = null;
    previousLastMessageIdRef.current = null;
    wasNearBottomRef.current = true;
  }, [channel?.id]);

  

  // useEffect(() => {
  //   let count = 1;
  //   const interval = setInterval(() => {
  //     sendMessage("count = " + count);
  //     count++;
  //   }, 3000);

  //   return () => {
  //     clearInterval(interval);
  //   }
  // }, [connection, channel]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    wasNearBottomRef.current = isNearBottom(container, BOTTOM_AUTO_SCROLL_THRESHOLD_PX);

    if (container.scrollTop > TOP_LOAD_THRESHOLD_PX || !historyCursor || isLoadingOlder) {
      return;
    }

    if (!pendingPrependAdjustmentRef.current) {
      pendingPrependAdjustmentRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };
    }

    void loadOlderMessages().catch(() => {
      pendingPrependAdjustmentRef.current = null;
    });
  }, [historyCursor, isLoadingOlder, loadOlderMessages]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const previousCount = previousMessageCountRef.current;
    const currentCount = messages.length;
    const previousFirstMessageId = previousFirstMessageIdRef.current;
    const previousLastMessageId = previousLastMessageIdRef.current;
    const currentFirstMessageId = currentCount > 0 ? messages[0].id : null;
    const currentLastMessageId = currentCount > 0 ? messages[currentCount - 1].id : null;

    if (pendingPrependAdjustmentRef.current && !isLoadingOlder) {
      const { previousScrollHeight, previousScrollTop } = pendingPrependAdjustmentRef.current;
      const heightDelta = container.scrollHeight - previousScrollHeight;
      container.scrollTop = previousScrollTop + heightDelta;
      pendingPrependAdjustmentRef.current = null;
    } else if (previousCount === 0 && currentCount > 0) {
      container.scrollTop = container.scrollHeight;
    } else {
      const isAppend = previousLastMessageId !== null && currentLastMessageId !== previousLastMessageId;
      const isPrepend = previousFirstMessageId !== null && currentFirstMessageId !== previousFirstMessageId && currentLastMessageId === previousLastMessageId;

      if (isAppend && !isPrepend && wasNearBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    }

    const isReplyVisible = replyingToMessageId !== null;
    if (isReplyVisible !== previousReplyVisibleRef.current && wasNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
    previousReplyVisibleRef.current = isReplyVisible;

    previousMessageCountRef.current = currentCount;
    previousFirstMessageIdRef.current = currentFirstMessageId;
    previousLastMessageIdRef.current = currentLastMessageId;
    wasNearBottomRef.current = isNearBottom(container, BOTTOM_AUTO_SCROLL_THRESHOLD_PX);
  }, [messages, isLoadingOlder, replyingToMessageId]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--panel-lighter)]">
      <div className="border-b border-[color:var(--line)] px-4 py-2.5 text-[13px]">
        <span className="font-semibold">#{channel?.name}</span>
        <span className="ml-2 text-[color:var(--muted)]">
          {isLoadingOlder ? "Loading older messages..." : historyCursor ? "Older messages available" : "Message history loaded"}
        </span>
      </div>

      <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-4 py-4 text-[13px] text-[color:var(--muted)]">
        {isLoading ? (
          <p>Loading messages...</p>
        ) : errorMessage ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {errorMessage}
          </p>
        ) : messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <div className="space-y-0">
            {isLoadingOlder ? <p className="text-xs text-[color:var(--muted)]">Loading older messages...</p> : null}
            {messages.map((message, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = previousMessage ? shouldShowDateSeparator(previousMessage, message) : false;
              const showHeader = shouldShowMessageHeader(previousMessage, message);

              return (
                <Fragment key={message.id}>
                  {showDateSeparator ? (
                    <div className="flex items-center gap-3 py-1 text-[10px] text-[color:var(--muted)]">
                      <span className="h-px flex-1 bg-[color:var(--line)]" aria-hidden />
                      <span>{formatDateSeparatorLabel(message.createdAt)}</span>
                      <span className="h-px flex-1 bg-[color:var(--line)]" aria-hidden />
                    </div>
                  ) : null}
                  <MessageRow
                    message={message}
                    resolvedCustomEmojiById={resolvedCustomEmojiById}
                    customEmojis={customEmojis}
                    isLoadingCustomEmojis={isLoadingCustomEmojis}
                    customEmojiError={customEmojiError}
                    setReaction={setReaction}
                    onReply={setReplyingToMessageId}
                    replyTargetMessage={message.replyMessageId ? messageById.get(message.replyMessageId) ?? null : null}
                    onJumpToMessage={handleJumpToMessage}
                    isJumpHighlighted={jumpHighlightMessageId === message.id}
                    registerMessageElement={registerMessageElement}
                    showHeader={showHeader}
                  />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <ChatComposer
        placeholder={`Message #${channel?.name}`}
        sendMessage={sendMessage}
        communityId={communityId}
        replyingToMessage={replyingToMessage}
        onCancelReply={() => setReplyingToMessageId(null)}
      />
    </section>
  );
}
