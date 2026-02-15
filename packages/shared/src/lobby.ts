export type LobbyCreateResponse = {
  matchId: string;
  socketUrl: string;
};

export type LobbyJoinResponse = LobbyCreateResponse & {
  ticket: string;
}