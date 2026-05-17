import type { MyCommunitiesResponseDto } from "@cup/shared-types";
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
};

export default function CommunitiesSidebar({
  communities,
  selectedCommSlug,
  onSelectCommunity,
  onCreateCommunityClick,
}: CommunitiesSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-2">
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
          
          <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-[color:var(--panel-strong)] px-2 py-1 text-xs text-[color:var(--text)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {comm.name}
          </div>
        </div>
        );
      })}

      <div className="mt-auto flex w-full flex-col items-center gap-3 pb-2">
        <div className="h-px w-full bg-white/15" />
        <div className="relative group">
          <button
            type="button"
            onClick={onCreateCommunityClick}
            aria-label="Create community"
            className="h-12 w-12 cursor-pointer rounded-2xl bg-[#191c21] text-[2.1rem] leading-none text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.45),0_6px_14px_rgba(0,0,0,0.4)] transition-all duration-150 hover:rounded-xl hover:scale-105 hover:bg-[#20242a]"
          >
            +
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-[color:var(--panel-strong)] px-2 py-1 text-xs text-[color:var(--text)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            Create Community
          </div>
        </div>
      </div>
    </div>
  );
}
