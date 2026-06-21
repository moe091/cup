import { useNavigate } from "react-router-dom";
import bouncerScreen from "../../../assets/bouncer_screen.jpg";
import { buildCsrfHeaders } from "../../../api/csrf";

export function BouncerLanding() {
  const navigate = useNavigate();
  async function createGame() {
    console.log("CRWEATE GAME");
    try {
      const res = await fetch("/api/games/bouncer/create", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(await buildCsrfHeaders()),
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(
          `/api/games/bouncer/create request failed: ${res.status}`,
        );
      }

      const matchInfo = await res.json();
      navigate(`/games/bouncer/${matchInfo.matchId}`);
    } catch (e) {
      console.error("Error creating game:", e);
    }
  }

  function createLevel() {
    navigate(`/games/bouncer/editor`);
  }

  function joinFriends() {
    alert(
      "Not implemented yet: Once I have friends lists implemented, this is where you'll see a list of all friends who are playing the game, with an option to click and join their matches",
    );
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
      <div className="grid gap-10 md:grid-cols-2 items-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/70 p-8 md:p-10">
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/60 shadow-[0_0_60px_rgba(85,214,169,0.15)]">
          <img
            src={bouncerScreen}
            className="rounded border border-[color:var(--line)] bg-[color:var(--panel)]/60 overflow-hidden"
          ></img>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-[color:var(--panel)]/60 px-4 py-8 text-center backdrop-blur">
            <div className="text-3xl tracking-[0.2em] text-[color:var(--text)]">
              Bouncer!
            </div>
          </div>
        </div>

        <div className="space-y-6 text-[color:var(--text)]">
          <div>
            <h2 className="text-3xl sm:text-4xl mb-4">Bouncer</h2>
            <p className="mt-3 text-[color:var(--muted)] mb-5">
              <b className="text-[color:var(--text)]">
                Orb Racing
              </b>{" "}
              Race your friends by rolling, jumping, and dashing through a physics-based platformer world with your handy-dandy wizard orb.
            </p>

            <ul className="leading-relaxed mt-3 text-sm text-[color:var(--muted)] list-disc list-inside space-y-2">
              <li>
                <b className="text-[color:var(--text)]">Controls:</b>  <br />
                <b>A and D: </b>move left and right(WASD controls) <br />
                <b>Space: </b>Jump. If already in the air, doublejump(1 use, resets when you touch the ground) <br />
                <b>Shift: </b>Dash. Only works in the air(1 use, resets when you touch the ground) <br />
                <b>R: </b>Restart level(only works in solo play, does nothing if 2 or more players are in the match)
              </li>
              <li>
                <b className="text-[color:var(--text)]">Custom Level Editor!</b>{" "}
                Design your own levels and play with friends!
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={createGame}
              className="rounded-full border border-[color:var(--accent)] bg-[color:var(--panel-strong)] px-6 py-3 text-sm font-semibold text-[color:var(--text)] hover:brightness-110 transition"
            >
              Start Game
            </button>
            <button
              onClick={createLevel}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-6 py-3 text-sm font-semibold text-[color:var(--text)] hover:border-[color:var(--text)] transition"
            >
              Level Editor
            </button>
            <button
              onClick={joinFriends}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-6 py-3 text-sm font-semibold text-[color:var(--text)] hover:border-[color:var(--text)] transition"
            >
              Join Friends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
