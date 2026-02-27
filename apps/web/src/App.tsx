import { Suspense, lazy, useState } from "react";
import { Routes, Route, Link, Outlet } from "react-router-dom";
import type { SessionUser } from "@cup/shared-types";
import { useAuth } from "./auth";
import TopBar from "./panels/TopBar";
import ProfilePage from "./routes/profile/ProfilePage";
//import './assets/games.css';

const GamesLayout = lazy(() => import("./routes/games/GamesLayout"));
const Browse = lazy(() => import("./routes/games/Browse"));
const BouncerLayout = lazy(() => import("./routes/games/bouncer/BouncerLayout"));
const BouncerLanding = lazy(() =>
  import("./routes/games/bouncer/BouncerLanding").then((module) => ({
    default: module.BouncerLanding,
  })),
);
const BouncerEditor = lazy(() =>
  import("./routes/games/bouncer/BouncerEditor").then((module) => ({
    default: module.BouncerEditor,
  })),
);
const BouncerGame = lazy(() =>
  import("./routes/games/bouncer/BouncerGame").then((module) => ({
    default: module.BouncerGame,
  })),
);

function LoginSignupCard() {
  const [username, setUsername] = useState("");
  const handleQuickStart = () => {};

  return (
    <div className="mt-8 w-full max-w-2xl rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/90 px-6 py-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
      <div className="grid gap-3 max-w-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
          Quick start
        </p>
        <input
          className="w-full rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-[color:var(--text)] placeholder-[color:var(--muted)] outline-none focus:border-[color:var(--accent)]"
          type="text"
          placeholder="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <button
          type="button"
          onClick={handleQuickStart}
          className="w-fit rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 text-sm text-[color:var(--text)] transition hover:border-[color:var(--text)]"
        >
          Create account
        </button>
      </div>
    </div>
  );
}

function LoggedInActions() {
  return (
    <div className="text-[color:var(--text)] flex flex-col sm:flex-row gap-4 justify-center mt-10 ">
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-[color:var(--line)] hover:border-[color:var(--text)] transition">
        Game
      </button>
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-[color:var(--line)] hover:border-[color:var(--text)] transition">
        Chill
      </button>
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-[color:var(--line)] hover:border-[color:var(--text)] transition">
        My Home
      </button>
    </div>
  );
}

function GreetingText(user: SessionUser | null, isLoading: boolean) {
  if (isLoading) return null;
  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight">
      {user?.displayName
        ? `Welcome back, ${user?.displayName}`
        : "Welcome to the Night Crew."}
    </h1>
  );
}

function BouncerRec() {
  return (
    <div className="mx-auto mt-10 w-fit rounded-full border border-[color:var(--line)] bg-[color:var(--panel)]/60 px-6 py-3 text-[color:var(--text)]">
      Or: Try our newest game:&nbsp;
      <Link
        to="/games/bouncer"
        className="text-[color:var(--accent)] font-semibold text-lg hover:text-[color:var(--text)] transition-colors underline-offset-4 hover:underline"
      >
        Bouncer!
      </Link>
    </div>
  );
}

function Home() {
  const { user, isLoading } = useAuth();

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-6 pt-20 text-[color:var(--text)]">
      <div className="w-full max-w-4xl space-y-6 text-left">
        {GreetingText(user, isLoading)}
        <p className="text-[color:var(--muted)] max-w-2xl">
          Drop in, play a quick match, and keep the hangout going. Fast, social,
          and low friction.
        </p>
        {!user && !isLoading && <LoginSignupCard />}
        {user && !isLoading && LoggedInActions()}
        {BouncerRec()}
      </div>
    </main>
  );
}

export function AppLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/games"
          element={
            <Suspense fallback={null}>
              <GamesLayout />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={null}>
                <Browse />
              </Suspense>
            }
          />
          <Route
            path="bouncer"
            element={
              <Suspense fallback={null}>
                <BouncerLayout />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={null}>
                  <BouncerLanding />
                </Suspense>
              }
            />
            <Route
              path="editor"
              element={
                <Suspense fallback={null}>
                  <BouncerEditor />
                </Suspense>
              }
            />
            <Route
              path=":matchId"
              element={
                <Suspense fallback={null}>
                  <BouncerGame />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
