import type { Prisma } from 'src/generated/prisma/client';
//enum LobbyStatus {OPEN, IN_PROGRESS, ENDED, EXPIRED} - for

export type { LobbyJoinResponse } from '@cup/shared-types';

export type CreateLobbyInput = Pick<
  Prisma.LobbyUncheckedCreateInput,
  'gameId' | 'socketUrl' | 'maxPlayers' | 'createdByUserId' | 'meta' | 'expiresAt'
>;
