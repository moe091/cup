import type { ChannelHistoryCursorDto, ChatMessageDto, ChatRealtimeMessage, ChatSendAck, ChatSendPayload } from "@cup/shared-types";
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

export type sendMessageFunction = (rawBody: string) => Promise<void>;
type ChatMessagingArgs = {
    channelId: string | null;
    connection: ChatConnection | null;
}
type UseChatMessagingResult = {
  messages: ChatMessageDto[]; // message list for current channel
  isLoading: boolean; // true when message history is loading(e.g. after first joining a new channel)
  errorMessage: string | null; // error messages pertaining to message list state
  historyCursor: ChannelHistoryCursorDto | null; // indicates if channel has older messages that can be loaded(and how to load them)
  sendMessage: sendMessageFunction; // returned from hook, used by consumers to send messages to the current channel
}

const MESSAGE_TIMEOUT_MS = 3000;

export function useChatMessaging({channelId, connection}: ChatMessagingArgs): UseChatMessagingResult {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [historyCursor, setHistoryCursor] = useState<ChannelHistoryCursorDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  //sendMessage is returned from this hook, used by ChatComposer(and possibly others) to send messages
  const sendMessage = useCallback( 
    async (rawBody: string): Promise<void> => {
      const body = rawBody.trim();

      if (!body) 
        throw new Error('Message body required.');
      if (!connection)
        throw new Error('Not connected to chat server.');
      if (!channelId)
        throw new Error('No channel currently joined.');

      const payload: ChatSendPayload = {
        channelId,
        clientMessageId: crypto.randomUUID(),
        body,
      }

      return new Promise((resolve, reject) => {
        //if msg isn't acked in a couple seconds, reject and cleanup ack listener
        const sendAckTimeout = setTimeout(() => { 
          connection.socket.off('chat:send:ack', sendAckHandler);
          reject(new Error('Message sending timed out'));
        }, MESSAGE_TIMEOUT_MS);

        //setup ack listener. If ack comes in, cleanup ack timeout and resolve
        const sendAckHandler = (ack: ChatSendAck) => {
          if (ack.clientMessageId === payload.clientMessageId) {
            clearTimeout(sendAckTimeout);
            connection.socket.off('chat:send:ack', sendAckHandler);

            if (ack.ok)
              resolve();
            else
              reject(new Error(ack.error ? ack.error : 'Message rejected by server'));
          }
        }

        //setup ack listener before sending payload.
        connection.socket.on('chat:send:ack', sendAckHandler);
        connection.socket.emit("chat:send", payload);
      });

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

    getMessageHistory();

    return () => {
      active = false;
    }

  }, [channelId, connection]);

  //setup message listener for incoming realtime messages. Updates messages state automatically
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