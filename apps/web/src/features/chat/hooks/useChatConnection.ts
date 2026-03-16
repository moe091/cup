import { useEffect, useState } from "react";
import { connectToChat, type ChatConnection } from "../../../api/chat";

type UseChatConnectionResult = {
  connection: ChatConnection | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useChatConnection(): UseChatConnectionResult {
  const [connection, setConnection] = useState<ChatConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const initConnection = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextConnection = await connectToChat();
        if (!active) {
          nextConnection.socket.disconnect();
          return;
        }

        setConnection(nextConnection);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to connect to chat server");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    initConnection();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => { //ensure connections are never leaked. If connection changes always disconnect old one
    if (!connection) return;

    const onDisconnect = () => {
      setErrorMessage("Chat socket disconnected! Try reloading the page");
      setConnection(null);
    }
    connection.addDisconnectListener(onDisconnect);

    return () => {
      connection.removeDisconnectListener(onDisconnect);
      connection.socket.disconnect();
    };
  }, [connection]);

  return {
    connection,
    isLoading,
    errorMessage,
  };
}
