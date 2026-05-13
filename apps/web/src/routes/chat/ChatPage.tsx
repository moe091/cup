import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import type { MyCommunitiesResponseDto } from "@cup/shared-types"; 
import { useCallback, useEffect, useState } from "react";
import { fetchMyCommunities } from "../../api/communities";
import CommunitiesSidebar from "../../features/chat/CommunitiesSidebar";
import CommunityChatContainer from "../../features/chat/CommunityChatContainer";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const [communities, setCommunities] = useState<MyCommunitiesResponseDto>([]);
  const [isCommsLoading, setIsCommsLoading] = useState<boolean>(false);
  const [commsErrorMsg, setCommsErrorMsg] = useState<string | null>(null);
  const [selectedCommSlug, setSelectedCommSlug] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  //effect to fetch community list for current user
  useEffect(() => { 
    if (!user) { //not logged in, don't try to fetch communities
      setCommunities([]);
      setIsCommsLoading(false);
      return;
    }
    let active = true;

    const load = async () => {
      setIsCommsLoading(true);
      setCommsErrorMsg(null);

      try {
        const data = await fetchMyCommunities();
        if (!active) return; //active is set to false in dismount, if we have dismounted while req was loading then don't do anything, state will be stale

        setCommunities(data);
        console.log("COMS: ", communities);
      } catch (error) {
        if (!active) return;
        setCommsErrorMsg(error instanceof Error ? error.message : "Failed to load communities");
        setCommunities([]);
      } finally {
        if (active) setIsCommsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [user]);

  //passed into CommunitiesSidebar, called with community slug when user clicks on a community. This only updates URL params, the ChatPage component will react to searchParams change and render accordingly
  const onSelectCommunity = useCallback((slug: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("community", slug);
    nextParams.delete("channel");
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);


  //updates selectedCommSlug based on url params(url params are set by the effect above, in response to callback function called when user clicks a comm in the comm sidebar)
  useEffect(() => {
    if (!communities.length) {
      setSelectedCommSlug(null);
      return;
    }

    //if we have a slug in URL just set it then return
    const requestedSlug = searchParams.get("community");
    if (requestedSlug) {
      if (selectedCommSlug !== requestedSlug) {
        setSelectedCommSlug(requestedSlug);
      }
      return;
    }

    //if we don't have a slug use a fallback(first community in list)
    const fallbackSlug = communities[0].slug;
    if (selectedCommSlug !== fallbackSlug) {
      setSelectedCommSlug(fallbackSlug);
    }

    //then update the search params to reflect current state
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("community", fallbackSlug);
    nextParams.delete("channel");
    setSearchParams(nextParams, { replace: true });
  }, [communities, searchParams, selectedCommSlug, setSearchParams]);
  
  
  if (isLoading) {
    return <main className="min-h-screen w-full bg-[#111317] px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]" />;
  }

  if (!user) {
    return (
      <main className="min-h-screen w-full bg-[#111317] px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl bg-[color:var(--panel)]/90 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Log in to view your communities and DMs.
          </p>
          <div className="mt-5">
            <Link
              to="/"
              className="inline-flex rounded-full px-5 py-2 text-sm text-[color:var(--text)] transition hover:text-[color:var(--muted)]"
            >
              Go to Home to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="h-screen w-full bg-[#111317] pt-[var(--topbar-h)] overflow-hidden text-[color:var(--text)]">
      <div className="flex h-full min-h-0 w-full">
        {/* Left rail */}
        <aside className="h-full w-16 shrink-0 bg-black pl-2.5 pt-2.5">
          <CommunitiesSidebar
            communities={communities}
            isCommsLoading={isCommsLoading}
            commsErrorMsg={commsErrorMsg}
            selectedCommSlug={selectedCommSlug}
            onSelectCommunity={onSelectCommunity}
          />
        </aside>
        {/* Right content area */}
        <section className="h-full min-w-0 flex-1">
          {selectedCommSlug ? (
            <CommunityChatContainer communitySlug={selectedCommSlug} embedded />
          ) : (
            null
          )}
        </section>
      </div>
    </main>
  );
}
