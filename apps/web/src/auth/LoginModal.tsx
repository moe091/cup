import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameInputRef = useRef<HTMLInputElement | null>(null);
  const startedOnBackdropRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    usernameInputRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleLocalLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void username;
    void password;
    alert("Not Implemented Yet.");
  };

  const handleDiscordLogin = () => {
    alert("Not Implemented Yet.");
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    startedOnBackdropRef.current = event.target === event.currentTarget;
  };

  const handleBackdropMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    const endedOnBackdrop = event.target === event.currentTarget;
    if (startedOnBackdropRef.current && endedOnBackdrop) {
      onClose();
    }
    startedOnBackdropRef.current = false;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--text)]">Log In</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
            aria-label="Close login modal"
          >
            X
          </button>
        </div>

        <form className="grid gap-3" onSubmit={handleLocalLogin}>
          <input
            ref={usernameInputRef}
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] placeholder-[color:var(--muted)] outline-none focus:border-[color:var(--accent)]"
            type="text"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] placeholder-[color:var(--muted)] outline-none focus:border-[color:var(--accent)]"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="submit"
            className="mt-[10px] w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--text)]"
          >
            Login
          </button>
        </form>

        <div className="my-[16px] h-px bg-[color:var(--line)]" />

        <div className="grid gap-2">
          <a
            href="/api/auth/google"
            className="w-full rounded-lg border border-[color:var(--line)] px-4 py-2 text-center text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--text)]"
          >
            Continue with Google
          </a>
          <button
            type="button"
            onClick={handleDiscordLogin}
            className="w-full rounded-lg border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--discord)]"
          >
            Continue with Discord
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
