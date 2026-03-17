export type CustomEmojiScopeType = 'GLOBAL' | 'COMMUNITY' | 'USER';

export type CustomEmojiDto = {
  id: string;
  name: string;
  scopeType: CustomEmojiScopeType;
  scopeId: string | null;
  assetUrl: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type EmojiCatalogResponseDto = {
  emojis: CustomEmojiDto[];
};
