import { useState } from "react";


type StringEditModalProps = {
  onConfirm: (value: string) => Promise<void> | void;
  onCancel: () => void;
  title: string;
  label: string;
  initialValue: string; // empty string if creating new val
  submitLabel: string; // e.g. 'Create' or 'Save' or 'Update Username'. Whatever we want the submit button to say
  maxLength: number;
  isSubmitting?: boolean;
  isOpen: boolean;
}
export default function StringEditModal({
  onConfirm,
  onCancel,
  title,
  label,
  initialValue = "",
  submitLabel = "Submit",
  maxLength = 60,
  isSubmitting = false,
  isOpen = false,
}: StringEditModalProps) {
  const [currentVal, setCurrentVal] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = currentVal.trim().length > 0 && !isSubmitting;

  function handleCancel() {
    if (isSubmitting) return; //if we are already submitting then cancel shouldn't do anything, it's too late.

    setCurrentVal('');
    setError(null);
    onCancel();
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setError(null);

    try {
      await onConfirm(currentVal);
      setCurrentVal('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    }
  }

  if (!isOpen)
    return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[color:var(--panel)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <h2 className="text-xl font-semibold text-[color:var(--text)]">{title}</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">{label}</p>
        <input
          type="text"
          maxLength={maxLength}
          value={currentVal}
          onChange={(event) => setCurrentVal(event.target.value)}
          className="mt-2 w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          placeholder={initialValue}
          disabled={isSubmitting}
        />
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="cursor-pointer rounded-full px-4 py-2 text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)] disabled:cursor-default disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-green-500/70 px-5 py-2 text-sm text-white transition enabled:cursor-pointer enabled:hover:bg-green-500 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : submitLabel} 
          </button>
        </div>
      </div>
    </div>
  );
}