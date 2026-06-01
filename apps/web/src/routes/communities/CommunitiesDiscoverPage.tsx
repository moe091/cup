import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { PublicCommunityListItemDto } from '@cup/shared-types';
import { fetchPublicCommunities, joinCommunityBySlug } from '../../api/communities';
import { useAuth } from '../../auth';
import { buildS3AssetUrl } from '../../config/s3';

const PAGE_SIZE = 20;

export default function CommunitiesDiscoverPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [items, setItems] = useState<PublicCommunityListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchPublicCommunities({
        search,
        limit: PAGE_SIZE,
      });
      setItems(response.items);
      setNextCursor(response.nextCursor);
    } catch {
      setError('Failed to load communities.');
      setItems([]);
      setNextCursor(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage(activeSearch);
  }, [activeSearch, loadFirstPage]);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const onLoadMore = async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await fetchPublicCommunities({
        search: activeSearch,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch {
      setError('Failed to load more communities.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const onJoinCommunity = async (slug: string) => {
    if (!user || joiningSlug) {
      return;
    }

    setJoiningSlug(slug);
    setError(null);
    try {
      const result = await joinCommunityBySlug(slug);
      setItems((prev) =>
        prev.map((item) =>
          item.slug === slug
            ? {
              ...item,
              joinedByMe: true,
              memberCount: result.joined ? item.memberCount + 1 : item.memberCount,
            }
            : item,
        ),
      );
    } catch {
      setError('Failed to join community.');
    } finally {
      setJoiningSlug(null);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#111317] px-6 pt-[calc(var(--topbar-h)+1rem)] text-[color:var(--text)]">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Discover Communities</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Browse public communities and find a new place to chill
          </p>
        </header>

        <form onSubmit={onSearchSubmit} className="mb-4 flex items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by community name or description"
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--text)]"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 text-sm transition hover:border-[color:var(--text)]"
          >
            Search
          </button>
        </form>

        {!isAuthLoading && !user ? (
          <div className="mb-4 rounded-md bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--muted)]">
            Sign up or login to join communities
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 text-sm text-[color:var(--muted)]">
            Loading communities...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 text-sm text-[color:var(--muted)]">
            No communities found.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((community) => (
              <article
                key={community.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {community.iconKey ? (
                    <img
                      src={buildS3AssetUrl(community.iconKey) ?? ''}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2d3442] text-sm font-semibold uppercase">
                      {community.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-medium">
                      <Link
                        to={`/communities/${encodeURIComponent(community.slug)}`}
                        className="transition hover:text-[color:var(--muted)]"
                      >
                        {community.name}
                      </Link>
                    </h2>
                    <p className="truncate text-xs text-[color:var(--muted)]">
                      {community.description ?? 'No description yet'}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                      {community.memberCount} members
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {community.joinedByMe ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-green-400/70">Already joined</span>
                      <Link
                        to={`/chat?community=${encodeURIComponent(community.slug)}`}
                        className="rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs transition hover:border-[color:var(--text)]"
                      >
                        Open Chat
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onJoinCommunity(community.slug)}
                      disabled={!user || joiningSlug === community.slug}
                      className="cursor-pointer rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs transition hover:border-[color:var(--text)] disabled:cursor-default disabled:text-[color:var(--muted)] disabled:hover:border-[color:var(--line)]"
                    >
                      {joiningSlug === community.slug ? 'Joining...' : 'Join'}
                    </button>
                  )}
                </div>
              </article>
            ))}

            {nextCursor ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="cursor-pointer rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 text-sm transition hover:border-[color:var(--text)] disabled:cursor-default disabled:opacity-60"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
