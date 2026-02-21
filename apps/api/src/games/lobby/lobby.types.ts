import type { Prisma } from 'src/generated/prisma/client';
//enum LobbyStatus {OPEN, IN_PROGRESS, ENDED, EXPIRED} - for

export type { LobbyJoinResponse } from '@cup/shared-types';

export type LobbyTicketPayload = {
  sub: string;
  gameId: string;
  matchId: string;
  role: 'creator' | 'player' | 'spectator';
  displayName?: string;
};

export type CreateLobbyInput = Pick<
  Prisma.LobbyUncheckedCreateInput,
  'gameId' | 'socketUrl' | 'maxPlayers' | 'createdByUserId' | 'createdByGuestId' | 'meta' | 'expiresAt'
>;
