import type { ChannelKind, ChannelVisibility } from "./chat";

export type MyCommunityListItemDto = {
  id: string;
  slug: string;
  name: string;
  iconKey: string | null;
  permissionLevel: number;
  joinedAt: string; // ISO
};
export type MyCommunitiesResponseDto = MyCommunityListItemDto[];

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

export type CommunityJoinMode = "PUBLIC" | "REQUEST" | "INVITE_ONLY";

export type CreateCommunityRequestDto = {
  name: string;
  joinMode: CommunityJoinMode;
  description?: string | null;
};

export type CreateCommunityResponseDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  joinMode: CommunityJoinMode;
  iconKey: string | null;
};

export type CommunityIconUploadTargetRequestDto = {
  mimeType: string;
  sizeBytes: number;
};

export type CommunityIconUploadTargetResponseDto = {
  uploadUrl: string;
  method: "PUT";
  headers: {
    "Content-Type": string;
  };
  objectKey: string;
  expiresInSeconds: number;
};

export type UpdateCommunityIconRequestDto = {
  iconKey: string | null;
};

