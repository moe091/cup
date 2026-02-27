import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { LoginModal } from "../auth/LoginModal";
import type { AuthMode } from "../auth/LoginModal";
import { buildCsrfHeaders } from "../api/csrf";

export default function TopBar() {
  const { user, refresh } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialMode, setLoginModalInitialMode] = useState<AuthMode>("login");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const userMenuId = useId();

  const openLoginModal = () => {
    setLoginModalInitialMode("login");
    setIsLoginModalOpen(true);
  };

  const openSignupModal = () => {
    setLoginModalInitialMode("signup");
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: await buildCsrfHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }

      await refresh();
    } catch {
      alert("Logout failed.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (!authError) {
      return;
    }

    alert(authError);
    params.delete("authError");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!userMenuContainerRef.current?.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <div className="fixed top-0 z-10 w-full border-b border-[color:var(--line)] bg-[color:var(--panel)]/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        {/* Left: brand */}
        <Link
          to="/"
          className="flex items-center gap-2 border-b border-[color:var(--line)] px-2 text-2xl text-[color:var(--text)] tracking-wide"
        >
          <span className="h-2 w-2 rounded-full bg-[color:var(--accent)] shadow-[0_0_10px_rgba(85,214,169,0.6)]" />
          TheNiteCrew
        </Link>

        {/* Middle: nav */}
        <nav className="hidden sm:flex items-center gap-8 text-[color:var(--muted)]">
          <Link
            to="/games"
            className="hover:text-[color:var(--text)] transition"
          >
            Games
          </Link>
          <Link
            to="/friends"
            className="hover:text-[color:var(--text)] transition"
          >
            Friends
          </Link>
          <Link
            to="/home"
            className="hover:text-[color:var(--text)] transition"
          >
            My Home
          </Link>
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-3 text-[color:var(--muted)]">
          {user ? (
            <div className="relative" ref={userMenuContainerRef}>
              <button
                type="button"
                className="hover:text-[color:var(--text)] transition"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                aria-controls={userMenuId}
              >
                {user.displayName}
              </button>

              {isUserMenuOpen && (
                <div
                  id={userMenuId}
                  role="menu"
                  aria-label="User menu"
                  className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-[color:var(--text)] transition hover:bg-[color:var(--panel)]"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-[color:var(--text)] transition hover:bg-[color:var(--panel)]"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={openLoginModal}
                className="px-4 py-2 rounded-full border border-[color:var(--line)] hover:border-[color:var(--text)] hover:text-[color:var(--text)] transition"
              >
                Login
              </button>
              <button
                type="button"
                onClick={openSignupModal}
                className="px-4 py-2 rounded-full border border-[color:var(--line)] hover:border-[color:var(--text)] hover:text-[color:var(--text)] transition"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        initialMode={loginModalInitialMode}
      />
    </div>
  );
}
