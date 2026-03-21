export type MessageActionPickerAnchor = {
  x: number;
  y: number;
};

type MessageActionMenuProps = {
  quickEmojis?: string[];
  onQuickReact?: (emoji: string) => void;
  onOpenEmojiPicker?: (anchor: MessageActionPickerAnchor) => void;
  onReply?: () => void;
};

const DEFAULT_QUICK_EMOJIS = ["👍", "❤️", "😂"];

export default function MessageActionMenu({
  quickEmojis = DEFAULT_QUICK_EMOJIS,
  onQuickReact,
  onOpenEmojiPicker,
  onReply,
}: MessageActionMenuProps) {
  return (
    <div className="pointer-events-none absolute -top-3 right-2 z-10 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      <div className="flex items-center gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-1 py-1 shadow-[0_6px_16px_rgba(0,0,0,0.28)]">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onQuickReact?.(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-md p-0 text-lg leading-none hover:bg-[color:var(--panel-lighter)]"
            aria-label={`React with ${emoji}`}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onOpenEmojiPicker?.({
              x: rect.left,
              y: rect.top,
            });
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md p-0 text-lg leading-none text-[color:var(--muted)] hover:bg-[color:var(--panel-lighter)] hover:text-[color:var(--text)]"
          aria-label="Open emoji picker"
          title="Open emoji picker"
        >
          +
        </button>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onReply?.()}
          className="flex h-8 w-8 items-center justify-center rounded-md p-0 text-lg leading-none text-[color:var(--muted)] hover:bg-[color:var(--panel-lighter)] hover:text-[color:var(--text)]"
          aria-label="Reply to message"
          title="Reply to message"
        >
          ↩
        </button>
      </div>
    </div>
  );
}
