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

  function createLevel() {
    const name = window.prompt('Level name?');
    if (!name) return;
    navigate(`/games/bouncer/editor?name=${encodeURIComponent(name)}`);
  }

  return (
      <div className="gameMenu">
        <button onClick={createGame}>create game</button>
        
        <button>join game</button>
        <div className="levelEditorSection">
          <h3>Level editor</h3>
          <button onClick={createLevel}>create level</button>
          <button disabled>edit existing level</button>
        </div>
      </div>
  );
}
