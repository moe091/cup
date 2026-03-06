export type ChatTokenResponse = {
  token: string;
  expiresInSeconds: number;
};
export type JoinLeaveAck = {
  ok: boolean;
  channelId?: string;
  error?: string;
};