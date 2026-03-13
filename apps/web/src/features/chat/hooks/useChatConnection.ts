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
  const [socketVersion, setSocketVersion] = useState(0);
  const [isConnectionReady, setIsConnectionReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  //Helpers for managing connection ref to ensure socketVersion is changed appropriately.
  function setConnection(conn: ChatConnection) { 
    connectionRef.current = conn;
    setSocketVersion(v => v + 1);
  }
  function clearConnection() {
    connectionRef.current?.socket.disconnect();
    connectionRef.current = null;
  }

  //Runs whenever socketVersion changes, sets up new listeners for connection state. Sets isConnectionReady on connection success.
  useEffect(() => {
    const socket = connectionRef.current?.socket;
    if (!socket) 
      return;

    if (socket.connected) {
      setIsConnectionReady(true);
      setIsLoading(false);
    }

    const handleConnect = () => {
      console.log("DEBUG :: connected");
      setIsLoading(false);
      setIsConnectionReady(true);
      setErrorMessage(null);
    }
    const handleConnectError = (error: Error) => {
      console.log("DEBUG :: connect_error");
      setIsLoading(false);
      setIsConnectionReady(false);
      setErrorMessage(error.message || "Failed to connect to chat server");
    }
    const handleDisconnect = () => {
      console.log("DEBUG :: disconnected");
      setIsConnectionReady(false);
      //TODO:: trigger reconnect attempt somehow?
    }
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => { //clear old handlers before creating new ones when socketVersion changes.
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    }
  }, [socketVersion]);


  //runs on component mount. Creates new socket and sets socket version.
  useEffect(() => {
    let active = true;

    const initConnection = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setIsConnectionReady(false); 

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

        setIsLoading(false);
        setErrorMessage(error instanceof Error ? error.message : "Failed to connect to chat server");
      }
    };

    void initConnection();

    return () => {
      active = false;
      clearConnection();
    };
  }, []);

  return {
    connection: connectionRef.current,
    isConnectionReady,
    isLoading,
    errorMessage,
  };
}
