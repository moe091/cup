import type { MCCPChannel } from "./MultiChannelChatPanel";
import { type ChatConnection } from "../../api/chat";
import { useChatMessaging } from "./hooks/useChatMessaging";

type ChannelChatViewProps = {
  channel: MCCPChannel | null;
  connection: ChatConnection | null;
};

export default function ChannelChatView({ channel, connection }: ChannelChatViewProps) {
  const { messages, isLoading, errorMessage, historyCursor } = useChatMessaging({channelId: channel?.id ?? null, connection});


  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--panel-lighter)]">
      <div className="border-b border-[color:var(--line)] px-4 py-3 text-sm">
        <span className="font-semibold">#{channel?.name}</span>
        <span className="ml-2 text-[color:var(--muted)]">
          {historyCursor ? "Older messages available" : "Message history loaded"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 text-sm text-[color:var(--muted)]">
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
            {messages.map((message) => {
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
                <article key={message.id} className="px-1 py-0.5">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-base font-semibold text-slate-300">
                      {message.authorDisplayName}
                    </span>
                    <span className="text-[11px] text-[color:var(--muted)]">{timestamp}</span>
                    {message.editedAt ? (
                      <span className="text-[11px] text-[color:var(--muted)]">(edited)</span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-5 text-slate-350">
                    {message.deletedAt ? "Message deleted" : message.body}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--line)] p-3">
        <div className="flex gap-2">
          <textarea
            disabled
            placeholder={`Message #${channel?.name}`}
            rows={2}
            className="min-h-16 flex-1 resize-none rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--text)] outline-none"
          />
          <button
            type="button"
            disabled
            className="h-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--muted)]"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
