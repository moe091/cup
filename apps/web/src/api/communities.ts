import type {
  CommunityChannelDto,
  CommunitySettingsDto,
  CommunitySummaryDto,
  CreateCommunityRequestDto,
  CreateCommunityResponseDto,
  DeleteCommunityResponseDto,
  GetPublicCommunitiesQueryDto,
  JoinCommunityResponseDto,
  LeaveCommunityResponseDto,
  MyCommunitiesResponseDto,
  CommunityIconUploadTargetRequestDto,
  CommunityIconUploadTargetResponseDto,
  PublicCommunitiesResponseDto,
  UpdateCommunityIconRequestDto,
  UpdateCommunitySettingsRequestDto,
  CreateChannelRequestDTO,
  CreateChannelResponseDTO,
  UpdateChannelRequestDTO,
  UpdateChannelResponseDTO,
  DeleteChannelResponseDTO,
} from "@cup/shared-types";
import { buildCsrfHeaders } from "./csrf";

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

export async function fetchCommunitySettingsBySlug(slug: string): Promise<CommunitySettingsDto> {
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/settings`, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Community settings fetch failed: ${response.status}`);
  }

  return (await response.json()) as CommunitySettingsDto;
}

export async function updateCommunitySettingsBySlug(
  slug: string,
  payload: UpdateCommunitySettingsRequestDto,
): Promise<CommunitySettingsDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/settings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...csrfHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to update community settings.'));
  }

  return (await response.json()) as CommunitySettingsDto;
}


export async function fetchMyCommunities(): Promise<MyCommunitiesResponseDto> {
  const response = await fetch('/api/communities/me', {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch your community list: ${response.status}`);
  }

  return (await response.json()) as MyCommunitiesResponseDto;
}

export async function fetchPublicCommunities(query: GetPublicCommunitiesQueryDto): Promise<PublicCommunitiesResponseDto> {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.cursor) {
    params.set('cursor', query.cursor);
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/api/communities/public?${queryString}`
    : '/api/communities/public';

  const response = await fetch(endpoint, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public communities: ${response.status}`);
  }

  return (await response.json()) as PublicCommunitiesResponseDto;
}

export async function joinCommunityBySlug(slug: string): Promise<JoinCommunityResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...csrfHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to join community.'));
  }

  return (await response.json()) as JoinCommunityResponseDto;
}

export async function leaveCommunityBySlug(slug: string): Promise<LeaveCommunityResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/leave`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...csrfHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to leave community.'));
  }

  return (await response.json()) as LeaveCommunityResponseDto;
}

export async function deleteCommunityBySlug(slug: string): Promise<DeleteCommunityResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...csrfHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to delete community.'));
  }

  return (await response.json()) as DeleteCommunityResponseDto;
}

export async function createCommunity(payload: CreateCommunityRequestDto): Promise<CreateCommunityResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();

  const response = await fetch('/api/communities', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...csrfHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to create community.'));
  }

  return (await response.json()) as CreateCommunityResponseDto;
}

//request s3 target for uploading community icon. TODO:: create a generic s3 helper func for image uploads that takes the path as an arg, when I add more img uploads they will use the same logic
export async function requestCommunityIconUploadTarget(communityId: string, payload: CommunityIconUploadTargetRequestDto): Promise<CommunityIconUploadTargetResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(communityId)}/icon/upload-target`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to get community icon upload target."));
  }
  return (await response.json()) as CommunityIconUploadTargetResponseDto;
}

//after successful community icon upload to s3, we need to notify backend so it can add the iconKey to the DB. If upload fails, we simply don't send this request, we can show a frontend err msg but iconKey is nullable and has good fallback behavior so backend doesn't care
export async function updateCommunityIconKey(communityId: string, payload: UpdateCommunityIconRequestDto): Promise<CreateCommunityResponseDto> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(communityId)}/icon`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update community icon."));
  }
  return (await response.json()) as CreateCommunityResponseDto;
}

export async function createCommunityChannel(slug: string, payload: CreateChannelRequestDTO): Promise<CreateChannelResponseDTO> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/channels`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to create channel."));
  }
  return (await response.json()) as CreateChannelResponseDTO;
}

export async function updateCommunityChannel(slug: string, channelId: string, payload: UpdateChannelRequestDTO): Promise<UpdateChannelResponseDTO> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/channels/${encodeURIComponent(channelId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update channel."));
  }
  return (await response.json()) as UpdateChannelResponseDTO;
}

export async function deleteCommunityChannel(slug: string, channelId: string): Promise<DeleteChannelResponseDTO> {
  const csrfHeaders = await buildCsrfHeaders();
  const response = await fetch(`/api/communities/${encodeURIComponent(slug)}/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      ...csrfHeaders,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to delete channel."));
  }
  return (await response.json()) as DeleteChannelResponseDTO;
}


async function readErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(data.message) && data.message.length > 0) {
      return data.message[0];
    }

    if (typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
