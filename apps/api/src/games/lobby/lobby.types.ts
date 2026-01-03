// create a 'lobbyInfo' type here to represent data needed for a lobby
import type { Lobby, Prisma } from 'src/generated/prisma/client';


export type LobbyJoinResponse = Pick<Lobby, 'matchId' | 'socketUrl'>;

export type CreateLobbyInput = Pick<
  Prisma.LobbyUncheckedCreateInput,
  'gameId' | 'socketUrl' | 'maxPlayers' | 'createdByUserId' | 'meta' | 'expiresAt'
>;