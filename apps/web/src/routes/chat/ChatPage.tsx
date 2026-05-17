import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import type { MyCommunitiesResponseDto } from "@cup/shared-types"; 
import { useCallback, useEffect, useState } from "react";
import { fetchMyCommunities } from "../../api/communities";
import CommunitiesSidebar from "../../features/chat/CommunitiesSidebar";
import CommunityChatContainer from "../../features/chat/CommunityChatContainer";
import { LoginModal, type AuthMode } from "../../auth/LoginModal";
import CreateCommunityModal from "../../features/communities/CreateCommunityModal";
import type { CreateCommunityResponseDto } from "@cup/shared-types";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const [communities, setCommunities] = useState<MyCommunitiesResponseDto>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialMode, setLoginModalInitialMode] = useState<AuthMode>("login");
  const [isCreateCommunityModalOpen, setIsCreateCommunityModalOpen] = useState(false);
  const [communityCreateWarning, setCommunityCreateWarning] = useState<string | null>(null);

  const openLoginModal = () => {
    setLoginModalInitialMode("login");
    setIsLoginModalOpen(true);
  };

  const openSignupModal = () => {
    setLoginModalInitialMode("signup");
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const openCreateCommunityModal = () => {
    setIsCreateCommunityModalOpen(true);
  };

  const closeCreateCommunityModal = () => {
    setIsCreateCommunityModalOpen(false);
  };

  const handleCommunityCreated = useCallback(async (createdCommunity: CreateCommunityResponseDto, warningMessage?: string) => {
    const refreshed = await fetchMyCommunities();
    setCommunities(refreshed);

    if (warningMessage) {
      setCommunityCreateWarning(warningMessage);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("community", createdCommunity.slug);
    nextParams.delete("channel");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  //effect to fetch community list for current user
  useEffect(() => { 
    if (!user) { //not logged in, don't try to fetch communities
      return;
    }
    let active = true;

    const load = async () => {
      try {
        const data = await fetchMyCommunities();
        if (!active) return; //active is set to false in dismount, if we have dismounted while req was loading then don't do anything, state will be stale

        setCommunities(data);
      } catch {
        if (!active) return;
        setCommunities([]);
      }
    };

    void load();

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

  const selectedCommSlug = searchParams.get("community") ?? communities[0]?.slug ?? null;

  //if no slug exists in url but user has communities, set url to first community
  useEffect(() => {
    if (!communities.length) {
      return;
    }

    const requestedSlug = searchParams.get("community");
    if (requestedSlug) {
      return;
    }

    const fallbackSlug = communities[0].slug;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("community", fallbackSlug);
    nextParams.delete("channel");
    setSearchParams(nextParams, { replace: true });
  }, [communities, searchParams, setSearchParams]);
  
  
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openLoginModal}
                className="cursor-pointer rounded-full px-5 py-2 text-sm text-[color:var(--text)] transition hover:text-[color:var(--muted)]"
              >
                Login
              </button>
              <button
                type="button"
                onClick={openSignupModal}
                className="cursor-pointer rounded-full px-5 py-2 text-sm text-[color:var(--text)] transition hover:text-[color:var(--muted)]"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={closeLoginModal}
          initialMode={loginModalInitialMode}
        />
      </main>
    );
  }
  return (
    <main className="h-screen w-full bg-[#111317] pt-[var(--topbar-h)] overflow-hidden text-[color:var(--text)]">
      <div className="flex h-full min-h-0 w-full">
        {/* Left rail */}
        <aside className="h-full w-16 shrink-0 bg-black px-2.5 pt-2.5">
          <CommunitiesSidebar
            communities={communities}
            selectedCommSlug={selectedCommSlug}
            onSelectCommunity={onSelectCommunity}
            onCreateCommunityClick={openCreateCommunityModal}
          />
        </aside>
        {/* Right content area */}
        <section className="h-full min-w-0 flex-1">
          {communityCreateWarning ? (
            <div className="mx-4 mt-3 rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
              {communityCreateWarning}
            </div>
          ) : null}
          {selectedCommSlug ? (
            <CommunityChatContainer communitySlug={selectedCommSlug} embedded />
          ) : (
            null
          )}
        </section>
      </div>
      <CreateCommunityModal
        isOpen={isCreateCommunityModalOpen}
        onClose={closeCreateCommunityModal}
        onCreated={handleCommunityCreated}
      />
    </main>
  );
}
