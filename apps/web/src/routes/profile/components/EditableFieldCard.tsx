import type { ReactNode } from "react";

type EditableFieldCardProps = {
  label: string;
  isEditing: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  errorMessage?: string | null;
  contentClassName?: string;
  children: ReactNode;
};

export default function EditableFieldCard({
  label,
  isEditing,
  isSaving,
  isDirty,
  onEdit,
  onSave,
  onCancel,
  errorMessage,
  contentClassName = "mt-2",
  children,
}: EditableFieldCardProps) {
  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !isDirty}
              className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--text)] transition enabled:hover:border-[color:var(--text)] disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs text-[color:var(--text)] transition hover:border-[color:var(--text)]"
          >
            Edit
          </button>
        )}
      </div>

      <div className={contentClassName}>{children}</div>

      {errorMessage ? (
        <p className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}
