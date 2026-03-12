import type { ChannelVisibility } from "@cup/shared-types";
import { useMemo } from "react";
import ChannelChatView from "./ChannelChatView";
import ChannelList from "./ChannelList";
import { useChatConnection } from "./hooks/useChatConnection";
import { useChannelRoom } from "./hooks/useChannelRoom";

export type MCCPChannel = {
  id: string;
  name: string;
  visibility: ChannelVisibility;
};

export type MCCPProps = {
  selectedChannelId: string | null;
  onSelectedChannelIdChange: (channelId: string) => void;
  communityName?: string;
  channels: MCCPChannel[];
};

export default function MultiChannelChatPanel({
  selectedChannelId,
  onSelectedChannelIdChange,
  communityName,
  channels,
}: MCCPProps) {
  const hasChannels = channels.length > 0;
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? channels[0] ?? null,
    [selectedChannelId, channels],
  );
  
  const { connection, isConnectionReady } = useChatConnection(); //hook to handle connecting/disconnecting from chat server
  useChannelRoom({ selectedChannelId, connection, isConnectionReady }); //hook to handle joining/leaving/changing channels

  function renderNoChannels() {
    return (
      <section className="flex h-full min-h-0 items-center justify-center bg-[color:var(--panel-strong)] px-6 text-center">
        <div>
          <h2 className="text-lg font-semibold">No Channels Available</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            This community does not have any channels you can view yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-[color:var(--panel)]/95 text-[color:var(--text)] lg:grid-cols-[300px_1fr]">
      <div className="min-h-0">
        <ChannelList
          communityName={communityName}
          channels={channels}
          selectedChannelId={selectedChannel?.id ?? null}
          onSelectChannel={onSelectedChannelIdChange}
        />
      </div>

      <div className="min-h-0">
        {hasChannels && selectedChannel ? <ChannelChatView channel={selectedChannel} /> : renderNoChannels()}
      </div>
    </div>
  );
}
