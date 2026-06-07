import { useMemo, useState } from 'react';

type ConfirmTextModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmationText: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

export default function ConfirmTextModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmationText,
  isSubmitting = false,
  onCancel,
  onConfirm, 
}: ConfirmTextModalProps) {
  const [currentVal, setCurrentVal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canConfirm = useMemo(
    () => currentVal.trim() === confirmationText && !isSubmitting,
    [currentVal, confirmationText, isSubmitting],
  );

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    setCurrentVal('');
    setError(null);
    onCancel();
  };

  const handleConfirm = async () => {
    if (!canConfirm) {
      return;
    }

    setError(null);
    try {
      await onConfirm();
      setCurrentVal('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    }
  };

  if (!isOpen) {
    return null;
  }

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
        <p className="mt-2 text-sm text-[color:var(--muted)]">{message}</p>
        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Type <span className="font-semibold text-[color:var(--text)]">{confirmationText}</span> to confirm.
        </p>
        <input
          type="text"
          value={currentVal}
          onChange={(event) => setCurrentVal(event.target.value)}
          className="mt-2 w-full rounded-lg bg-[color:var(--panel-strong)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          placeholder={confirmationText}
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
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-full bg-red-500/80 px-5 py-2 text-sm text-white transition enabled:cursor-pointer enabled:hover:bg-red-500 disabled:opacity-60"
          >
            {isSubmitting ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
