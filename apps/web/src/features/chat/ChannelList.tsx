export type ChatChannelListItem = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
};

type ChannelListProps = {
  communityName?: string;
  channels: ChatChannelListItem[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
};

export default function ChannelList({ communityName, channels, selectedChannelId, onSelectChannel }: ChannelListProps) {

  function renderChannels() {
    return (
      <div className="space-y-1 overflow-y-auto pr-1">
        {channels.map((channel) => {
          const isSelected = channel.id === selectedChannelId;

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelectChannel(channel.id)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[13px] transition ${
                isSelected
                  ? "border border-[color:var(--accent)] bg-[color:var(--panel)]"
                  : "border border-transparent hover:border-[color:var(--line)]"
              }`}
            >
              <span>#{channel.name}</span>
              <span className="text-[11px] text-[color:var(--muted)]">
                {channel.visibility === "PRIVATE" ? "Private" : "Public"}
              </span>
            </button>
          );
        })}
      </div>
    )
  }

  function renderNoChannels() {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--line)] px-3 py-2 text-xs text-[color:var(--muted)]">
        No channels available.
      </div>
    )
  }


  return (
    <aside className="flex h-full flex-col border-r border-[color:var(--line)] bg-[color:var(--panel-strong)] p-2.5">
      <div className="-mx-2.5 -mt-2.5 mb-2.5 px-2.5 py-2.5">
        {communityName ? <h1 className="text-lg font-semibold">{communityName}</h1> : null}
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Channels</p>
      </div>

      { channels.length === 0 ? renderNoChannels() : renderChannels() }
      
    </aside>
  );
}
