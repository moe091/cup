import type { ReactNode } from "react";

type EmojiPickerSectionProps = {
  sectionId: string;
  title: string;
  isCollapsed: boolean;
  onToggle: (sectionId: string) => void;
  contentClassName?: string;
  children: ReactNode;
};

export default function EmojiPickerSection({
  sectionId,
  title,
  isCollapsed,
  onToggle,
  contentClassName,
  children,
}: EmojiPickerSectionProps) {
  const contentId = `emoji-section-${sectionId}`;

  return (
    <section>
      <button
        type="button"
        onClick={() => onToggle(sectionId)}
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        className="mb-2 flex w-full items-center justify-start gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] hover:text-[color:var(--text)]"
      >
        <span>{title}</span>
        <span aria-hidden>{isCollapsed ? ">" : "v"}</span>
      </button>

      <div id={contentId} className={contentClassName}>
        {isCollapsed ? null : children}
      </div>
    </section>
  );
}
