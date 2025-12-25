import { Routes, Route, Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      <h1>Home</h1>
      <Link to="/game">Go to /game</Link>
    </div>
  );
}

function Game() {
  return (
    <div>
      <h1>Game</h1>
      <p>Auth modal will go here.</p>
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
