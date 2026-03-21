import type {
  ChannelHistoryCursorDto,
  ChatMessageDto,
  ChatReactionSetAck,
  ChatReactionSetPayload,
  ChatReactionUpdate,
  ChatRealtimeMessage,
  ChatSendAck,
  ChatSendPayload,
  ReactionEmojiKind,
} from "@cup/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChannelHistory, type ChatConnection } from "../../../api/chat";


/**
 * responsible for keeping message state up to date, including loading message history from API and handling realtime socket message updates
 * will require channelId to retrieve messages from API. 
 * will require ChatConnection to listen to and send messages
 * Will return MessageList state so it can append/prepend messages. Reload message history on channelId change.
 * Will require isCOnnectionReady to know when socket is connected
 * 
 */    

export type sendMessageFunction = (args: { body: string; replyMessageId?: string | null }) => Promise<void>;
type ChatMessagingArgs = {
    channelId: string | null;
    connection: ChatConnection | null;
}
type UseChatMessagingResult = {
  messages: ChatMessageDto[]; // message list for current channel
  isLoading: boolean; // true when message history is loading(e.g. after first joining a new channel)
  isLoadingOlder: boolean; // true while older message pagination call is in flight
  errorMessage: string | null; // error messages pertaining to message list state
  historyCursor: ChannelHistoryCursorDto | null; // indicates if channel has older messages that can be loaded(and how to load them)
  loadOlderMessages: () => Promise<void>; // loads one older page using current historyCursor
  sendMessage: sendMessageFunction; // returned from hook, used by consumers to send messages to the current channel
  setReaction: (args: { messageId: string; emojiKind: ReactionEmojiKind; emojiValue: string; active: boolean }) => Promise<void>;
}

const MESSAGE_TIMEOUT_MS = 3000;

function compareMessagesAscending(a: ChatMessageDto, b: ChatMessageDto): number {
  if (a.createdAt < b.createdAt) 
    return -1;

  if (a.createdAt > b.createdAt) 
    return 1;

  if (a.id < b.id) 
    return -1;

  if (a.id > b.id) 
    return 1;

  return 0;
}

function mergeUniqueMessages(existing: ChatMessageDto[], incoming: ChatMessageDto[]): ChatMessageDto[] {
  if (incoming.length === 0) {
    return existing;
  }

  const mergedById = new Map<string, ChatMessageDto>();
  for (const message of existing) {
    mergedById.set(message.id, message);
  }

  let changed = false;
  for (const message of incoming) {
    const current = mergedById.get(message.id);
    if (!current || current !== message) {
      changed = true;
    }
    mergedById.set(message.id, message);
  }

  if (!changed && mergedById.size === existing.length) {
    return existing;
  }

  const nextMessages = Array.from(mergedById.values());
  nextMessages.sort(compareMessagesAscending);
  return nextMessages;
}

