import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import MultiChannelChatPanel, { type MCCPChannel } from "../../features/chat/MultiChannelChatPanel";
import { fetchCommunityChannelsBySlug } from "../../api/communities";

type Params = { slug: string };

export default function CommunityChatPage() {
  const { slug } = useParams<Params>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState<MCCPChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const communityName = slug ?? "Unknown community";

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
    if (!slug) {
      setChannels([]);
      setIsLoading(false);
      setErrorMessage("Missing community slug.");
      return;
    }

    let active = true;

    const loadChannels = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const loadedChannels = await fetchCommunityChannelsBySlug(slug);
        if (!active) {
          return;
        }

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
  }, [slug]);

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

  if (isLoading) {
    return <main className="h-screen w-full pt-[57px] text-[color:var(--text)]" />;
  }

  if (errorMessage) {
    return (
      <main className="h-screen w-full px-6 pt-[57px] text-[color:var(--text)]">
        <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-full pt-[57px] text-[color:var(--text)]">
      <div className="h-full min-h-0 border-t border-[color:var(--line)]">
        <MultiChannelChatPanel
          selectedChannelId={selectedChannelId}
          onSelectedChannelIdChange={handleSelectedChannelIdChange}
          communityName={communityName}
          channels={channels}
        />
      </div>
    </main>
  );
}
