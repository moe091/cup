import React, { useState } from "react";
import type { ContextMenuState } from "../../components/common/ContextMenu";
import ContextMenu from "../../components/common/ContextMenu";

export type ChatChannelListItem = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
};

type ChannelListProps = {
  communityName: string | null;
  communitySlug: string | null;
  channels: ChatChannelListItem[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
};

export default function ChannelList({ communityName, channels, selectedChannelId, onSelectChannel }: ChannelListProps) {
  const [rightClickMenu, setRightClickMenu] = useState<ContextMenuState | null>(null);
  const closeContextMenu = () => setRightClickMenu(null); 

  //for when an actual existing channel is right clicked - display right click menu and include delete/edit options
  function channelRightClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setRightClickMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      items: [
        { id: "create_channel", label: "Create channel", clickHandler: async () => { console.log("create handler") } },
        { id: "edit_channel", label: "Edit channel name", clickHandler: async () => { console.log("edit handler") } },
        { id: "delete_channel", label: "Delete channel", clickHandler: async () => { console.log("dekete handler") } },
      ]
    });
  }

  //for when empty/blank area on the channelList is right clicked, show right-click menu, only need the 'create' option
  function emptyRightClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    //return if one of the channel buttons was right clicked since that will handle showing the right-click menu
    if (target.closest('button[data-channel-item="true"]')) 
      return; 

    event.preventDefault();
    setRightClickMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      items: [
        { id: "create_channel", label: "Create channel", clickHandler: async () => {console.log("blank create handler")} },
      ]
    });
  } 

  function renderChannels() {
    return (
      <div className="space-y-1 overflow-y-auto pr-1">
        {channels.map((channel) => {
          const isSelected = channel.id === selectedChannelId;

          return (
            <button
              key={channel.id}
              data-channel-item="true"
              type="button"
              onClick={() => onSelectChannel(channel.id)}
              onContextMenu={channelRightClick}
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
    <aside className="flex h-full flex-col border-r border-[color:var(--line)] bg-[color:var(--panel-strong)] p-2.5" onContextMenu={emptyRightClick}>
      <div className="-mx-2.5 -mt-2.5 mb-2.5 px-2.5 py-2.5">
        {communityName ? <h1 className="text-lg font-semibold">{communityName}</h1> : null}
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Channels</p>
      </div>

      { channels.length === 0 ? renderNoChannels() : renderChannels() }
      
      {rightClickMenu ? <ContextMenu {...rightClickMenu} onClose={closeContextMenu} /> : null}
    </aside>
  );
}