export function useChatMessaging({channelId, connection}: ChatMessagingArgs): UseChatMessagingResult {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [historyCursor, setHistoryCursor] = useState<ChannelHistoryCursorDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeChannelIdRef = useRef<string | null>(channelId);
  const isOlderRequestInFlightRef = useRef(false);

  useEffect(() => {
    activeChannelIdRef.current = channelId;
  }, [channelId]);

  //sendMessage is returned from this hook, used by ChatComposer(and possibly others) to send messages
  const sendMessage = useCallback( 
    async (args: { body: string; replyMessageId?: string | null }): Promise<void> => {
      const body = args.body.trim();
      const replyMessageId = args.replyMessageId?.trim() || null;

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
        replyMessageId,
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

  const setReaction = useCallback(
    async (args: { messageId: string; emojiKind: ReactionEmojiKind; emojiValue: string; active: boolean }): Promise<void> => {
      const messageId = args.messageId.trim();
      const emojiValue = args.emojiValue.trim();

      if (!messageId) {
        throw new Error("messageId required.");
      }

      if (!emojiValue) {
        throw new Error("emojiValue required.");
      }

      if (!connection) {
        throw new Error("Not connected to chat server.");
      }

      if (!channelId) {
        throw new Error("No channel currently joined.");
      }

      const payload: ChatReactionSetPayload = {
        channelId,
        messageId,
        emojiKind: args.emojiKind,
        emojiValue,
        active: args.active,
        clientMutationId: crypto.randomUUID(),
      };

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          connection.socket.off("chat:reaction:set:ack", ackHandler);
          reject(new Error("Reaction update timed out"));
        }, MESSAGE_TIMEOUT_MS);

        const ackHandler = (ack: ChatReactionSetAck) => {
          if (ack.clientMutationId === payload.clientMutationId) {
            clearTimeout(timeout);
            connection.socket.off("chat:reaction:set:ack", ackHandler);

            if (ack.ok) {
              setMessages((prev) =>
                prev.map((message) => {
                  if (message.id !== payload.messageId) {
                    return message;
                  }

                  const existingIndex = message.reactions.findIndex(
                    (reaction) => reaction.emojiKind === payload.emojiKind && reaction.emojiValue === payload.emojiValue,
                  );

                  if (existingIndex === -1) {
                    if (!payload.active) {
                      return message;
                    }

                    return {
                      ...message,
                      reactions: [...message.reactions, {
                        emojiKind: payload.emojiKind,
                        emojiValue: payload.emojiValue,
                        count: 1,
                        reactedByMe: true,
                        reactorDisplayNames: [],
                      }],
                    };
                  }

                  const nextReactions = [...message.reactions];
                  nextReactions[existingIndex] = {
                    ...nextReactions[existingIndex],
                    reactedByMe: payload.active,
                  };

                  return {
                    ...message,
                    reactions: nextReactions,
                  };
                }),
              );
              resolve();
            } else {
              reject(new Error(ack.error ? ack.error : "Reaction rejected by server"));
            }
          }
        };

        connection.socket.on("chat:reaction:set:ack", ackHandler);
        connection.socket.emit("chat:reaction:set", payload);
      });
    },
    [channelId, connection],
  );


  useEffect(() => { //Retrieve message history whenever channelId changes
    if (!connection)
      return;

    setMessages([]); //always reset messages and cursor when channelId changes
    setHistoryCursor(null);
    setIsLoadingOlder(false);
    isOlderRequestInFlightRef.current = false;

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

        setMessages(() => mergeUniqueMessages([], response.messages));
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

  const loadOlderMessages = useCallback(async (): Promise<void> => {
    if (!connection || !channelId || !historyCursor || isOlderRequestInFlightRef.current) {
      return;
    }

    const requestChannelId = channelId;
    const cursor = historyCursor;
    isOlderRequestInFlightRef.current = true;
    setIsLoadingOlder(true);

    try {
      const response = await fetchChannelHistory(requestChannelId, {
        beforeCreatedAt: cursor.beforeCreatedAt,
        beforeId: cursor.beforeId,
      });

      if (activeChannelIdRef.current !== requestChannelId) {
        return;
      }

      setMessages((prev) => mergeUniqueMessages(prev, response.messages));
      setHistoryCursor(response.nextCursor);
      setErrorMessage(null);
    } catch (error) {
      if (activeChannelIdRef.current !== requestChannelId) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "Unable to load older messages");
    } finally {
      if (activeChannelIdRef.current === requestChannelId) {
        setIsLoadingOlder(false);
      }
      isOlderRequestInFlightRef.current = false;
    }
  }, [channelId, connection, historyCursor]);

  //setup message listener for incoming realtime messages. Updates messages state automatically
  useEffect(() => { 
    if (!connection)
      return;

    const messageHandler = (payload: ChatRealtimeMessage) => {
      if (payload.channelId === channelId) {
        const newMessage: ChatMessageDto = {
          ...payload,
          replyMessageId: payload.replyMessageId,
          editedAt: null,
          deletedAt: null,
          reactions: payload.reactions,
        }
        setMessages((prev) => mergeUniqueMessages(prev, [newMessage]));
      }
      //compare payload channelId with current channelId
      //handle message and everything else here
    }
    connection.socket.on("chat:message", messageHandler);

    return () => {
      connection.socket.off("chat:message", messageHandler);
    }
  }, [connection, channelId]);

  useEffect(() => {
    if (!connection) {
      return;
    }

    const reactionUpdateHandler = (payload: ChatReactionUpdate) => {
      if (payload.channelId !== channelId) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === payload.messageId
            ? {
                ...message,
                reactions: payload.reactions.map((reaction) => {
                  const existing = message.reactions.find(
                    (current) => current.emojiKind === reaction.emojiKind && current.emojiValue === reaction.emojiValue,
                  );

                  return {
                    ...reaction,
                    reactedByMe: existing?.reactedByMe ?? false,
                  };
                }),
              }
            : message,
        ),
      );
    };

    connection.socket.on("chat:reaction:update", reactionUpdateHandler);

    return () => {
      connection.socket.off("chat:reaction:update", reactionUpdateHandler);
    };
  }, [channelId, connection]);
    
  return {
    messages,
    isLoading,
    isLoadingOlder,
    errorMessage,
    historyCursor,
    loadOlderMessages,
    sendMessage,
    setReaction,
  }
}
