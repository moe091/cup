import type { ChannelVisibility } from "@cup/shared-types";
import { useMemo } from "react";
import ChannelChatView from "./ChannelChatView";
import ChannelList from "./ChannelList";
import { useChatConnection } from "./hooks/useChatConnection";
import { useChannelRoom } from "./hooks/useChannelRoom";
import type { UseCommunitySettingsResult } from "../communities/hooks/useCommunitySettings";

export type MCCPChannel = {
  id: string;
  name: string;
  visibility: ChannelVisibility;
};

export type MCCPProps = {
  selectedChannelId: string | null;
  onSelectedChannelIdChange: (channelId: string) => void;
  communityId: string | null;
  communitySlug: string | null;
  communityName: string | null;
  channels: MCCPChannel[];
  isLoading?: boolean;
  commSettings: UseCommunitySettingsResult;
  onChannelsChanged: () => Promise<void>;
};

/**
 * *** DESIGN NOTES ***
 * 
 * Going with a 'dumb container' design for Chat(and for all complicated UI and functionality in the app).
 * 
 * For MultiChannelChatPanel(MCCP), it is simply a bag of components placed into a layout.
 * Each of the components(ChannelList, ChannelChatView, ChatComposer, anything else that may be added later) should be self-contained "drop-in" components that require minimal wiring.
 * MCCP should have minimal logic needed to facilitate communication between these components for a cohesive chat experience, e.g.: syncing selectedChannel from channelList to channelChatView
 * so that ChannelChatView displays messages for whatever channel the user clicks on on channelList.
 * 
 * Likewise, this means it's okay for atomic components like channelList to 'own' business logic like creating/deleting/editing channels completely on it's own(or at least in some hook that is
 * owned by channelList rather than needing to be passed in). This couples business logic to atomic components but that is entirely okay, it may result in very minimal code duplication but that is
 * honestly not a problem at all, any duplicated logic can be pulled into the /api helpers file so that only the function calls to the api helper is duplicated, and the logic still exists only in the 
 * helper function and never needs to be changed in multiple places. The tradeoff is immensely simplified wiring and context management between components - which is a huge deal because that is usually
 * the complexity bottleneck that makes react applications become difficult and cumbersome to work with as they grow.
 */
export default function MultiChannelChatPanel({
  selectedChannelId,
  onSelectedChannelIdChange,
  communityId,
  communitySlug,
  communityName,
  channels,
  isLoading = false,
  commSettings,
  onChannelsChanged,
}: MCCPProps) {
  const hasChannels = channels.length > 0;
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? channels[0] ?? null,
    [selectedChannelId, channels],
  );
  
  const { connection } = useChatConnection(); //hook to handle connecting/disconnecting from chat server
  useChannelRoom({ selectedChannelId, connection }); //hook to handle joining/leaving/changing channels

  function renderNoChannels() {
    return (
      <section className="flex h-full min-h-0 items-center justify-center bg-[color:var(--panel-strong)] px-6 text-center">
        <div>
          <h2 className="text-base font-semibold">No Channels Available</h2>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            This community does not have any channels you can view yet.
          </p>
        </div>
      </section>
    );
  }

  function renderLoadingState() {
    return <section className="h-full min-h-0 bg-[color:var(--panel-strong)]" />;
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-[color:var(--panel)]/95 text-[15px] text-[color:var(--text)] lg:grid-cols-[300px_1fr]">
      <div className="min-h-0">
        <ChannelList
          communityName={communityName}
          communitySlug={communitySlug}
          channels={channels}
          selectedChannelId={selectedChannel?.id ?? null}
          onSelectChannel={onSelectedChannelIdChange}
          commSettings={commSettings}
          onChannelsChanged={onChannelsChanged}
        />
      </div>

      <div className="min-h-0">
        {isLoading
          ? renderLoadingState()
          : hasChannels && selectedChannel
            ? <ChannelChatView channel={selectedChannel} connection={connection} communityId={communityId} />
            : renderNoChannels()}
      </div>
    </div>
  );
}
