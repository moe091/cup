import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { MyCommunitiesResponseDto } from "@cup/shared-types";
import { Link } from "react-router-dom";
import { buildS3AssetUrl } from "../../config/s3";

const FALLBACK_ICON_BG_CLASSES = [
  "bg-[#3b2f5a]",
  "bg-[#2f4f5a]",
  "bg-[#5a3430]",
  "bg-[#2f5a43]",
  "bg-[#5a2f44]",
  "bg-[#3a4b63]",
] as const;

function getFallbackIconBgClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_ICON_BG_CLASSES[hash % FALLBACK_ICON_BG_CLASSES.length];
}

type CommunitiesSidebarProps = {
  communities: MyCommunitiesResponseDto;
  selectedCommSlug: string | null;
  onSelectCommunity: (slug: string) => void;
  onCreateCommunityClick: () => void;
  onLeaveCommunity: (slug: string) => Promise<void>;
  onRequestDeleteCommunity: (community: { slug: string; name: string }) => void;
  onNotice: (message: string) => void;
};

export default function CommunitiesSidebar({
  communities,
  selectedCommSlug,
  onSelectCommunity,
  onCreateCommunityClick,
  onLeaveCommunity,
  onRequestDeleteCommunity,
  onNotice,
}: CommunitiesSidebarProps) {
  const [tooltip, setTooltip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);

  const showTooltip = (label: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const [contextMenu, setContextMenu] = useState<{
    slug: string;
    name: string;
    permissionLevel: number;
    x: number;
    y: number;
  } | null>(null);
  const [isLeavingSlug, setIsLeavingSlug] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!contextMenuRef.current) {
        return;
      }
      if (!contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [contextMenu]);

  const onCommunityContextMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    slug: string,
    name: string,
    permissionLevel: number,
  ) => {
    event.preventDefault();
    hideTooltip();
    setContextMenu({ slug, name, permissionLevel, x: event.clientX, y: event.clientY });
  };

  const onCopyInviteLink = async () => {
    if (!contextMenu) {
      return;
    }

    const inviteUrl = `${window.location.origin}/chat?community=${encodeURIComponent(contextMenu.slug)}&invite=${encodeURIComponent(contextMenu.slug)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      onNotice('Invite link copied.');
    } catch {
      onNotice('Failed to copy invite link.');
    }
    setContextMenu(null);
  };

  const onLeaveServer = async () => {
    if (!contextMenu || isLeavingSlug) {
      return;
    }

    const confirmed = window.confirm(`Leave ${contextMenu.name}?`);
    if (!confirmed) {
      return;
    }

    setIsLeavingSlug(contextMenu.slug);
    try {
      await onLeaveCommunity(contextMenu.slug);
      onNotice('Community left.');
      setContextMenu(null);
    } finally {
      setIsLeavingSlug(null);
    }
  };

  const onDeleteServer = () => {
    if (!contextMenu) {
      return;
    }

    onRequestDeleteCommunity({ slug: contextMenu.slug, name: contextMenu.name });
    setContextMenu(null);
  };

  return (
    <>
    <div className="flex h-full w-full min-h-0 flex-col px-2">
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-full flex-col items-center gap-2 py-4">
          {communities.map((comm) => {
            const isSelected = selectedCommSlug === comm.slug;
            const fallbackBgClass = getFallbackIconBgClass(comm.id);

            return (
            <div className="relative group flex w-full justify-center" key={comm.id}>
              <button
                type="button"
                className={`cursor-pointer h-12 w-12 overflow-hidden transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--text)] ${
                  isSelected
                    ? "rounded-xl scale-105 ring-1 ring-neutral-300/80"
                    : "rounded-2xl hover:rounded-xl hover:scale-105"
                }`}
                onClick={() => onSelectCommunity(comm.slug)}
                onContextMenu={(event) => onCommunityContextMenu(event, comm.slug, comm.name, comm.permissionLevel)}
                onMouseEnter={(event) => showTooltip(comm.name, event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip(comm.name, event.currentTarget)}
                onBlur={hideTooltip}
                aria-label={comm.name}
                aria-pressed={isSelected}
              >
                {comm.iconKey ? (
                  <img src={buildS3AssetUrl(comm.iconKey) ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center text-lg font-semibold uppercase text-[color:var(--text)] ${fallbackBgClass}`}>
                    {comm.name.charAt(0)}
                  </div>
                )}
              </button>
            </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 mt-2 flex w-full flex-col items-center gap-3 border-t border-white/15 py-2">
        <div className="relative group">
          <Link
            to="/communities/discover"
            aria-label="Browse communities"
            onMouseEnter={(event) => showTooltip('Browse Communities', event.currentTarget)}
            onMouseLeave={hideTooltip}
            onFocus={(event) => showTooltip('Browse Communities', event.currentTarget)}
            onBlur={hideTooltip}
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-[#191c21] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.4)] transition-all duration-150 hover:rounded-xl hover:scale-105 hover:bg-[#20242a]"
          >
            <img src="/communities/browse.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </Link>
        </div>

        <div className="relative group">
          <button
            type="button"
            onClick={onCreateCommunityClick}
            onMouseEnter={(event) => showTooltip('Create Community', event.currentTarget)}
            onMouseLeave={hideTooltip}
            onFocus={(event) => showTooltip('Create Community', event.currentTarget)}
            onBlur={hideTooltip}
            aria-label="Create community"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl bg-[#191c21] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.4)] transition-all duration-150 hover:rounded-xl hover:scale-105 hover:bg-[#20242a]"
          >
            <img src="/communities/create.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </button>
        </div>
      </div>
    </div>
    {tooltip ? (
      <div
        className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-[color:var(--panel-strong)] px-2.5 py-1.5 text-sm text-[color:var(--text)] shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        style={{ top: tooltip.top, left: tooltip.left }}
      >
        {tooltip.label}
      </div>
    ) : null}
    {contextMenu ? (
      <div
        ref={contextMenuRef}
        className="fixed z-[120] min-w-44 rounded-lg border border-[color:var(--line)] bg-[#1a1e24] p-1 text-sm text-[color:var(--text)] shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
        style={{ top: contextMenu.y, left: contextMenu.x }}
      >
        {contextMenu.permissionLevel === 10 ? (
          <button
            type="button"
            onClick={onDeleteServer}
            className="block w-full rounded-md px-2.5 py-2 text-left text-red-300 transition hover:bg-red-500/20"
          >
            Delete server
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onLeaveServer()}
            disabled={isLeavingSlug === contextMenu.slug}
            className="block w-full rounded-md px-2.5 py-2 text-left transition hover:bg-white/10 disabled:cursor-default disabled:opacity-60"
          >
            {isLeavingSlug === contextMenu.slug ? 'Leaving server...' : 'Leave server'}
          </button>
        )}
        <button
          type="button"
          onClick={() => void onCopyInviteLink()}
          className="block w-full rounded-md px-2.5 py-2 text-left transition hover:bg-white/10"
        >
          Copy invite link
        </button>
        <button
          type="button"
          className="block w-full rounded-md px-2.5 py-2 text-left text-[color:var(--muted)]"
        >
          Server settings
        </button>
        <button
          type="button"
          className="block w-full rounded-md px-2.5 py-2 text-left text-[color:var(--muted)]"
        >
          Turn off notifications
        </button>
      </div>
    ) : null}
    </>
  );
}
