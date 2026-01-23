import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';
import type { SessionUser } from '@cup/shared-types';
import { BouncerGame } from './routes/games/bouncer/BouncerGame';
import { BouncerLanding } from './routes/games/bouncer/BouncerLanding';
import { BouncerEditor } from './routes/games/bouncer/BouncerEditor';
import BouncerLayout from './routes/games/bouncer/BouncerLayout';
import { useAuth } from './auth/AuthContext';
import TopBar from './panels/TopBar';
import Browse from './routes/games/Browse';
import GamesLayout from './routes/games/GamesLayout';
//import './assets/games.css';

 
function Home2() {
  return (
    <div>
      <h1>Home</h1>
      <Link to="/games">Go to /games</Link>
    </div>
  );
}

function Game2() {
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch('/api/message')
      .then((res) => res.json())
      .then((data) => setMsg(data.message))
      .catch((err) => {
        console.error('Error fetching message:', err);
        setMsg('Error fetching message');
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((res) => {
        if (res.status === 401) {
          console.log('User is not authenticated');
          return null;
        }
        return res.json();
      })
      .then((data: SessionUser | null) => {
        if (data) {
          console.log('Authenticated user:', data);
          setUser(data);
        } else {
          console.log('No authenticated user');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          console.log('Fetch aborted');
          return;
        }
        console.error('Error fetching auth status:', err);
      });

    return () => controller.abort();
  }, []);


  return (
    <div>
      <h1>Game</h1>
      <p>Auth modal will go here.</p>
      <div>message = {msg}</div>
      <a href="/api/auth/google">Sign in with Google</a>
      <h3>Username = {user?.displayName}</h3>
      <Link to="/games/bouncer">Bouncer!</Link>
    </div>
  );
}

function Game() {
  return <h2> game </h2>
}

function LoggedOutActions() {
  return (
    <div className="mx-auto mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 px-6 py-5 text-slate-200 backdrop-blur">
      <p className="mb-4 text-sm text-slate-300">
        Sign up instantly — no email verification required.
      </p>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <input
          className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-white/50"
          type="text"
          placeholder="username"
        />
        <input
          className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-white/50"
          type="password"
          placeholder="password"
        />
      </div>

      <div className="flex justify-center">
        <a
          href="/api/auth/google"
          className="px-6 py-2 rounded-full border border-white/20 hover:border-white/50 hover:text-white transition"
        >
          Register
        </a>
      </div>
    </div>
  );
}


function LoggedInActions() {
  return (
    <div className="text-slate-200 flex flex-col sm:flex-row gap-4 justify-center mt-10 ">
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-white/20 hover:border-white/50 hover:text-white transition">Game</button>
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-white/20 hover:border-white/50 hover:text-white transition">Chill</button>
      <button className="mt-10 px-8 py-4 rounded-full text-lg font-medium border border-white/20 hover:border-white/50 hover:text-white transition">My Home</button>
    </div>
  )
}

function GreetingText(user: SessionUser | null, isLoading: boolean) {
  if (isLoading) return null;
  return (
    <h1 className="font-['Cardo'] text-5xl sm:text-6xl lg:text-7xl font-semibold space-y-8">
      { user?.displayName ? `Welcome back, ${user?.displayName}` : 'Welcome to the Night Crew.'}
    </h1>
  )
}

function BouncerRec() {
  return (
    <div className="mx-auto mt-10 w-fit rounded-full border border-white/10 bg-white/5 px-6 py-3 text-slate-200">
      Or: Try our newest game:&nbsp;
      <Link
        to="/games/bouncer"
        className="text-indigo-200 font-semibold text-lg hover:text-white transition-colors underline-offset-4 hover:underline"
      >
        Bouncer!
      </Link>
    </div>
  );
}

function Home() {
  const { user, isLoading } = useAuth();

  // ALTERNATE COLORING FOR BG GRADIENT. Can't decide which one to use
  //  dark fuschia  <main className="min-h-screen w-full flex items-center justify-center text-white bg-gradient-to-br bg-gradient-to-br from-purple-900 via-black to-violet-900">
  //  less dark blueish  <main className="min-h-screen w-full flex items-center justify-center text-white bg-gradient-to-tl from-neutral-900 via-indigo-900 to-neutral-900">

  return (
    <main className="font-['Manrope'] text-slate-200/90 tracking-wide min-h-screen w-full flex items-center justify-center text-slate-100 bg-gradient-to-tl from-neutral-950 via-indigo-950 to-neutral-950">
      <div className="text-center space-y-6">
        { GreetingText(user, isLoading) }
        { !user && !isLoading && LoggedOutActions() }
        { user && !isLoading && LoggedInActions() }
        { BouncerRec() }
      </div>
    </main>
  )
}

export function AppLayout() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  )
}


export default function App() {

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<GamesLayout />}>
          <Route index element={<Browse />} />
          <Route path="bouncer" element={<BouncerLayout />}>
            <Route index element={<BouncerLanding />} />
            <Route path="editor" element={<BouncerEditor />} />
            <Route path=":matchId" element={<BouncerGame />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
