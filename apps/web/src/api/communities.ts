import type { CommunityChannelDto, CommunitySummaryDto } from "@cup/shared-types";

export async function fetchCommunityBySlug(slug: string): Promise<CommunitySummaryDto> {
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Community summary fetch failed: ${response.status}`);
  }

  return (await response.json()) as CommunitySummaryDto;
}

export async function fetchCommunityChannelsBySlug(slug: string): Promise<CommunityChannelDto[]> {
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/channels`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Community channels fetch failed: ${response.status}`);
  }

  return (await response.json()) as CommunityChannelDto[];
}
