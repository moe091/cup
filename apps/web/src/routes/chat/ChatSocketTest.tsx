import { useEffect, useMemo, useRef, useState } from 'react';
import { connectToChat, type ChatConnection } from '../../api/chat';

type LogEntry = {
  time: string;
  text: string;
};

export default function ChatSocketTest() {
  const connectionRef = useRef<ChatConnection | null>(null);
  const [channelId, setChannelId] = useState('test-channel-1');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const canConnect = useMemo(() => !isConnecting && !isConnected, [isConnecting, isConnected]);

  function appendLog(text: string) {
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString(),
      text,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 50));
  }

  async function handleConnect() {
    if (connectionRef.current || isConnecting) {
      return;
    }

    setIsConnecting(true);
    appendLog('Connecting...');

    try {
      const connection = await connectToChat();
      connectionRef.current = connection;

      connection.socket.on('connect', () => {
        setIsConnected(true);
        appendLog(`Connected: ${connection.socket.id}`);
      });

      connection.socket.on('disconnect', (reason) => {
        setIsConnected(false);
        appendLog(`Disconnected: ${reason}`);
      });

      connection.socket.on('connect_error', (error) => {
        appendLog(`Connect error: ${error.message}`);
      });

      connection.socket.on('chat:error', (payload) => {
        appendLog(`Chat error: ${payload.code} (${payload.message})`);
      });

      connection.socket.on('chat:join:ack', (payload) => {
        appendLog(`Join ack: ${JSON.stringify(payload)}`);
      });

      connection.socket.on('chat:leave:ack', (payload) => {
        appendLog(`Leave ack: ${JSON.stringify(payload)}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown connect error';
      appendLog(`Failed to initialize chat: ${message}`);
      connectionRef.current = null;
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    const connection = connectionRef.current;
    if (!connection) {
      return;
    }

    connection.socket.removeAllListeners();
    connection.socket.disconnect();
    connectionRef.current = null;
    setIsConnected(false);
    appendLog('Disconnected by user');
  }

  function handleJoin() {
    if (!connectionRef.current) {
      appendLog('Cannot join: not connected');
      return;
    }

    const trimmed = channelId.trim();
    if (!trimmed) {
      appendLog('Cannot join: channelId is empty');
      return;
    }

    connectionRef.current.joinChannel(trimmed);
    appendLog(`Requested join: ${trimmed}`);
  }

  function handleLeave() {
    if (!connectionRef.current) {
      appendLog('Cannot leave: not connected');
      return;
    }

    const trimmed = channelId.trim();
    if (!trimmed) {
      appendLog('Cannot leave: channelId is empty');
      return;
    }

    connectionRef.current.leaveChannel(trimmed);
    appendLog(`Requested leave: ${trimmed}`);
  }

  useEffect(() => {
    return () => {
      const connection = connectionRef.current;
      if (!connection) {
        return;
      }

      connection.socket.removeAllListeners();
      connection.socket.disconnect();
      connectionRef.current = null;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-[color:var(--text)]">
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/80 p-6">
        <h2 className="text-2xl">Chat Socket Test</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Temporary debug page for socket connect/join/leave flow.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleConnect}
            disabled={!canConnect}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm disabled:opacity-60"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={!isConnected}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm disabled:opacity-60"
          >
            Disconnect
          </button>
          <span className="text-sm text-[color:var(--muted)]">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className="min-w-[220px] rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-sm"
            placeholder="channel id"
          />
          <button
            onClick={handleJoin}
            disabled={!isConnected}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm disabled:opacity-60"
          >
            Join Channel
          </button>
          <button
            onClick={handleLeave}
            disabled={!isConnected}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm disabled:opacity-60"
          >
            Leave Channel
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
          <h3 className="mb-2 text-sm text-[color:var(--muted)]">Recent Logs</h3>
          <div className="max-h-72 space-y-1 overflow-auto text-sm">
            {logs.length === 0 ? <div className="text-[color:var(--muted)]">No logs yet.</div> : null}
            {logs.map((entry, index) => (
              <div key={`${entry.time}-${index}`}>
                [{entry.time}] {entry.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
