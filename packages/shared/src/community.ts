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