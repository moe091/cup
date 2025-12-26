import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import type { SessionUser } from '@cup/shared-types';

function Home() {
  return (
    <div>
      <h1>Home</h1>
      <Link to="/game">Go to /game</Link>
    </div>
  );
}

function Game() {
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
    </div>
  );
}

export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game" element={<Game />} />
    </Routes>
  );
}
