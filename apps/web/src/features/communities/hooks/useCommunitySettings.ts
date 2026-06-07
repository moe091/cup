import { useEffect, useState } from "react";
import type { CommunityPermissionConfig } from "@cup/shared-types";
import { fetchCommunitySettingsBySlug } from "../../../api/communities";

export type UseCommunitySettingsResult = {
  viewerPermissionLevel: number;
  permissionConfig: CommunityPermissionConfig | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useCommunitySettings(communitySlug: string | null): UseCommunitySettingsResult {
  const [viewerPermissionLevel, setViewerPermissionLevel] = useState(0);
  const [permissionConfig, setPermissionConfig] = useState<CommunityPermissionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  //when communitySlug changes fetch permission info from communities settings endpoint and update state with perms
  useEffect(() => {
    if (!communitySlug) {
      setViewerPermissionLevel(0);
      setPermissionConfig(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setViewerPermissionLevel(0);
      setPermissionConfig(null);

      try {
        const settings = await fetchCommunitySettingsBySlug(communitySlug);
        if (!active) return;

        setViewerPermissionLevel(settings.viewerPermissionLevel);
        setPermissionConfig(settings.permissionConfig);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community settings.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [communitySlug]);

  return {
    viewerPermissionLevel,
    permissionConfig,
    isLoading,
    errorMessage,
  };
}
