import type { UserProfile } from "@cup/shared-types";
import { buildCsrfHeaders } from "./csrf";
import type { AvatarUploadTargetRequest, AvatarUploadTargetResponse } from "@cup/shared-types";


export async function requestAvatarUploadTarget(payload: AvatarUploadTargetRequest): Promise<AvatarUploadTargetResponse> {
  const csrfHeaders = await buildCsrfHeaders();

  const response = await fetch("/api/users/me/avatar/upload-target", {
    method: "POST",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok)
    throw new Error(await readErrorMessage(response, "Failed to get avatar upload target")); //should I throw a better error here? does it matter?

  return (await response.json()) as AvatarUploadTargetResponse;
}

export async function updateMyUsername(username: string): Promise<UserProfile> {
  return patchUserProfileEndpoint("/api/users/me/username", { username }, "Failed to update username.");
}

export async function updateMyDisplayName(displayName: string | null): Promise<UserProfile> {
  return patchUserProfileEndpoint("/api/users/me/display-name", { displayName }, "Failed to update display name.");
}

export async function updateMyEmail(email: string | null): Promise<UserProfile> {
  return patchUserProfileEndpoint("/api/users/me/email", { email }, "Failed to update email.");
}

export async function updateMyAvatarKey(avatarKey: string | null): Promise<UserProfile> {
  return patchUserProfileEndpoint("/api/users/me/avatar", { avatarKey }, "Failed to update profile picture.");
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const response = await fetch("/api/users/me", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to load profile."));
  }

  return (await response.json()) as UserProfile;
}

async function patchUserProfileEndpoint(endpoint: string, payload: unknown, fallbackMessage: string): Promise<UserProfile> {
  const csrfHeaders = await buildCsrfHeaders();

  const response = await fetch(endpoint, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as UserProfile;
}

async function readErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message) && data.message.length > 0) {
      return data.message[0];
    }

    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}
