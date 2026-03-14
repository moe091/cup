type ChatComposerProps = {
  placeholder: string;
};

export default function ChatComposer({ placeholder }: ChatComposerProps) {
  return (
    <div className="border-t border-[color:var(--line)] p-3">
      <div className="flex gap-2">
        <textarea
          disabled
          placeholder={placeholder}
          rows={2}
          className="min-h-16 flex-1 resize-none rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--text)] outline-none"
        />
        <button
          type="button"
          disabled
          className="h-fit rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--muted)]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
