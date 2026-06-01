import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCommunityBySlug, fetchCommunityChannelsBySlug } from "../../api/communities";
import MultiChannelChatPanel, { type MCCPChannel } from "./MultiChannelChatPanel";

type CommunityChatContainerProps = {
  communitySlug: string | null;
  embedded?: boolean;
};

export default function CommunityChatContainer({ communitySlug, embedded = false }: CommunityChatContainerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState<MCCPChannel[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityName, setCommunityName] = useState<string>("Unknown community");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestedChannelId = searchParams.get("channel");

  const selectedChannelId = useMemo(() => {
    if (!channels.length) {
      return null;
    }

    if (requestedChannelId && channels.some((channel) => channel.id === requestedChannelId)) {
      return requestedChannelId;
    }

    return channels[0].id;
  }, [channels, requestedChannelId]);

  useEffect(() => {
    if (!communitySlug) {
      setChannels([]);
      setCommunityId(null);
      setCommunityName("Unknown community");
      setIsLoading(false);
      setErrorMessage("Missing community slug.");
      return;
    }

    let active = true;

    const loadChannels = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setChannels([]);
      setCommunityId(null);
      setCommunityName(communitySlug);

      try {
        const [communitySummary, loadedChannels] = await Promise.all([
          fetchCommunityBySlug(communitySlug),
          fetchCommunityChannelsBySlug(communitySlug),
        ]);
        if (!active) {
          return;
        }

        setCommunityId(communitySummary.id);
        setCommunityName(communitySummary.name);

        const nextChannels: MCCPChannel[] = loadedChannels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          visibility: channel.visibility,
        }));

        setChannels(nextChannels);
      } catch (error) {
        if (!active) {
          return;
        }

        setChannels([]);
        setCommunityId(null);
        setCommunityName(communitySlug);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load channels.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadChannels();

    return () => {
      active = false;
    };
  }, [communitySlug]);

  useEffect(() => {
    if (isLoading || errorMessage) {
      return;
    }

    if (requestedChannelId === selectedChannelId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (selectedChannelId) {
      nextParams.set("channel", selectedChannelId);
    } else {
      nextParams.delete("channel");
    }

    setSearchParams(nextParams, { replace: true });
  }, [errorMessage, isLoading, requestedChannelId, searchParams, selectedChannelId, setSearchParams]);

  const handleSelectedChannelIdChange = useCallback(
    (channelId: string) => {
      if (channelId === requestedChannelId) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("channel", channelId);
      setSearchParams(nextParams);
    },
    [requestedChannelId, searchParams, setSearchParams],
  );

  if (embedded) {
    return (
      <div className="h-full min-h-0 text-[color:var(--text)]">
        <MultiChannelChatPanel
          selectedChannelId={selectedChannelId}
          onSelectedChannelIdChange={handleSelectedChannelIdChange}
          communityId={communityId}
          communitySlug={communitySlug}
          communityName={communityName}
          channels={channels}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (isLoading) {
    return <main className="h-screen w-full pt-[var(--topbar-h)] text-[color:var(--text)]" />;
  }

  if (errorMessage) {
    return (
      <main className="h-screen w-full px-6 pt-[var(--topbar-h)] text-[color:var(--text)]">
        <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-full pt-[var(--topbar-h)] text-[color:var(--text)]">
      <div className="h-full min-h-0 border-t border-[color:var(--line)]">
        <MultiChannelChatPanel
          selectedChannelId={selectedChannelId}
          onSelectedChannelIdChange={handleSelectedChannelIdChange}
          communityId={communityId}
          communitySlug={communitySlug}
          communityName={communityName}
          channels={channels}
          isLoading={isLoading}
        />
      </div>
    </main>
  );
}
