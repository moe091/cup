import { useNavigate } from 'react-router-dom';


export function BouncerLanding() {
  const navigate = useNavigate();
  async function createGame() {
    try {
      const res = await fetch('/api/games/bouncer/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error(`/api/games/bouncer/create request failed: ${res.status}`);
      }

      const matchInfo = await res.json();
      navigate(`/games/bouncer/${matchInfo.matchId}`);

    } catch (e) {
      console.error('Error creating game:', e);
    }
  }

  return (
      <div className="gameMenu">
        <button onClick={createGame}>create game</button>
        
        <button>join game</button>
      </div>
  );
}
