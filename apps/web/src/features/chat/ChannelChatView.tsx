type ChannelChatViewProps = {
  channelName: string;
};

export default function ChannelChatView({ channelName }: ChannelChatViewProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[color:var(--panel-strong)]">
      <div className="border-b border-[color:var(--line)] px-4 py-3 text-sm">
        <span className="font-semibold">#{channelName}</span>
        <span className="ml-2 text-[color:var(--muted)]">Message history placeholder</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 text-sm text-[color:var(--muted)]">
        Messages will render here once history loading and realtime delivery are wired up.
      </div>

      <div className="border-t border-[color:var(--line)] p-3">
        <div className="flex gap-2">
          <textarea
            disabled
            placeholder={`Message #${channelName}`}
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
