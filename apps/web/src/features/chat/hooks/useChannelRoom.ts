import { useEffect, useRef } from "react";
import type { ChatConnection } from "../../../api/chat";

type ChannelRoomArgs = {
  selectedChannelId: string | null;
  connection: ChatConnection | null;
}

//manages connection to the current chat channel
export function useChannelRoom({selectedChannelId, connection}: ChannelRoomArgs) {
  const connectedChannelId = useRef<string | null>(null);
  const prevConnectionRef = useRef<ChatConnection | null>(null);

  useEffect(() => { //handle joining/leaving channels when channelId changes
    if (prevConnectionRef.current !== connection) { //reset channelId any time connection changes
      connectedChannelId.current = null;
      prevConnectionRef.current = connection;
    }

    if (!selectedChannelId && connectedChannelId.current) {//if we are connected to a channel, and channelId is removed, disconnect from current channel
      connection?.leaveChannel(connectedChannelId.current);
      connectedChannelId.current = null;
    }

    if (!selectedChannelId || !connection) //not ready to connect, return early
      return;

    if (connectedChannelId.current === selectedChannelId) //already in the right channel
      return;

    if (connectedChannelId.current) { //if we're already in a channel, leave it
      connection.leaveChannel(connectedChannelId.current);
    }

    connection.joinChannel(selectedChannelId);
    connectedChannelId.current = selectedChannelId; //wait until I setup some 'join succeeded' socket message, and set connectedChannelId there?
  
  }, [selectedChannelId, connection]);

}