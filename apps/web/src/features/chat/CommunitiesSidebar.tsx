import type { MyCommunitiesResponseDto } from "@cup/shared-types";
import { buildS3AssetUrl } from "../../config/s3";

type CommunitiesSidebarProps = {
  communities: MyCommunitiesResponseDto;
  isCommsLoading: boolean;
  commsErrorMsg: string | null;
  selectedCommSlug: string | null;
  onSelectCommunity: (slug: string) => void;
}

export default function CommunitiesSidebar({ communities, isCommsLoading, commsErrorMsg, selectedCommSlug, onSelectCommunity }: CommunitiesSidebarProps) {


  console.log("RENDERING COMMUNITIES: ", communities);
  return (
    <div className="flex flex-col w-16 gap-2">
      {communities.map((comm) => {
        const isSelected = selectedCommSlug === comm.slug;

        return (
        <div className="relative group" key={comm.id}>
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
            <img src={buildS3AssetUrl(comm.iconKey) || "/images/avatars/default-profile.png"} alt="" />
          </button>
          
          <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-[color:var(--panel-strong)] px-2 py-1 text-xs text-[color:var(--text)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {comm.name}
          </div>
        </div>
        );
      })}
    </div>
  )
}
