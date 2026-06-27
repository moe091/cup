import { useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { connectSpellDuel, type SpellDuelConnection } from "@cup/spellduel-client";
import { buildCsrfHeaders } from "../../../api/csrf";
import type { LobbyJoinResponse } from "@cup/shared-types";

type Params = { matchId: string };

export function SpellDuelGame() {
  const { matchId } = useParams<Params>();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!matchId) return;
    const el = containerRef.current;
    if (!el) return;

    const controller = new AbortController();
    let conn: SpellDuelConnection | null = null;

    const join = async () => {
      const res = await fetch(`/api/games/spellduel/join/${matchId}`, {
        method: "POST",
        signal: controller.signal,
        credentials: "include",
        headers: await buildCsrfHeaders(),
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Lobby not found");
        if (res.status === 410) throw new Error("Lobby has expired");
        if (res.status === 409) throw new Error("Lobby is not open for joining");
        throw new Error("Failed to join: " + res.statusText);
      }
      return res.json() as Promise<LobbyJoinResponse>;
    };

    join()
      .then((info) => {
        conn = connectSpellDuel(info.socketUrl, info.ticket, el);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("SpellDuel join error:", err);
      });

    return () => {
      controller.abort();
      conn?.disconnect();
    };
  }, [matchId]);

  if (!matchId) return <div>Missing matchId</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)]/80 p-2 md:p-8 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl sm:text-3xl text-[color:var(--text)]">SpellDuel</h2>
          <div className="flex gap-3">
            <button
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm text-[color:var(--text)] hover:border-[color:var(--text)] transition"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
            >
              Copy Join Link
            </button>
          </div>
        </div>
        <div ref={containerRef} id="spellduel_client_container" />
      </div>
    </div>
  );
}
