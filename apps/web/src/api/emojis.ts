import type { EmojiCatalogResponseDto } from '@cup/shared-types';

type EmojiCatalogParams = {
  communityId?: string;
};

export async function fetchEmojiCatalog(params: EmojiCatalogParams = {}): Promise<EmojiCatalogResponseDto> {
  const query = new URLSearchParams();

  if (params.communityId !== undefined) {
    const communityId = params.communityId.trim();
    if (!communityId) {
      throw new Error('communityId cannot be empty when provided');
    }
    query.set('communityId', communityId);
  }

  const queryString = query.toString();
  const requestPath = queryString ? `/api/emojis/catalog?${queryString}` : '/api/emojis/catalog';

  const response = await fetch(requestPath, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Emoji catalog fetch failed: ${response.status}`);
  }

  return (await response.json()) as EmojiCatalogResponseDto;
}
