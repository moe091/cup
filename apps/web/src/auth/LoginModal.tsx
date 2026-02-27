import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { buildCsrfHeaders } from "../api/csrf";

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialMode: AuthMode;
};

export type AuthMode = "login" | "signup";

export function LoginModal({ isOpen, onClose, initialMode }: LoginModalProps) {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupVerifyPassword, setSignupVerifyPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const startedOnBackdropRef = useRef(false);

  const passwordsMatch =
    signupPassword.length > 0 &&
    signupVerifyPassword.length > 0 &&
    signupPassword === signupVerifyPassword;
  const hasVerifyInput = signupVerifyPassword.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    firstInputRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [initialMode, isOpen, onClose]);

  const handleLocalLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/local/login", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(await buildCsrfHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Login failed.");
        throw new Error(message);
      }

      await refresh();
      onClose();
      navigate("/profile");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocalSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/local/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(await buildCsrfHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: signupUsername,
          password: signupPassword,
          verifyPassword: signupVerifyPassword,
          email: signupEmail,
          displayName: signupDisplayName,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Sign up failed.");
        throw new Error(message);
      }

      await refresh();
      onClose();
      navigate("/profile");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Sign up failed.");
    } finally {
      setIsSubmitting(false);
    }
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
          <h2 className="text-lg font-semibold text-[color:var(--text)]">
            {mode === "login" ? "Log In" : "Sign Up"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
            aria-label="Close login modal"
          >
            X
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-[color:var(--line)] p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm transition ${
              mode === "login"
                ? "bg-[color:var(--panel-strong)] text-[color:var(--text)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-2 text-sm transition ${
              mode === "signup"
                ? "bg-[color:var(--panel-strong)] text-[color:var(--text)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === "login" ? (
          <form className="grid gap-3" onSubmit={handleLocalLogin}>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="login-identifier">
                Username or email
              </label>
              <input
                id="login-identifier"
                ref={firstInputRef}
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-[10px] w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition enabled:hover:border-[color:var(--text)] disabled:opacity-70"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={handleLocalSignup}>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="signup-username">
                Username
              </label>
              <input
                id="signup-username"
                ref={firstInputRef}
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="text"
                autoComplete="username"
                value={signupUsername}
                onChange={(event) => setSignupUsername(event.target.value)}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="password"
                autoComplete="new-password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="signup-verify-password">
                Password verify
              </label>
              <input
                id="signup-verify-password"
                className={`w-full rounded-lg border bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none ${
                  hasVerifyInput
                    ? passwordsMatch
                      ? "border-green-500 focus:border-green-500"
                      : "border-red-500 focus:border-red-500"
                    : "border-[color:var(--line)] focus:border-[color:var(--accent)]"
                }`}
                type="password"
                autoComplete="new-password"
                value={signupVerifyPassword}
                onChange={(event) => setSignupVerifyPassword(event.target.value)}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="signup-email">
                Email (optional)
              </label>
              <input
                id="signup-email"
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="email"
                autoComplete="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
              />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-[color:var(--muted)]" htmlFor="signup-display-name">
                Display name (optional)
              </label>
              <input
                id="signup-display-name"
                className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
                type="text"
                value={signupDisplayName}
                onChange={(event) => setSignupDisplayName(event.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-[10px] w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition enabled:hover:border-[color:var(--text)] disabled:opacity-70"
            >
              {isSubmitting ? "Signing up..." : "Sign Up"}
            </button>
          </form>
        )}

        <div className="my-[16px] h-px bg-[color:var(--line)]" />

        <div className="grid gap-2">
          <a
            href="/api/auth/google"
            className="w-full rounded-lg border border-[color:var(--line)] px-4 py-2 text-center text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--text)]"
          >
            Continue with Google
          </a>
          <a
            href="/api/auth/discord"
            className="w-full rounded-lg border border-[color:var(--line)] px-4 py-2 text-center text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--discord)]"
          >
            Continue with Discord
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

async function readErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
    };

    if (Array.isArray(data.message) && data.message.length > 0) {
      return data.message[0];
    }

    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }

    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
