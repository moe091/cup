import { useNavigate } from 'react-router-dom';
import bouncerScreen from '../../../assets/bouncer_screen.jpg';

export function BouncerLanding() {
  const navigate = useNavigate();
  async function createGame() {
    console.log("CRWEATE GAME");
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
    navigate(`/games/bouncer/editor`);
  }

  function joinFriends() {
    alert("Not implemented yet: Once I have friends lists implemented, this is where you'll see a list of all friends who are playing the game, with an option to click and join their matches");
  }

  // return (
  //     <div className="gameMenu">
  //       <button onClick={createGame}>create game</button>
        
  //       <button>join game</button>
  //       <div className="levelEditorSection">
  //         <h3>Level editor</h3>
  //         <button onClick={createLevel}>Level Editor</button>
  //         <button disabled>edit existing level</button>
  //       </div>
  //     </div>
  // );

  return (
<div className="mx-auto w-full max-w-7xl px-6 py-14">
      <div className="grid gap-10 md:grid-cols-2 items-center rounded-2xl border border-white/10 bg-black/40 p-8 md:p-10">

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_0_60px_rgba(99,102,241,0.2)]">
          <img src={bouncerScreen} className="rounded border border-white/10 bg-black/40 overflow-hidden shadow-[0_0_60px_rgba(99,102,241,0.2)]"></img>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-slate-900/30 px-4 py-8 text-center backdrop-blur">
            <div className="font-['Cardo'] text-2xl tracking-[0.2em] text-slate-200">
              BOUNCER
            </div>
          </div>
        </div>

        <div className="space-y-6 text-slate-200">
          <div>
            <h2 className="font-['Cardo'] text-3xl sm:text-4xl">Bouncer</h2>
            <p className="mt-3 text-slate-300">
              If miniature golf was a multiplayer platformer game: Traverse each level by flicking 
              your ball through obstacles and hazards to reach the goal before your opponents.
            </p>

            <ul className="mt-3 text-sm text-slate-400 list-disc list-inside space-y-2">
              <li><b className="text-white">Controls:</b> Click + drag to aim, release to launch.</li>
              <li>Each player gets 1 launch per 2 seconds, make them count!</li>
              <li>Keep an eye out for physics-bending powerups and special platforms that help you speed ahead or slow down your opponents.</li>
              <li>Choose from dozens (jk it's just 1 rn) levels, ranging from high-speed to technical platforming challenges to physics-based puzzles.</li>
              <li>Or use the level editor to create and share your own unique level ideas!</li>
            </ul>
          </div>


          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={createGame}
              className="rounded-full bg-emerald-400/20 border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500/40 transition"
            >
              Start Game
            </button>
            <button
              onClick={createLevel}
              className="rounded-full border bg-indigo-400/20 border-white/20 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-indigo-400/40 hover:border-white/50 hover:text-white transition"
            >
              Level Editor
            </button>
            <button
              onClick={joinFriends}
              className="rounded-full bg-violet-500/20 border border-white/20 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-violet-500/40 hover:border-white/50 hover:text-white transition"
            >
              Join Friends
            </button>
          </div>
        </div>



      </div>
    </div>
  )
}
