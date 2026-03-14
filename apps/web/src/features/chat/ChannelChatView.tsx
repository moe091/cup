import type { MCCPChannel } from "./MultiChannelChatPanel";
import { type ChatConnection } from "../../api/chat";
import { useChatMessaging } from "./hooks/useChatMessaging";
import { useEffect, useRef } from "react";
import MessageRow from "./MessageRow";
import ChatComposer from "./ChatComposer";

type ChannelChatViewProps = {
  channel: MCCPChannel | null;
  connection: ChatConnection | null;
};

export default function ChannelChatView({ channel, connection }: ChannelChatViewProps) {
  const { messages, isLoading, errorMessage, historyCursor, sendMessage } = useChatMessaging({channelId: channel?.id ?? null, connection});
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  

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

  useEffect(() => {
    if (!messagesContainerRef.current) {
      return;
    }

    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--panel-lighter)]">
      <div className="border-b border-[color:var(--line)] px-4 py-3 text-sm">
        <span className="font-semibold">#{channel?.name}</span>
        <span className="ml-2 text-[color:var(--muted)]">
          {historyCursor ? "Older messages available" : "Message history loaded"}
        </span>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-5 text-sm text-[color:var(--muted)]">
        {isLoading ? (
          <p>Loading messages...</p>
        ) : errorMessage ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
            {errorMessage}
          </p>
        ) : messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <ChatComposer placeholder={`Message #${channel?.name}`} />
    </section>
  );
}
