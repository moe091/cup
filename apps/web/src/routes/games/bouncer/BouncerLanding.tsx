import { Link } from 'react-router-dom';

export function BouncerLanding() {
  return (
      <div className="gameMenu">
        <Link to="/games/bouncer/12345">
          <button>create game</button>
        </Link>
        
        <button>join game</button>
      </div>
  );
}
