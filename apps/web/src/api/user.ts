import type { UserProfile } from "@cup/shared-types";
import { buildCsrfHeaders } from "./csrf";

type UpdateProfilePayload = {
  username?: string;
  email?: string | null;
  displayName?: string | null;
};

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

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const csrfHeaders = await buildCsrfHeaders();

  const response = await fetch("/api/users/me", {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...csrfHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to update profile."));
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
