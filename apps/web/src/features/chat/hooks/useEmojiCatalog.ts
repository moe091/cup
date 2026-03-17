import type { CustomEmojiDto } from '@cup/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { fetchEmojiCatalog } from '../../../api/emojis';

type UseEmojiCatalogArgs = {
  communityId: string | null;
};

type UseEmojiCatalogResult = {
  emojis: CustomEmojiDto[];
  isLoading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
};

type EmojiCatalogCacheEntry = {
  emojis: CustomEmojiDto[];
  fetchedAtMs: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const emojiCatalogCache = new Map<string, EmojiCatalogCacheEntry>();

function toCacheKey(communityId: string | null): string {
  return communityId ?? '__none__';
}

function isFresh(entry: EmojiCatalogCacheEntry): boolean {
  return Date.now() - entry.fetchedAtMs < CACHE_TTL_MS;
}

export function useEmojiCatalog({ communityId }: UseEmojiCatalogArgs): UseEmojiCatalogResult {
  const [emojis, setEmojis] = useState<CustomEmojiDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (bypassCache: boolean): Promise<void> => {
      const cacheKey = toCacheKey(communityId);
      const cachedEntry = emojiCatalogCache.get(cacheKey);

      if (!bypassCache && cachedEntry && isFresh(cachedEntry)) {
        setEmojis(cachedEntry.emojis);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchEmojiCatalog({
          communityId: communityId ?? undefined,
        });

        emojiCatalogCache.set(cacheKey, {
          emojis: response.emojis,
          fetchedAtMs: Date.now(),
        });

        setEmojis(response.emojis);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load emoji catalog');
      } finally {
        setIsLoading(false);
      }
    },
    [communityId],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      const cacheKey = toCacheKey(communityId);
      const cachedEntry = emojiCatalogCache.get(cacheKey);

      if (cachedEntry && isFresh(cachedEntry)) {
        if (!active) {
          return;
        }

        setEmojis(cachedEntry.emojis);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      if (!active) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchEmojiCatalog({
          communityId: communityId ?? undefined,
        });

        if (!active) {
          return;
        }

        emojiCatalogCache.set(cacheKey, {
          emojis: response.emojis,
          fetchedAtMs: Date.now(),
        });

        setEmojis(response.emojis);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load emoji catalog');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [communityId]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadCatalog(true);
  }, [loadCatalog]);

  return {
    emojis,
    isLoading,
    errorMessage,
    refresh,
  };
}
