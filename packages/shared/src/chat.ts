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

export type ChatMessageDto = {
  id: string;
  channelId: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};
export type ChannelHistoryCursorDto = {
  beforeCreatedAt: string;
  beforeId: string;
};
export type ChannelHistoryResponseDto = {
  messages: ChatMessageDto[];
  nextCursor: ChannelHistoryCursorDto | null;
};

export type ChatSendPayload = {
  channelId: string;
  body: string;
  clientMessageId?: string;
};

export type ChatRealtimeMessage = {
  id: string;
  channelId: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string; // ISO
};

export type ChatSendAck = {
  ok: boolean;
  clientMessageId?: string;
  messageId?: string;
  error?: string;
};
