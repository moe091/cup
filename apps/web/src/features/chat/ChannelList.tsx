import React, { useState } from "react";
import type { ContextMenuState } from "../../components/common/ContextMenu";
import ContextMenu from "../../components/common/ContextMenu";
import StringEditModal from "../../components/common/StringEditModal";
import ConfirmTextModal from "../../components/ConfirmTextModal";
import type { UseCommunitySettingsResult } from "../communities/hooks/useCommunitySettings";
import { createCommunityChannel, deleteCommunityChannel, updateCommunityChannel } from "../../api/communities";

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
  commSettings: UseCommunitySettingsResult;
  onChannelsChanged: () => Promise<void>;
};

type StringEditModalStatus = "create" | "edit" | "closed";


export default function ChannelList({ communityName, communitySlug, channels, selectedChannelId, onSelectChannel, commSettings, onChannelsChanged }: ChannelListProps) {
  const [rightClickMenu, setRightClickMenu] = useState<ContextMenuState | null>(null);
  const closeContextMenu = () => setRightClickMenu(null); 
  
  const [editModalStatus, setEditModalStatus] = useState<StringEditModalStatus>("closed");
  const [editingChannel, setEditingChannel] = useState<ChatChannelListItem | null>(null); // to keep track of the channel that is currently being edited, if any
  const [deletingChannel, setDeletingChannel] = useState<ChatChannelListItem | null>(null);
  const [isSubmittingChannelName, setIsSubmittingChannelName] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);


  const canCreateChannel = commSettings.viewerPermissionLevel >= commSettings.permissionConfig.createChannel;
  const canEditChannelName = commSettings.viewerPermissionLevel >= commSettings.permissionConfig.editChannelName;
  const canDeleteChannel = commSettings.viewerPermissionLevel >= commSettings.permissionConfig.deleteChannel;

  async function handleCreateChannel(name: string) {
    if (!communitySlug) {
      throw new Error("Cannot create channel without a community slug.");
    }
  
    setIsSubmittingChannelName(true);
  
    try {
      await createCommunityChannel(communitySlug, {
        name,
        requiredPermissionLevel: 1, //this is the default permission level to access the newly created channel. TODO:: might add a UI to set permission level at creation, if not it can be edited afterwards
      });
      await onChannelsChanged();
   
      setEditModalStatus("closed");
    } finally {
      setIsSubmittingChannelName(false);
    }
  }
  
  async function handleEditChannel(name: string) {
    if (!communitySlug) {
      throw new Error("Cannot edit channel without a community slug.");
    }
  
    if (!editingChannel) {
      throw new Error("Cannot edit channel without a selected channel.");
    }
  
    setIsSubmittingChannelName(true);
  
    try {
      await updateCommunityChannel(communitySlug, editingChannel.id, {
        name,
      });
      await onChannelsChanged();
   
      setEditingChannel(null);
      setEditModalStatus("closed");
    } finally {
      setIsSubmittingChannelName(false);
    }
  }

  async function handleDeleteChannel() {
    if (!communitySlug) {
      throw new Error("Cannot delete channel without a community slug.");
    }

    if (!deletingChannel) {
      throw new Error("Cannot delete channel without a selected channel.");
    }

    setIsDeletingChannel(true);

    try {
      await deleteCommunityChannel(communitySlug, deletingChannel.id);
      await onChannelsChanged();

      setDeletingChannel(null);
    } finally {
      setIsDeletingChannel(false);
    }
  }
  
  const editModalOptions = {
    create: { title: "Create Channel", submitLabel: "Create", handler: handleCreateChannel },
    edit: { title: "Rename Channel", submitLabel: "Rename", handler: handleEditChannel },
    closed: { title: "", submitLabel: "Submit", handler: () => {} },
  };

  const isEditModalOpen = editModalStatus != "closed";
  const editModalTitle = editModalOptions[editModalStatus].title;
  const editModalHandler = editModalOptions[editModalStatus].handler;
  const editModalSubmitLabel = editModalOptions[editModalStatus].submitLabel;
  

  async function openCreateChannelModal() {
    setEditModalStatus("create");
  }

  async function openEditChannelModal(channel: ChatChannelListItem) {
    setEditingChannel(channel);
    setEditModalStatus("edit");
  }

  async function openDeleteChannelModal(channel: ChatChannelListItem) {
    setDeletingChannel(channel);
  }

  //for when an actual existing channel is right clicked - display right click menu and include delete/edit options
  function channelRightClick(event: React.MouseEvent<HTMLButtonElement>, channel: ChatChannelListItem) {
    const items: ContextMenuState["items"] = [];

    if (canCreateChannel) 
      items.push({ id: "create_channel", label: "Create channel", clickHandler: openCreateChannelModal });
    
    if (canEditChannelName) 
      items.push({ id: "edit_channel", label: "Edit channel name", clickHandler: () => openEditChannelModal(channel) });
    
    if (canDeleteChannel) 
      items.push({ id: "delete_channel", label: "Delete channel", variant: "danger", clickHandler: () => openDeleteChannelModal(channel) });
    
    if (items.length == 0) { //if they don't have any right click options anyway then just show normal right click menu
      setRightClickMenu(null);
      return
    }
    
    event.preventDefault();

    setRightClickMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      items
    });
  }

  //for when empty/blank area on the channelList is right clicked, show right-click menu, only need the 'create' option
  function emptyRightClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    //return if one of the channel buttons was right clicked since that will handle showing the right-click menu
    if (target.closest('button[data-channel-item="true"]')) 
      return; 

    if (!canCreateChannel) {
      setRightClickMenu(null)
      return;
    }

    event.preventDefault();
    setRightClickMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      items: [
        { id: "create_channel", label: "Create channel", clickHandler: openCreateChannelModal },
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
              onContextMenu={(e) => channelRightClick(e, channel)}
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

      <StringEditModal
        isOpen={isEditModalOpen}
        title={editModalTitle}
        label="Enter Channel Name"
        initialValue=""
        submitLabel={editModalSubmitLabel}
        isSubmitting={isSubmittingChannelName}
        maxLength={60}
        onCancel={() => setEditModalStatus("closed")}
        onConfirm={editModalHandler}
      />

      <ConfirmTextModal
        isOpen={deletingChannel !== null}
        title="Delete channel"
        message={deletingChannel ? `Delete #${deletingChannel.name}? This cannot be undone.` : "Delete this channel? This cannot be undone."}
        confirmLabel="Delete channel"
        confirmationText="DELETE"
        isSubmitting={isDeletingChannel}
        onCancel={() => setDeletingChannel(null)}
        onConfirm={handleDeleteChannel}
      />
    </aside>
  );
}
