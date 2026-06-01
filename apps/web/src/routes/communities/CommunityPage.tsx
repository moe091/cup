import type { CommunitySummaryDto } from "@cup/shared-types";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchCommunityBySlug, fetchMyCommunities, joinCommunityBySlug } from "../../api/communities";
import { useAuth } from "../../auth";

type Params = { slug: string };

export default function Community() {
  const { slug } = useParams<Params>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [commSummary, setCommSummary] = useState<CommunitySummaryDto | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isInvitePage = searchParams.get("invite") === "true";

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setErrorMessage("Missing community slug");
      return;
    }

    let active = true;

    setIsLoading(true);
    setErrorMessage(null);
    setCommSummary(null);

    const load = async () => {
      try {
        const [data, myCommunities] = await Promise.all([
          fetchCommunityBySlug(slug),
          user ? fetchMyCommunities() : Promise.resolve([]),
        ]);
        if (!active) return;
        setCommSummary(data);
        setIsMember(myCommunities.some((community) => community.slug === slug));
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [slug, user]);

  const onJoinCommunity = async () => {
    if (!slug || !user || isJoining || isMember) {
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);
    try {
      await joinCommunityBySlug(slug);
      setIsMember(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to join community");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]" />;
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
          {errorMessage}
        </div>
      </main>
    );
  }

  if (!commSummary) {
    return <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]" />;
  }

  const createdAtFormatted = new Date(commSummary.createdAt).toLocaleDateString();

  return (
    <main className="min-h-screen w-full px-6 pt-[calc(var(--topbar-h)+2rem)] text-[color:var(--text)]">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/90 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Community</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{commSummary.name}</h1>

        <div className="mt-5 grid gap-4">
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Owner</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--text)]">{commSummary.ownerDisplayName || "Unknown"}</p>
          </div>

          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Description</p>
            <p className="mt-1 text-sm text-[color:var(--text)]">{commSummary.description || "No description yet."}</p>
          </div>

          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Created</p>
            <p className="mt-1 text-sm text-[color:var(--text)]">{createdAtFormatted}</p>
          </div>
        </div>

        <div className="mt-6">
          {isInvitePage && !isMember ? (
            <p className="mb-3 text-sm font-medium text-[color:var(--text)]">
              You&apos;ve been invited!
            </p>
          ) : null}
          {user ? (
            isMember ? (
              <Link
                to={`/chat?community=${encodeURIComponent(commSummary.slug)}`}
                className="inline-flex rounded-full border border-[color:var(--line)] px-5 py-2 text-sm text-[color:var(--text)] transition hover:border-[color:var(--text)]"
              >
                Open Chat
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void onJoinCommunity()}
                disabled={isJoining}
                className={`inline-flex rounded-full px-5 py-2 text-sm text-[color:var(--text)] transition ${
                  isInvitePage
                    ? "border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                    : "border border-[color:var(--line)] hover:border-[color:var(--text)]"
                } ${isJoining ? "cursor-default opacity-70" : "cursor-pointer"}`}
              >
                {isJoining ? "Joining..." : "Join"}
              </button>
            )
          ) : (
            <p className="text-sm text-[color:var(--muted)]">Log in to join this community.</p>
          )}
          <p className="mt-2 text-xs text-[color:var(--muted)]">{commSummary.channelCount} channel(s) available</p>
        </div>
      </div>
    </main>
  );
}
