import { Link } from "react-router-dom";
import { useAuth } from "../auth";

export default function TopBar() {
  const { user } = useAuth();

  return (
    <div className="fixed top-0 z-10 w-full bg-black/70 backdrop-blur border-b border-white/20">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        {/* Left: brand */}
        <Link
          to="/"
          className="border-b border-slate-700 px-3 font-['Zain'] text-3xl text-slate-200 tracking-wide"
        >
          the nite crew
        </Link>

        {/* Middle: nav */}
        <nav className="hidden sm:flex items-center gap-8 text-slate-200">
          <Link to="/games" className="hover:text-white transition">
            Games
          </Link>
          <Link to="/friends" className="hover:text-white transition">
            Friends
          </Link>
          <Link to="/home" className="hover:text-white transition">
            My Home
          </Link>
        </nav>

        {/* Right: auth */}
        <div className="flex items-center gap-3 text-slate-200">
          {user ? (
            <button className="hover:text-white transition">
              {user.displayName}
            </button>
          ) : (
            <>
              <a
                href="/api/auth/google"
                className="px-4 py-2 rounded-full border border-white/20 hover:border-white/50 hover:text-white transition"
              >
                Login
              </a>
              <a
                href="/api/auth/google"
                className="px-4 py-2 rounded-full border border-white/20 hover:border-white/50 hover:text-white transition"
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
