import type { ChatMessageDto, CustomEmojiDto } from '@cup/shared-types';
import { useEffect, useMemo, useState } from 'react';
import { fetchResolvedEmojisByIds } from '../../../api/emojis';
import { extractCustomEmojiIds } from '../text/chatTextProcessing';

const customEmojiCacheById = new Map<string, CustomEmojiDto | null>();
const inFlightResolutionById = new Map<string, Promise<void>>();

async function resolveUnknownEmojiIds(ids: string[]): Promise<void> {
  const unknownIds = ids.filter((id) => !customEmojiCacheById.has(id) && !inFlightResolutionById.has(id));
  if (unknownIds.length === 0) {
    return;
  }

  const request = fetchResolvedEmojisByIds(unknownIds)
    .then((resolved) => {
      const resolvedById = new Map(resolved.map((emoji) => [emoji.id, emoji]));

      for (const id of unknownIds) {
        customEmojiCacheById.set(id, resolvedById.get(id) ?? null);
      }
    })
    .finally(() => {
      for (const id of unknownIds) {
        inFlightResolutionById.delete(id);
      }
    });

  for (const id of unknownIds) {
    inFlightResolutionById.set(id, request);
  }

  await request;
}

export function useResolvedCustomEmojiMap(messages: ChatMessageDto[]): Map<string, CustomEmojiDto | null> {
  const [cacheVersion, setCacheVersion] = useState(0);

  const requiredIds = useMemo(() => {
    const unique = new Set<string>();

    for (const message of messages) {
      const ids = extractCustomEmojiIds(message.body);
      for (const id of ids) {
        unique.add(id);
      }
    }

    return Array.from(unique).sort();
  }, [messages]);

  useEffect(() => {
    if (requiredIds.length === 0) {
      return;
    }

    let active = true;

    const resolve = async () => {
      await resolveUnknownEmojiIds(requiredIds);
      if (active) {
        setCacheVersion((version) => version + 1);
      }
    };

    void resolve();

    return () => {
      active = false;
    };
  }, [requiredIds]);

  return useMemo(() => {
    const version = cacheVersion;
    const resolved = new Map<string, CustomEmojiDto | null>();

    for (const id of requiredIds) {
      if (customEmojiCacheById.has(id)) {
        resolved.set(id, customEmojiCacheById.get(id) ?? null);
      }
    }

    void version;
    return resolved;
  }, [requiredIds, cacheVersion]);
}
