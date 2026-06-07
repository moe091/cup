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

export type CommunityPermissionConfig = {
  createChannel: number;
  editChannelName: number;
  deleteChannel: number;
  editGeneral: number;
};

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

export type GetPublicCommunitiesQueryDto = {
  search?: string;
  limit?: number | string;
  cursor?: string;
};

export type PublicCommunityListItemDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  joinMode: CommunityJoinMode;
  iconKey: string | null;
  createdAt: string;
  memberCount: number;
  joinedByMe: boolean;
};

export type PublicCommunitiesResponseDto = {
  items: PublicCommunityListItemDto[];
  nextCursor: string | null;
};

export type JoinCommunityResponseDto = {
  communityId: string;
  slug: string;
  joined: boolean;
};

export type LeaveCommunityResponseDto = {
  communityId: string;
  slug: string;
  left: boolean;
};

export type DeleteCommunityResponseDto = {
  communityId: string;
  slug: string;
  deleted: boolean;
};

export type CommunitySettingsDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  joinMode: CommunityJoinMode;
  iconKey: string | null;
  permissionConfig: CommunityPermissionConfig;
  viewerPermissionLevel: number;
  canEditGeneral: boolean;
};

export type UpdateCommunitySettingsRequestDto = {
  name: string;
  description?: string | null;
  joinMode: CommunityJoinMode;
};

export type CreateChannelRequestDTO = {
  name: string;
  requiredPermissionLevel: number;
}

export type CreateChannelResponseDTO = {
  id: string;
  name: string;
  requiredPermissionLevel: number;
  createdAt: string; // ISO
}

export type UpdateChannelRequestDTO = {
  name: string;
}

export type UpdateChannelResponseDTO = {
  id: string;
  name: string;
  requiredPermissionLevel: number;
  createdAt: string; // ISO
}

export type DeleteChannelResponseDTO = {
  id: string;
  deleted: boolean;
}
