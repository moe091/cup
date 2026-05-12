import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import type { MyCommunitiesResponseDto } from "@cup/shared-types";
import { useCallback, useEffect, useState } from "react";
import { fetchMyCommunities } from "../../api/communities";
import CommunitiesSidebar from "../../features/chat/CommunitiesSidebar";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const [communities, setCommunities] = useState<MyCommunitiesResponseDto>([]);
  const [isCommsLoading, setIsCommsLoading] = useState<boolean>(false);
  const [commsErrorMsg, setCommsErrorMsg] = useState<string | null>(null);
  const [selectedCommSlug, setSelectedCommSlug] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  //effect to fetch community list for current user. deps: []
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
    nextParams.set("kind", "community"); //NOTE:: this is temporary since I only have 1 'kind' so far, eventually I'll need to support 'DM' and possibly other kinds and will need to set it correctly
    nextParams.set("community", slug);
    nextParams.delete("channel");
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);
  
  
  if (isLoading) {
    return <main className="min-h-screen w-full px-6 pt-24 text-[color:var(--text)]" />;
  }

  type CommunitiesSidebarProps = {
    communities: MyCommunitiesResponseDto;
    isCommsLoading: boolean;
    commsErrorMsg: string | null;
    selectedCommSlug: string | null;
    onSelectCommunity: (slug: string) => void;
  }


  if (!user) {
    return (
      <main className="min-h-screen w-full px-6 pt-24 text-[color:var(--text)]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/90 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Log in to view your communities and DMs.
          </p>
          <div className="mt-5">
            <Link
              to="/"
              className="inline-flex rounded-full border border-[color:var(--line)] px-5 py-2 text-sm text-[color:var(--text)] transition hover:border-[color:var(--text)]"
            >
              Go to Home to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="h-screen w-full pt-[57px] overflow-hidden text-[color:var(--text)]">
      <div className="flex h-full min-h-0 w-full">
        {/* Left rail, list of communities */}
        <aside className="h-full w-16 shrink-0">
          <CommunitiesSidebar
            communities={communities}
            isCommsLoading={isCommsLoading}
            commsErrorMsg={commsErrorMsg}
            selectedCommSlug={selectedCommSlug}
            onSelectCommunity={onSelectCommunity}
          />
        </aside>
        
        {/* Main content area, where the actual chat component goes */}
        <section className="h-full min-w-0 flex-1">
          <div className="h-full min-h-0 border-l border-[color:var(--line)]">
            {/* placeholder for now; later MCCP goes here */}
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
              Chat goes here
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}