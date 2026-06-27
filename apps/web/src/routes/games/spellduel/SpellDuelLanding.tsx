import { useNavigate } from "react-router-dom";
import { buildCsrfHeaders } from "../../../api/csrf";

export function SpellDuelLanding() {
  const navigate = useNavigate();

  async function createGame() {
    try {
      const res = await fetch("/api/games/spellduel/create", {
        method: "POST",
        credentials: "include",
        headers: {
          ...(await buildCsrfHeaders()),
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`/api/games/spellduel/create failed: ${res.status}`);
      const { matchId } = await res.json();
      navigate(`/games/spellduel/${matchId}`);
    } catch (e) {
      console.error("Error creating SpellDuel game:", e);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-14">
      <div className="grid gap-10 md:grid-cols-2 items-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/70 p-8 md:p-10">
        {/* Left: visual placeholder */}
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/60 shadow-[0_0_60px_rgba(85,214,169,0.15)] flex items-center justify-center min-h-[220px]">
          <div className="flex gap-3 p-8 select-none">
            {["S","P","E","L","L"].map((l, i) => (
              <div key={i} className="w-12 h-12 flex items-center justify-center rounded border-2 border-[color:var(--accent)] text-[color:var(--accent)] font-bold text-xl">
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Right: info */}
        <div className="space-y-6 text-[color:var(--text)]">
          <div>
            <h2 className="text-3xl sm:text-4xl mb-4">SpellDuel</h2>
            <p className="mt-3 text-[color:var(--muted)] mb-5">
              <b className="text-[color:var(--text)]">Wizard Word Battle.</b>{" "}
              Race your opponents to solve multiple Wordle-style puzzles. Submit a starting word that counts for all boards, then focus your remaining guesses to claim boards before anyone else does.
            </p>

            <ul className="leading-relaxed mt-3 text-sm text-[color:var(--muted)] list-disc list-inside space-y-2">
              <li>
                <b className="text-[color:var(--text)]">How to play:</b> Each board has a secret 5-letter word.
                Green = right letter, right spot. Yellow = right letter, wrong spot. Grey = not in the word.
              </li>
              <li>
                <b className="text-[color:var(--text)]">Compete:</b> First player to solve a board claims it and earns points. Fewer guesses = more points.
              </li>
              <li>
                <b className="text-[color:var(--text)]">Rounds:</b> Play multiple rounds, scores carry over. Most points after all rounds wins.
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
          </div>
        </div>
      </div>
    </div>
  );
}
