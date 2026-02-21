import { Link } from "react-router-dom";
import { useAuth } from "../auth";

export default function TopBar() {
  const { user } = useAuth();

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
            <button className="hover:text-[color:var(--text)] transition">
              {user.displayName}
            </button>
          ) : (
            <>
              <a
                href="/api/auth/google"
                className="px-4 py-2 rounded-full border border-[color:var(--line)] hover:border-[color:var(--text)] hover:text-[color:var(--text)] transition"
              >
                Login
              </a>
              <a
                href="/api/auth/google"
                className="px-4 py-2 rounded-full border border-[color:var(--line)] hover:border-[color:var(--text)] hover:text-[color:var(--text)] transition"
              >
                Sign Up
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
