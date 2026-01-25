import { useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { connectBouncer, type BouncerConnection } from "@cup/bouncer-client";
import type { LobbyJoinResponse } from "@cup/shared-types";

type Params = { matchId: string };

export function BouncerGame() {
  const { matchId } = useParams<Params>();
  const gameContainerRef = useRef<HTMLDivElement | null>(null);

  console.log("BEFORE USEEFFECT");
  useEffect(() => {
    if (!matchId) return; // can't have this check earlier because useEffect shouldn't be called conditionally. Just return instantly if no matchId

    const gameEl = gameContainerRef.current;
    if (!gameEl) return; // el should always exist by now but this protects from weird behavior(hanging sockets) if anything goes wrong. Also tells typescript it's not null before we pass in to connectToLobby

    function connectToLobby(
      lobbyInfo: LobbyJoinResponse,
      gameContainerEl: HTMLElement,
    ): BouncerConnection {
      const bouncerConnection = connectBouncer(
        lobbyInfo.socketUrl,
        lobbyInfo.ticket,
        gameContainerEl,
      );
      console.log("Got bouncerConnection:", bouncerConnection);

      return bouncerConnection;
    }

    const controller = new AbortController();
    let conn: BouncerConnection | null = null;

    fetch(`/api/games/bouncer/join/${matchId}`, {
      method: "POST",
      signal: controller.signal,
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) return res.json();
        if (res.status == 404) throw new Error("Lobby not found");
        if (res.status == 410) throw new Error("Lobby has expired");
        if (res.status == 409) throw new Error("Lobby is not open for joining");
        throw new Error("Failed to join lobby: " + res.statusText);
      })
      .then((data: LobbyJoinResponse) => {
        console.log("Joining lobby with data:", data);
        conn = connectToLobby(data, gameEl);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Error joining lobby:", err);
      });

    return () => {
      controller.abort();
      if (conn) conn.disconnect();
    };
  }, [matchId]);

  if (!matchId) {
    return <div>Missing matchId</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-white/10 bg-black/70 p-2   md:p-8 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="font-['Fugaz_One'] text-2xl sm:text-3xl text-slate-200">
            Bouncer
          </h2>

          <div className="flex gap-3">
            <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:border-white/50 hover:text-white transition">
              Invite Friends
            </button>
            <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:border-white/50 hover:text-white transition">
              Copy Join Link
            </button>
          </div>
        </div>

        <div className="" ref={gameContainerRef} id="bouncer_client_container">
          {/*<Link to="/games/bouncer">Back</Link> */}
        </div>

        <ul className="mt-4 text-sm text-slate-400 leading-relaxed">
          <li>- Click + drag to aim, release to launch.</li>
          <li>- Press F for fullscreen.</li>
        </ul>
      </div>
    </div>
  );
}
