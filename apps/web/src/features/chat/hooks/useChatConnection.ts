import { useEffect, useRef, useState } from "react";
import { connectToChat, type ChatConnection } from "../../../api/chat";

type UseChatConnectionResult = {
  connection: ChatConnection | null;
  isConnectionReady: boolean;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useChatConnection(): UseChatConnectionResult {
  const connectionRef = useRef<ChatConnection | null>(null);
  const [isConnectionReady, setIsConnectionReady] = useState(false);
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

        connectionRef.current = nextConnection;
        setIsConnectionReady(true);
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

    void initConnection();

    return () => {
      active = false;
      connectionRef.current?.socket.disconnect();
      connectionRef.current = null;
      setIsConnectionReady(false);
    };
  }, []);

  return {
    connection: connectionRef.current,
    isConnectionReady,
    isLoading,
    errorMessage,
  };
}
