import { useEffect, useRef } from "react";
import type { ChatConnection } from "../../../api/chat";

type ChannelRoomArgs = {
  selectedChannelId: string | null;
  connection: ChatConnection | null;
  isConnectionReady: boolean;
}

export function useChannelRoom({selectedChannelId, connection, isConnectionReady}: ChannelRoomArgs) {
  const connectedChannelId = useRef<string | null>(null);

  useEffect(() => { //handle joining/leaving channels when channelId changes
    if (!selectedChannelId && connectedChannelId.current) {//if we are connected to a channel, and channelId is removed, disconnect from current channel
      connection?.leaveChannel(connectedChannelId.current);
      connectedChannelId.current = null;
    }

    if (!selectedChannelId || !isConnectionReady || !connection) //not ready to connect, return early
      return;

    if (connectedChannelId.current === selectedChannelId) //already in the right channel
      return;

    if (connectedChannelId.current) { //if we're already in a channel, leave it
      connection.leaveChannel(connectedChannelId.current);
    }

    connection.joinChannel(selectedChannelId);
    connectedChannelId.current = selectedChannelId; //wait until I setup some 'join succeeded' socket message, and set connectedChannelId there?
  
  }, [selectedChannelId, isConnectionReady, connection]);

  useEffect(() => { //clear connectedChannelId whenever connection object changes, in case it's replaced with a new object with same channelId(which would result in not joining channel)
    connectedChannelId.current = null;
  }, [connection]);

}