import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { SpellDuelApp } from './SpellDuelApp.js';

export interface SpellDuelConnection {
  disconnect(): void;
}

export function connectSpellDuel(
  socketUrl: string,
  ticket: string,
  containerEl: HTMLElement,
): SpellDuelConnection {
  const socket = io(socketUrl, {
    auth: { ticket },
    path: '/gameserver/spellduel/socket.io',
  });

  const root = createRoot(containerEl);
  root.render(createElement(SpellDuelApp, { socket }));

  return {
    disconnect() {
      socket.disconnect();
      root.unmount();
    },
  };
}
