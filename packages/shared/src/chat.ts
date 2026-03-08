export type ChatTokenResponse = {
  token: string;
  expiresInSeconds: number;
};

export type JoinLeaveAck = {
  ok: boolean;
  channelId?: string;
  error?: string;
};

export type ChannelKind = "COMMUNITY" | "DM" | "GAME_PAGE" | "ROOM";
export type ChannelVisibility = "PUBLIC" | "PRIVATE";
export type CommunitySummaryDto = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  createdAt: string;
  channelCount: number;
};
export type CommunityChannelDto = {
  id: string;
  name: string;
  kind: ChannelKind;
  visibility: ChannelVisibility;
  createdAt: string;
};
