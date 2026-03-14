import type { ChannelHistoryCursorDto, ChatMessageDto, ChatRealtimeMessage, ChatSendPayload } from "@cup/shared-types";
import { useCallback, useEffect, useState } from "react";
import { fetchChannelHistory, type ChatConnection } from "../../../api/chat";


/**
 * responsible for keeping message state up to date, including loading message history from API and handling realtime socket message updates
 * will require channelId to retrieve messages from API. 
 * will require ChatConnection to listen to and send messages
 * Will return MessageList state so it can append/prepend messages. Reload message history on channelId change.
 * Will require isCOnnectionReady to know when socket is connected
 * 
 */    
type ChatMessagingArgs = {
    channelId: string | null;
    connection: ChatConnection | null;
}

type UseChatMessagingResult = {
  messages: ChatMessageDto[];
  isLoading: boolean;
  errorMessage: string | null;
  historyCursor: ChannelHistoryCursorDto | null;
  sendMessage: (rawBody: string) => Promise<void>;
}
export function useChatMessaging({channelId, connection}: ChatMessagingArgs): UseChatMessagingResult {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [historyCursor, setHistoryCursor] = useState<ChannelHistoryCursorDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sendMessage = useCallback(
    async (rawBody: string) => {
      const body = rawBody.trim();
      if (!body || !connection || !channelId) 
        return;

      const payload = {
        channelId,
        clientMessageId: 1, //TODO:: implement UUID id and message ack'ing
        body,
      }
      console.log("DEBUG :: Sending payload:", payload);
      connection?.socket.emit("chat:send", payload);
  }, [connection, channelId]);


  useEffect(() => { //Retrieve message history whenever channelId changes
    if (!connection)
      return;

    setMessages([]); //always reset messages and cursor when channelId changes
    setHistoryCursor(null);

    let active = true; //will be set to false when component unmounts. Used to check comp is still mounted after async call
    async function getMessageHistory() {
      if (!channelId) {
        setErrorMessage('No Channel Selected');
        setIsLoading(false);
        return;
      }

      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await fetchChannelHistory(channelId, {});
        if (!active) //if component unmounted before request came back, abort
          return;

        setMessages(response.messages);
        setHistoryCursor(response.nextCursor);
      } catch (error) {
        if (!active)
          return;

        setErrorMessage(error instanceof Error ? error.message : "Unable to fetch message history for this channel");
      } finally {
        if (active)
          setIsLoading(false);
      }
    }

    void getMessageHistory();

    return () => {
      active = false;
    }

  }, [channelId, connection]);

  useEffect(() => { 
    if (!connection)
      return;

    const messageHandler = (payload: ChatRealtimeMessage) => {
      console.log("DEBUG:: received message: ", payload);
      if (payload.channelId == channelId) {
        const newMessage: ChatMessageDto = {
          ...payload,
          editedAt: null,
          deletedAt: null,
        }
        setMessages(prev => [...prev, newMessage]);
      }
      //compare payload channelId with current channelId
      //handle message and everything else here
    }
    connection.socket.on("chat:message", messageHandler);

    return () => {
      connection.socket.off("chat:message", messageHandler);
    }
  }, [connection, channelId]);
    
  return {
    messages,
    isLoading,
    errorMessage,
    historyCursor,
    sendMessage,
  }
}